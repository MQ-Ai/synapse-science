import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

// ── System prompts ─────────────────────────────────────────────────────────────

const MARKING_SYSTEM = `You are a Singapore PSLE Science Chief Examiner with 20 years of marking experience.

You will be given a complete Science exam paper containing printed questions and handwritten student answers.

Your tasks:
1. Identify the paper structure — sections (MCQ, Short Answer, Open-Ended) and all question numbers
2. For each question: extract the printed text, the student's handwritten answer, and any teacher marks
3. Score every student answer strictly against Singapore PSLE marking standards
4. Provide specific, actionable feedback

MARKING STANDARDS (apply strictly):
- Award marks only for scientifically correct and precise statements
- Vague language does not earn marks — "because it's hot" ≠ "because the temperature of the water increases"
- Students must demonstrate understanding of the mechanism, not just state the outcome
- Award each mark individually against the criterion — never round up or give benefit of the doubt
- The maximum score for any question equals exactly the marks stated for it

INK COLOR GUIDE:
- Student's original answer: pencil (grey) or blue/black ink
- Teacher marks: RED ink — ticks (✓), crosses (✗), underlines, written comments
- Student corrections after feedback: GREEN ink

Return a single JSON object — nothing else:
{
  "paperTitle": "Detected paper name, e.g. '2024 Nanyang Primary SA2 Science Paper 2' or 'PSLE Science Practice Paper' if unknown",
  "totalPaperMarks": <total marks the paper is out of>,
  "sections": [
    {
      "name": "Section A — Multiple Choice" or "Section B — Short Answer" or "Section C — Open-Ended Questions",
      "sectionTotalMarks": <number>,
      "questions": [
        {
          "questionNumber": <integer>,
          "part": "" or "a" or "b" or "c" or "d",
          "topic": "Matching PSLE Science topic e.g. Heat Transfer, Photosynthesis, Water Cycle",
          "question": "Full verbatim printed question text for this question or part",
          "marks": <marks available for this specific question or part>,
          "studentAnswer": "Handwritten answer in pencil or blue/black ink ONLY. Empty string if blank.",
          "teacherMarking": "Description of red ink annotations — ticks, crosses, comments. Empty string if none.",
          "hasTeacherMarking": <boolean>,
          "autoScore": <integer, marks awarded, 0 to the maximum stated in marks field>,
          "scoreRationale": "Precise explanation of each mark awarded or withheld. Quote the student's exact words.",
          "whatIsRight": "What the student correctly stated. Empty string if nothing is correct.",
          "whatIsMissing": "Exactly what the student must add or correct to achieve full marks. Empty string if full marks."
        }
      ]
    }
  ]
}

Process EVERY question in the paper. Do not skip any question or sub-part.`;

const DISCUSS_SYSTEM = `You are a Singapore PSLE Science exam expert reading a pre-marked exam paper.

The paper has already been marked by a teacher using red ink. Your job is to:
1. Identify all questions and sub-parts in the paper
2. For each: extract the student's original answer, the teacher's red ink feedback, and any green ink student corrections
3. Estimate the score based on the teacher's ticks and crosses
4. Flag questions where the student needs further Socratic discussion (less than full marks)

Return a single JSON object — nothing else:
{
  "paperTitle": "Detected paper name or 'PSLE Science Practice Paper' if unknown",
  "totalPaperMarks": <total marks the paper is out of>,
  "markedQuestions": [
    {
      "questionNumber": <integer>,
      "part": "" or "a" or "b" or "c" or "d",
      "topic": "PSLE Science topic",
      "question": "Verbatim printed question text",
      "marks": <total marks for this question or part>,
      "studentAnswer": "Original handwritten answer in pencil or blue/black ink",
      "teacherFeedback": "Everything in red ink — describe ticks (✓), crosses (✗), underlines, written comments precisely",
      "studentCorrections": "Any green ink rewrites by the student. Empty string if none.",
      "hasTeacherMarking": <boolean>,
      "estimatedScore": <estimated marks based on teacher ticks/crosses, integer 0 to marks>,
      "needsDiscussion": <boolean — true if student scored less than full marks>
    }
  ]
}

Process every question in the paper. Do not skip any.`;

// ── Types ──────────────────────────────────────────────────────────────────────

interface QuestionResult {
  questionNumber: number;
  part: string;
  topic: string;
  question: string;
  marks: number;
  studentAnswer: string;
  teacherMarking?: string;
  hasTeacherMarking: boolean;
  autoScore: number;
  scoreRationale: string;
  whatIsRight: string;
  whatIsMissing: string;
}

interface SectionResult {
  name: string;
  sectionTotalMarks: number;
  questions: QuestionResult[];
}

interface MarkingReport {
  mode: "mark";
  paperTitle: string;
  totalPaperMarks: number;
  marksAttained: number;
  percentage: number;
  sections: SectionResult[];
  topicAnalysis: TopicSummary[];
  recommendedSessions: QuestionResult[];
}

interface DiscussQuestion {
  questionNumber: number;
  part: string;
  topic: string;
  question: string;
  marks: number;
  studentAnswer: string;
  teacherFeedback: string;
  studentCorrections: string;
  hasTeacherMarking: boolean;
  estimatedScore: number;
  needsDiscussion: boolean;
}

