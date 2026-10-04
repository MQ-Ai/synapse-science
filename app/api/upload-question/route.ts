import { NextRequest, NextResponse } from "next/server";
import { appendToStore } from "@/lib/uploaded-questions-store";

// ── Question bank import ───────────────────────────────────────────────────────
// Uncomment the line below once you confirm the path to your question bank.
// The bank must export an array of objects with at least: id, year, questionNumber,
// part, topic, context, question, marks, keywords, modelAnswer.
//
// import { questions as questionBank } from "@/lib/questions";
// (or wherever your bank lives — check your psle-socratic-terminal.tsx imports)

export const runtime = "nodejs";

const MAX_IMAGES = 2;
const MAX_BYTES = 5 * 1024 * 1024;

// ── System prompts ─────────────────────────────────────────────────────────────

const EXTRACT_SYSTEM = `You are a Singapore PSLE Science exam expert and careful OCR reader.
Your job is to read one or two photos of an exam question and extract it with PERFECT accuracy.

ACCURACY RULES — read every word twice before transcribing:
- Read each sentence in the image, then re-read it to confirm every word is correct.
- Pay special attention to verbs (e.g. "changed" vs "measured", "increased" vs "decreased").
- Pay special attention to numbers, units, and scientific terms — copy them exactly as printed.
- Only use [unclear] as a last resort.
- Never substitute a similar-sounding or similar-looking word.

SAFETY FIRST — before extracting anything, check the image:
- If the image contains inappropriate content (nudity, sexual content, graphic violence, hate symbols), return: {"error": "inappropriate_content"}
- If the image shows private personal information (ID cards, medical records), return: {"error": "private_content"}
- If the image is not an exam or educational question, return: {"error": "not_a_question"}

COLOR-CODED ANNOTATION DETECTION:
Exam papers may contain writing in multiple ink colors. Identify each separately:
- ORIGINAL STUDENT ANSWER: written in pencil (grey) or blue/black pen — the student's initial attempt before any feedback
- TEACHER FEEDBACK: written in RED ink — includes ticks (✓), crosses (✗), underlines, circled words, and written comments or corrections in the margins or between lines
- STUDENT CORRECTIONS: written in GREEN ink — rewrites or additions the student made after receiving the teacher's red feedback

If lighting or photo quality makes color ambiguous, note it in the relevant field rather than guessing.

Return a single JSON object — nothing else — with these fields:
{
  "question": "The full verbatim printed question text only. Include sub-parts labelled (a), (b) etc. Do NOT include any handwriting here. Re-read each sentence before writing it.",
  "context": "Any background passage, diagram description, or experimental setup. Verbatim. Empty string if none.",
  "marks": <number, default 2 if unclear>,
  "topic": "Best matching Singapore PSLE Science topic (e.g. Photosynthesis, Heat Transfer, Water Cycle, Food Chains & Webs, etc.)",
  "keywords": ["key", "science", "concepts", "the answer must include"],
  "modelAnswer": "Your best expert derivation of a full-mark answer. Be thorough. If the photo includes a suggested answer, evaluate it carefully — use it only if scientifically correct and age-appropriate; otherwise derive your own.",
  "hasProvidedAnswer": <boolean, true if the photo included a suggested/model answer>,
  "studentAnswer": "ONLY the original handwritten answer in pencil or blue/black ink — the student's initial attempt. For multi-part questions, label each part: (a) [answer] (b) [answer] (c) [answer]. Do NOT include red or green ink here. Empty string if no original handwriting found.",
  "teacherFeedback": "Everything written in RED ink: describe ticks, crosses, underlines, circled words, and any written comments or corrections. Example: 'Tick next to first sentence. Cross next to second sentence. Circled the word conduction and wrote: be more specific. Wrote +1 in margin.' Empty string if no red ink detected.",
  "studentCorrections": "Everything written in GREEN ink — rewrites or additions by the student after receiving teacher feedback. Label by part if applicable. Empty string if no green ink detected.",
  "hasTeacherMarking": <boolean, true if any red ink annotation is detected>,
  "hasStudentCorrections": <boolean, true if any green ink is detected>
}

Rules:
- Combine text across both images if provided.
- Re-read every sentence before writing it — accuracy is critical.
- The modelAnswer must be complete enough to guide a Socratic tutor.
- Keep studentAnswer, teacherFeedback, and studentCorrections strictly separated by ink color.`;

