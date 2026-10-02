// lib/repository.ts
// Question Repository — persisted in localStorage per student email.

export interface RepositoryTurn {
  role: "sage" | "student";
  content: string;
  stars?: number;
  ts: number;
}

export interface RepositoryQuestion {
  id: string;                  // e.g. "mc-q38a"
  savedAt: number;             // epoch ms
  paperTitle: string;          // e.g. "2024 Nanyang SA2 Science Paper 2"
  questionNumber: number;
  part: string;                // "" | "a" | "b" etc.
  topic: string;
  question: string;            // printed question text
  marks: number;
  firstAttemptAnswer: string;  // student's handwritten answer from paper
  firstAttemptScore: number;   // marks scored (autoScore or estimatedScore)
  sageDiscussion?: {
    savedAt: number;
    turns: RepositoryTurn[];
    starsEarned: number;
  };
}

const repoKey = (email: string) => `synapse_repo_${email.toLowerCase().trim()}`;

export function getRepository(email: string): RepositoryQuestion[] {
  try {
    const raw = localStorage.getItem(repoKey(email));
    return raw ? (JSON.parse(raw) as RepositoryQuestion[]) : [];
  } catch {
    return [];
  }
}

export function saveToRepository(email: string, q: RepositoryQuestion): void {
  try {
    const repo = getRepository(email);
    const idx = repo.findIndex(r => r.id === q.id && r.paperTitle === q.paperTitle);
    if (idx >= 0) {
      repo[idx] = { ...repo[idx], ...q };
    } else {
      repo.unshift(q); // newest first
    }
    localStorage.setItem(repoKey(email), JSON.stringify(repo));
  } catch { /* storage full or blocked */ }
}

export function updateSageDiscussion(
  email: string,
  questionId: string,
  paperTitle: string,
  turns: RepositoryTurn[],
  starsEarned: number,
): void {
  try {
    const repo = getRepository(email);
    const idx = repo.findIndex(r => r.id === questionId && r.paperTitle === paperTitle);
    if (idx >= 0) {
      repo[idx].sageDiscussion = { savedAt: Date.now(), turns, starsEarned };
      localStorage.setItem(repoKey(email), JSON.stringify(repo));
    }
  } catch { /* ignore */ }
}

export function removeFromRepository(email: string, questionId: string, paperTitle: string): void {
  try {
    const repo = getRepository(email).filter(
      r => !(r.id === questionId && r.paperTitle === paperTitle),
    );
    localStorage.setItem(repoKey(email), JSON.stringify(repo));
  } catch { /* ignore */ }
}

export function getTopics(email: string): string[] {
  const repo = getRepository(email);
  return Array.from(new Set(repo.map(q => q.topic))).sort();
}