interface DiscussReport {
  mode: "discuss";
  paperTitle: string;
  totalPaperMarks: number;
  estimatedTotal: number;
  markedQuestions: DiscussQuestion[];
  questionsNeedingHelp: DiscussQuestion[];
}

interface TopicSummary {
  topic: string;
  marksAttained: number;
  totalMarks: number;
  percentage: number;
  status: "strong" | "needs-work" | "weak";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildTopicAnalysis(sections: SectionResult[]): TopicSummary[] {
  const topicMap = new Map<string, { attained: number; total: number }>();
  for (const section of sections) {
    for (const q of section.questions) {
      const t = q.topic || "General Science";
      const existing = topicMap.get(t) ?? { attained: 0, total: 0 };
      topicMap.set(t, {
        attained: existing.attained + (q.autoScore ?? 0),
        total: existing.total + (q.marks ?? 0),
      });
    }
  }
  return [...topicMap.entries()].map(([topic, { attained, total }]) => {
    const pct = total === 0 ? 0 : Math.round((attained / total) * 100);
    return {
      topic,
      marksAttained: attained,
      totalMarks: total,
      percentage: pct,
      status: pct >= 75 ? "strong" : pct >= 50 ? "needs-work" : "weak",
    };
  }).sort((a, b) => a.percentage - b.percentage); // weakest first
}

function buildRecommendedSessions(sections: SectionResult[]): QuestionResult[] {
  return sections
    .flatMap(s => s.questions)
    .filter(q => (q.autoScore ?? 0) < (q.marks ?? 0) && q.whatIsMissing)
    .sort((a, b) => (b.marks - b.autoScore) - (a.marks - a.autoScore)) // biggest gap first
    .slice(0, 10);
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      pdf: string;      // base64 data URL: "data:application/pdf;base64,..."
      mode: "mark" | "discuss";
    };

    const { pdf, mode } = body;

    if (!pdf || !mode) {
      return NextResponse.json({ error: "Missing pdf or mode" }, { status: 400 });
    }

    if (mode !== "mark" && mode !== "discuss") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    // Validate PDF data URL
    const pdfMatch = pdf.match(/^data:application\/pdf;base64,(.+)$/);
    if (!pdfMatch) {
      return NextResponse.json({ error: "Invalid PDF format" }, { status: 400 });
    }
    const b64 = pdfMatch[1];
    if (b64.length * 0.75 > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "PDF is too large (max 20MB)" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const systemPrompt = mode === "mark" ? MARKING_SYSTEM : DISCUSS_SYSTEM;

    // Claude supports PDF documents natively
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: b64,
                },
              },
              {
                type: "text",
                text: mode === "mark"
                  ? "Process this full exam paper. Score every question and return the complete JSON report."
                  : "This paper has been marked by a teacher. Extract every question and the teacher's red ink feedback. Return the complete JSON report.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic marking error:", err);
      return NextResponse.json({ error: "Failed to process paper" }, { status: 500 });
    }

    const data = await response.json() as { content: { text: string }[] };
    const raw = data.content[0].text;

    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return NextResponse.json({ error: "Could not parse marking results. Please try again." }, { status: 422 });
    }

    if (mode === "mark") {
      const sections = (parsed.sections as SectionResult[]) ?? [];
      const totalPaperMarks = (parsed.totalPaperMarks as number) ?? sections.reduce((s, sec) => s + (sec.sectionTotalMarks ?? 0), 0);
      const marksAttained = sections.reduce((s, sec) => s + sec.questions.reduce((q, question) => q + (question.autoScore ?? 0), 0), 0);
      const percentage = totalPaperMarks === 0 ? 0 : Math.round((marksAttained / totalPaperMarks) * 100);

      const report: MarkingReport = {
        mode: "mark",
        paperTitle: (parsed.paperTitle as string) ?? "PSLE Science Practice Paper",
        totalPaperMarks,
        marksAttained,
        percentage,
        sections,
        topicAnalysis: buildTopicAnalysis(sections),
        recommendedSessions: buildRecommendedSessions(sections),
      };
      return NextResponse.json({ report });
    } else {
      const markedQuestions = (parsed.markedQuestions as DiscussQuestion[]) ?? [];
      const totalPaperMarks = (parsed.totalPaperMarks as number) ?? 0;
      const estimatedTotal = markedQuestions.reduce((s, q) => s + (q.estimatedScore ?? 0), 0);
      const questionsNeedingHelp = markedQuestions.filter(q => q.needsDiscussion);

      const report: DiscussReport = {
        mode: "discuss",
        paperTitle: (parsed.paperTitle as string) ?? "PSLE Science Practice Paper",
        totalPaperMarks,
        estimatedTotal,
        markedQuestions,
        questionsNeedingHelp,
      };
      return NextResponse.json({ report });
    }
  } catch (err) {
    console.error("marking-centre error:", err);
    return NextResponse.json({ error: "Failed to process paper" }, { status: 500 });
  }
}