const VERIFY_SYSTEM = `You are a careful proofreader checking an OCR extraction of a Singapore PSLE Science exam question.

You will be given:
1. The original image(s)
2. A first-pass JSON extraction

Your job: re-read the image(s) carefully, word by word, and verify these fields are accurate:
- "question" and "context" (printed text — verbatim accuracy)
- "studentAnswer" (pencil/blue/black ink only)
- "teacherFeedback" (red ink only)
- "studentCorrections" (green ink only)
- "hasTeacherMarking" and "hasStudentCorrections" (correct boolean values)

Fix ONLY genuine transcription errors. Return the corrected JSON with the same structure. No explanation.`;

const SCORE_SYSTEM = `You are a Singapore PSLE Science marker applying the official mark scheme.

You will be given a student's answer, the model answer, required keywords, and the total marks available for this question.

Apply these marking rules strictly:
- Award marks only for scientifically correct and precise statements
- Vague or incomplete answers do not earn marks (e.g. "because it's hot" ≠ "because the temperature increases")
- The student must demonstrate understanding of the mechanism, not just the outcome
- Award each mark individually against the mark scheme — do not round up or give benefit of the doubt
- The maximum score you can award is exactly the total marks stated for this question

Return a single JSON object only:
{
  "autoScore": <integer between 0 and the total marks available — never exceed the stated maximum>,
  "scoreRationale": "Precise explanation of each mark awarded or withheld. Reference specific words from the student's answer.",
  "whatIsRight": "What the student correctly stated. Empty string if nothing is correct.",
  "whatIsMissing": "Exactly what the student needs to add or change to earn full marks. Empty string if already at full marks."
}`;

// ── Question bank matching ─────────────────────────────────────────────────────

interface PSLEQuestion {
  id: string;
  year: number;
  questionNumber: number;
  part: string;
  topic: string;
  context: string;
  question: string;
  marks: number;
  keywords: string[];
  modelAnswer: string;
}

function wordOverlapSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 2); // ignore short stop words
  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = Array.from(wordsA).filter(w => wordsB.has(w)).length;
  const union = new Set(Array.from(wordsA).concat(Array.from(wordsB))).size;
  return union === 0 ? 0 : intersection / union;
}

