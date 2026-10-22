export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

interface Question {
  id: string;
  questionNumber: number;
  part: string;
  topic: string;
  question: string;
  marks: number;
  modelAnswer?: string;
  paperTitle: string;
}

interface RequestBody {
  questions: Question[];
  answers: Record<string, string>;
}

interface MarkingResult {
  id: string;
  score: number;
  scoreRationale: string;
  whatIsRight: string;
  whatIsMissing: string;
}

export interface TopicSummary {
  topic: string;
  marksAttained: number;
  totalMarks: number;
  percentage: number;
  status: "strong" | "needs-work" | "weak";
}

const SYSTEM_PROMPT = `You are a Singapore PSLE Science Chief Examiner with 20 years of marking experience, marking a student's mock paper.

━━━ MARKING STANDARDS (apply strictly) ━━━
- Award marks only for scientifically correct and precise statements
- Vague language does not earn marks — "because it's hot" ≠ "because the temperature of the water increases"
- Students must demonstrate understanding of the MECHANISM, not just state the outcome
- Stating the outcome alone without the mechanism earns 0 for that mark point
- For any question involving a physical action (pouring, spreading, crushing, grinding, stirring, etc.),
  the student MUST explicitly state the physical change caused by that action AND how it leads to the result:
    ✗ "The tea comes into contact with cooler air" — effect only, no mechanism → does not earn the mark
    ✓ "Pouring stretches the tea into a thin stream, increasing the surface area exposed to the cooler surrounding air" → earns the mark
- For rate questions (faster/slower/more/less): the student must explain WHAT changed AND WHY that affects the rate
- For heat transfer: if the question asks how/why, the student must name the physical change driving it
- Award each mark individually against each criterion — never round up or give benefit of the doubt
- The maximum score for any question equals exactly the marks stated in the question
- If an answer is partially correct, deduct for each missing mechanism and state exactly what is missing

Return ONLY a JSON object (no markdown fences, no other text):
{
  "results": [
    {
      "id": "<question id>",
      "score": <integer 0 to marks>,
      "scoreRationale": "Precise explanation of EACH mark awarded or withheld. Quote the student's exact words. E.g.: '1 mark awarded: student wrote \\"the liquid evaporates\\" — correct process named. 1 mark withheld: student did not state that evaporation requires heat energy from the surroundings, leaving the mechanism incomplete.'",
      "whatIsRight": "Quote the student's exact words that earned marks. Empty string if nothing correct.",
      "whatIsMissing": "Precisely what mechanism or detail must be added for full marks. Empty string if full marks awarded."
    }
  ]
}`;

function buildTopicAnalysis(
  questions: Question[],
  results: MarkingResult[]
): TopicSummary[] {
  const topicMap = new Map<string, { attained: number; total: number }>();
  for (const q of questions) {
    const r = results.find((x) => x.id === q.id);
    const score = r ? r.score : 0;
    const t = q.topic || "General Science";
    const existing = topicMap.get(t) ?? { attained: 0, total: 0 };
    topicMap.set(t, {
      attained: existing.attained + score,
      total: existing.total + q.marks,
    });
  }
  return Array.from(topicMap.entries())
    .map(([topic, { attained, total }]) => {
      const pct = total === 0 ? 0 : Math.round((attained / total) * 100);
      return {
        topic,
        marksAttained: attained,
        totalMarks: total,
        percentage: pct,
        status: (pct >= 75 ? "strong" : pct >= 50 ? "needs-work" : "weak") as
          | "strong"
          | "needs-work"
          | "weak",
      };
    })
    .sort((a, b) => a.percentage - b.percentage); // weakest first
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: RequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  if (!body.questions || !Array.isArray(body.questions) || body.questions.length === 0) {
    return NextResponse.json(
      { error: "Missing or empty 'questions' array" },
      { status: 400 }
    );
  }

  if (!body.answers || typeof body.answers !== "object") {
    return NextResponse.json(
      { error: "Missing or invalid 'answers' object" },
      { status: 400 }
    );
  }

  const userMessage = body.questions
    .map((q) => {
      const answer = body.answers[q.id] || "(no answer)";
      const modelAnswer = q.modelAnswer && q.modelAnswer.trim() ? q.modelAnswer : "N/A";
      return `Q${q.questionNumber}${q.part}: ${q.question} [${q.marks} marks]
Model answer: ${modelAnswer}
Student answer: ${answer}`;
    })
    .join("\n\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key not configured" },
      { status: 500 }
    );
  }

  let anthropicResponse: Response;

  try {
    anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 6000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reach Anthropic API", detail: String(error) },
      { status: 500 }
    );
  }

  if (!anthropicResponse.ok) {
    let detail: string;
    try {
      const errBody = await anthropicResponse.json();
      detail = JSON.stringify(errBody);
    } catch {
      detail = await anthropicResponse.text();
    }
    return NextResponse.json(
      { error: "Anthropic API returned an error", detail },
      { status: 500 }
    );
  }

  let anthropicData: {
    content: Array<{ type: string; text: string }>;
  };

  try {
    anthropicData = await anthropicResponse.json();
  } catch {
    return NextResponse.json(
      { error: "Failed to parse Anthropic API response" },
      { status: 500 }
    );
  }

  const textBlock = anthropicData.content?.find((block) => block.type === "text");
  if (!textBlock || typeof textBlock.text !== "string") {
    return NextResponse.json(
      { error: "Unexpected response structure from Anthropic API" },
      { status: 500 }
    );
  }

  let parsed: { results: MarkingResult[] };

  // Strip markdown code fences if the model wrapped the JSON
  const rawText = textBlock.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Last resort: find the first { ... } block in the response
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return NextResponse.json(
          { error: "Failed to parse marking results as JSON", raw: textBlock.text },
          { status: 422 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Failed to parse marking results as JSON", raw: textBlock.text },
        { status: 422 }
      );
    }
  }

  if (!parsed.results || !Array.isArray(parsed.results)) {
    return NextResponse.json(
      {
        error: "Marking response missing 'results' array",
        raw: textBlock.text,
      },
      { status: 422 }
    );
  }

  const results: MarkingResult[] = parsed.results.map((r) => ({
    id: String(r.id),
    score: Math.max(0, Math.floor(Number(r.score))),
    scoreRationale: String(r.scoreRationale ?? ""),
    whatIsRight: String(r.whatIsRight ?? ""),
    whatIsMissing: String(r.whatIsMissing ?? ""),
  }));

  const topicAnalysis = buildTopicAnalysis(body.questions, results);

  return NextResponse.json({ results, topicAnalysis });
}
