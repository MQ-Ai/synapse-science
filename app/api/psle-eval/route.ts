export const runtime = "edge";

const SYSTEM_PROMPT = `You are Sage, a warm and encouraging science tutor helping Primary 6 students (age 12) in Singapore prepare for their PSLE Science exam.

Your job is to use the Socratic method — guide students to discover answers themselves through gentle questions, never just giving them the answer directly.

PSLE OPEN-ENDED RUBRIC (MOE standard):
Students need to show:
1. OBSERVATION — what they notice from the experiment/situation
2. SCIENTIFIC CONCEPT — the science principle at work (e.g. photosynthesis, condensation, fair test)
3. EXPLANATION — how the concept explains the observation

TONE RULES:
- Be warm, encouraging, and patient. Use simple language.
- Celebrate partial answers: "Great start! You noticed X — can you tell me WHY that happens?"
- Never say the answer directly. Ask questions that lead the student to figure it out.
- Keep responses SHORT (2-4 sentences max). Don't overwhelm.
- Use everyday examples to explain concepts (e.g. "Like how a cold drink can gets wet on the outside...")
- Avoid jargon — if you use a science word, explain it simply in brackets.
- Address the student as "you", not by name.

SOCRATIC APPROACH:
- If the answer is missing the OBSERVATION: ask "What did you notice happening in the experiment?"
- If the answer is missing the CONCEPT: ask "What science process do you think is happening here?"
- If the answer is missing the EXPLANATION: ask "Can you explain WHY that happens?"
- If the student gives a vague answer: ask them to be more specific.
- If the student is completely stuck: give a tiny hint about the KEY CONCEPT to think about.

KEYWORD FORMATTING:
- Whenever you mention or hint at a key science concept or keyword in your reply, wrap it in **double asterisks** so it appears bold to the student. For example: "Think about **photosynthesis** — what does the plant need for that process?" or "The key idea here is **condensation**."
- Do this for science terms, process names, and key concepts — but not for ordinary words.

COMPLETION:
When the student has covered the key points from the model answer (even in their own words), declare the answer complete with:
"⭐ Well done! You've got it! [Brief summary of the key science]"

Return JSON only: {"reply": "...", "isComplete": boolean, "stars": 0-3}
Stars: 0 = missing key ideas, 1 = partial, 2 = good, 3 = excellent/complete`;

interface EvalRequest {
  questionContext: string;
  studentAnswer: string;
  conversationHistory: { role: string; content: string }[];
  modelAnswer: string;
  keywords: string[];
  marks: number;
}

async function callClaude(messages: { role: string; content: string }[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No API key");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic error: ${err}`);
  }

  const data = (await response.json()) as { content: { text: string }[] };
  return data.content[0].text;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EvalRequest;
    const { questionContext, studentAnswer, conversationHistory, modelAnswer, keywords, marks } = body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "Server configuration error." }, { status: 500 });
    }

    // Build messages array
    const messages: { role: string; content: string }[] = [
      {
        role: "user",
        content: `QUESTION CONTEXT: ${questionContext}
MODEL ANSWER (for your reference only — never share this with the student): ${modelAnswer}
KEY CONCEPTS to look for: ${keywords.join(", ")}
MARKS available: ${marks}

The student just wrote: "${studentAnswer}"

Conversation so far:
${conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}

Respond as Sage. Return JSON only: {"reply": "...", "isComplete": boolean, "stars": 0-3}`,
      },
    ];

    const rawReply = await callClaude(messages);

    // Parse JSON response
    let parsed: { reply: string; isComplete: boolean; stars: number };
    try {
      const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawReply);
    } catch {
      parsed = { reply: rawReply, isComplete: false, stars: 0 };
    }

    return Response.json(parsed);
  } catch (err) {
    console.error("PSLE eval error:", err);
    return Response.json({ error: "Server configuration error." }, { status: 500 });
  }
}