function findMatchingQuestion(
  extractedText: string,
  topic: string,
  bank: PSLEQuestion[]
): { matched: true; question: PSLEQuestion; confidence: number } | { matched: false } {
  const THRESHOLD = 0.72;

  // Filter by topic first for efficiency
  const topicLower = topic.toLowerCase();
  const topicCandidates = bank.filter(q =>
    q.topic.toLowerCase().includes(topicLower) ||
    topicLower.includes(q.topic.toLowerCase())
  );
  const candidates = topicCandidates.length > 0 ? topicCandidates : bank;

  let bestMatch: PSLEQuestion | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const combined = `${candidate.context} ${candidate.question}`;
    const score = wordOverlapSimilarity(extractedText, combined);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  if (bestMatch && bestScore >= THRESHOLD) {
    return { matched: true, question: bestMatch, confidence: bestScore };
  }
  return { matched: false };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { images: string[] };
    const { images } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }
    if (images.length > MAX_IMAGES) {
      return NextResponse.json({ error: "Maximum 2 images allowed" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Build vision content blocks
    const contentBlocks: object[] = [];
    for (let i = 0; i < images.length; i++) {
      const dataUrl = images[i];
      const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/);
      if (!match) {
        return NextResponse.json({ error: `Image ${i + 1} is not a valid base64 image` }, { status: 400 });
      }
      const [, mediaType, b64] = match;
      if (b64.length * 0.75 > MAX_BYTES) {
        return NextResponse.json({ error: `Image ${i + 1} is too large (max 5MB)` }, { status: 400 });
      }
      if (images.length > 1) {
        contentBlocks.push({ type: "text", text: `Page ${i + 1} of the question:` });
      }
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: b64 },
      });
    }
    contentBlocks.push({ type: "text", text: "Extract the question and return JSON only as specified." });

    // ── Pass 1: Extract ──────────────────────────────────────────────────────
    const response1 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1800,
        system: EXTRACT_SYSTEM,
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });

    if (!response1.ok) {
      const err = await response1.text();
      console.error("Anthropic vision error (pass 1):", err);
      return NextResponse.json({ error: "Failed to read image" }, { status: 500 });
    }

    const data1 = await response1.json() as { content: { text: string }[] };
    const raw1 = data1.content[0].text;

    let parsed: {
      error?: string;
      question?: string;
      context?: string;
      marks?: number;
      topic?: string;
      keywords?: string[];
      modelAnswer?: string;
      hasProvidedAnswer?: boolean;
      studentAnswer?: string;
      teacherFeedback?: string;
      studentCorrections?: string;
      hasTeacherMarking?: boolean;
      hasStudentCorrections?: boolean;
    };

    try {
      const jsonMatch = raw1.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw1);
    } catch {
      return NextResponse.json({ error: "Could not parse question from image. Please try a clearer photo." }, { status: 422 });
    }

    // ── Pass 2: Verify & correct ─────────────────────────────────────────────
    if (!parsed.error && parsed.question) {
      try {
        const verifyBlocks: object[] = [
          ...contentBlocks.slice(0, -1),
          {
            type: "text",
            text: `Here is the first-pass extraction. Re-read the image(s) carefully and correct any transcription errors. Return corrected JSON only.\n\n${JSON.stringify(parsed)}`,
          }
        ];
        const response2 = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({
            model: "claude-opus-4-5",
            max_tokens: 1800,
            system: VERIFY_SYSTEM,
            messages: [{ role: "user", content: verifyBlocks }],
          }),
        });
        if (response2.ok) {
          const data2 = await response2.json() as { content: { text: string }[] };
          const raw2 = data2.content[0].text;
          try {
            const jsonMatch2 = raw2.match(/\{[\s\S]*\}/);
            const verified = JSON.parse(jsonMatch2 ? jsonMatch2[0] : raw2);
            if (verified.question) parsed.question = verified.question;
            if (verified.context !== undefined) parsed.context = verified.context;
            if (verified.studentAnswer !== undefined) parsed.studentAnswer = verified.studentAnswer;
            if (verified.teacherFeedback !== undefined) parsed.teacherFeedback = verified.teacherFeedback;
            if (verified.studentCorrections !== undefined) parsed.studentCorrections = verified.studentCorrections;
            if (verified.hasTeacherMarking !== undefined) parsed.hasTeacherMarking = verified.hasTeacherMarking;
            if (verified.hasStudentCorrections !== undefined) parsed.hasStudentCorrections = verified.hasStudentCorrections;
          } catch { /* keep pass-1 result */ }
        }
      } catch { /* keep pass-1 result */ }
    }

    // Handle safety rejections
    if (parsed.error === "inappropriate_content") {
      return NextResponse.json({ error: "This image contains inappropriate content and cannot be used." }, { status: 422 });
    }
    if (parsed.error === "private_content") {
      return NextResponse.json({ error: "This image appears to contain private personal information." }, { status: 422 });
    }
    if (parsed.error === "not_a_question") {
      return NextResponse.json({ error: "This doesn't look like an exam question. Please upload a clear photo of a printed question." }, { status: 422 });
    }
    if (parsed.error) {
      return NextResponse.json({ error: "Could not process this image. Please try again with a clearer photo." }, { status: 422 });
    }
    if (!parsed.question || parsed.question.trim().length < 10) {
      return NextResponse.json({ error: "Could not find a question in this image. Please try a clearer photo." }, { status: 422 });
    }

    // ── Pass 3: Auto-score (only for unmarked student answers) ───────────────
    let autoScore: number | null = null;
    let scoreRationale = "";
    let whatIsRight = "";
    let whatIsMissing = "";

    const hasStudentAnswer = (parsed.studentAnswer ?? "").trim().length > 0;
    const isUnmarked = !parsed.hasTeacherMarking;

    if (hasStudentAnswer && isUnmarked && parsed.modelAnswer) {
      try {
        const scorePrompt = [
          `Question: ${parsed.question}`,
          parsed.context ? `Context: ${parsed.context}` : "",
          `Model answer: ${parsed.modelAnswer}`,
          `Keywords required: ${(parsed.keywords ?? []).join(", ")}`,
          `Total marks available: ${parsed.marks ?? 2}`,
          `Student's answer: ${parsed.studentAnswer}`,
          "\nScore this answer and return JSON only.",
        ].filter(Boolean).join("\n\n");

        const response3 = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({
            model: "claude-opus-4-5",
            max_tokens: 600,
            system: SCORE_SYSTEM,
            messages: [{ role: "user", content: scorePrompt }],
          }),
        });

        if (response3.ok) {
          const data3 = await response3.json() as { content: { text: string }[] };
          const raw3 = data3.content[0].text;
          try {
            const jsonMatch3 = raw3.match(/\{[\s\S]*\}/);
            const scored = JSON.parse(jsonMatch3 ? jsonMatch3[0] : raw3);
            autoScore = typeof scored.autoScore === "number" ? scored.autoScore : null;
            scoreRationale = scored.scoreRationale ?? "";
            whatIsRight = scored.whatIsRight ?? "";
            whatIsMissing = scored.whatIsMissing ?? "";
          } catch { /* non-fatal */ }
        }
      } catch { /* non-fatal — session proceeds without auto-score */ }
    }

    // ── Question bank matching ────────────────────────────────────────────────
    // Once you've confirmed your question bank import path above, uncomment this block:
    //
    // const matchResult = findMatchingQuestion(
    //   `${parsed.context ?? ""} ${parsed.question}`,
    //   parsed.topic ?? "",
    //   questionBank
    // );
    //
    // const matchedPaper = matchResult.matched ? {
    //   year: matchResult.question.year,
    //   questionNumber: matchResult.question.questionNumber,
    //   part: matchResult.question.part,
    //   id: matchResult.question.id,
    //   // Override with verified database content:
    //   verifiedQuestion: matchResult.question.question,
    //   verifiedContext: matchResult.question.context,
    //   verifiedModelAnswer: matchResult.question.modelAnswer,
    //   verifiedKeywords: matchResult.question.keywords,
    // } : null;

    // Shape the final question object
    const question = {
      id: `upload-${Date.now()}`,
      year: new Date().getFullYear(),
      questionNumber: 0,
      part: "",
      topic: parsed.topic ?? "General Science",
      context: parsed.context ?? "",
      question: parsed.question!,
      marks: parsed.marks ?? 2,
      keywords: parsed.keywords ?? [],
      modelAnswer: parsed.modelAnswer ?? "",
      isUploaded: true,
      hasProvidedAnswer: parsed.hasProvidedAnswer ?? false,
      // Ink-separated fields
      studentAnswer: parsed.studentAnswer ?? "",
      teacherFeedback: parsed.teacherFeedback ?? "",
      studentCorrections: parsed.studentCorrections ?? "",
      hasTeacherMarking: parsed.hasTeacherMarking ?? false,
      hasStudentCorrections: parsed.hasStudentCorrections ?? false,
      // Auto-score (null if question was teacher-marked or had no student answer)
      autoScore,
      scoreRationale,
      whatIsRight,
      whatIsMissing,
      // matchedPaper, // uncomment when question bank is wired up
    };

    try { await appendToStore({ ...question, uploadedAt: new Date().toISOString() }); } catch { /* non-fatal */ }

    return NextResponse.json({ question });
  } catch (err) {
    console.error("upload-question error:", err);
    return NextResponse.json({ error: "Failed to process image" }, { status: 500 });
  }
}
