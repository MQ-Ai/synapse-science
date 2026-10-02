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
  whatIsRight: string;
  whatIsMissing: string;
}

const SYSTEM_PROMPT = `You are a Singapore PSLE Science Chief Examiner marking a student's mock paper.

For each question: award marks strictly.
- Mechanism must be stated, not just the outcome
- Vague language ("because it's hot", "it spreads out") earns 0 for that mark point
- Each mark awarded independently; no rounding up
- Max score equals the marks stated in the question

Return ONLY a JSON object (no other text):
{
  "results": [
    {
      "id": "<question id>",
      "score": <integer 0 to marks>,
      "whatIsRight": "Quote what the student got right. Empty string if nothing.",
      "whatIsMissing": "Exactly what must be added for full marks. Empty string if full marks."
    }
  ]
}`;

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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
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

  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return NextResponse.json(
      {
        error: "Failed to parse marking results as JSON",
        raw: textBlock.text,
      },
      { status: 422 }
    );
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
    whatIsRight: String(r.whatIsRight ?? ""),
    whatIsMissing: String(r.whatIsMissing ?? ""),
  }));

  return NextResponse.json({ results });
}
