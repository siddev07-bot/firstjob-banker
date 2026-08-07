/** Canonical question sections used across generation, quiz UI and analytics. */
export const QUIZ_TYPES = [
  "error",
  "cloze",
  "para_jumble",
  "phrase_replacement",
  "double_fillers",
  "sentence_rearrangement",
  "word_rearrangement",
  "ows",
  "vocab",
  "tone",
  "rc",
] as const;

export type QuizType = (typeof QUIZ_TYPES)[number];

export const QUIZ_TYPE_LABEL: Record<QuizType, string> = {
  error: "Error Detection",
  cloze: "Single Fillers",
  para_jumble: "Para Jumble",
  phrase_replacement: "Phrase Replacement",
  double_fillers: "Double Fillers",
  sentence_rearrangement: "Sentence Rearrangement",
  word_rearrangement: "Word Swap",
  ows: "One Word Substitution",
  vocab: "Vocabulary",
  tone: "Editorial Tone",
  rc: "Reading Comprehension",
};

/** Required number of questions per section in every generated editorial (30 total, IBPS PO Prelims level). */
export const QUIZ_DISTRIBUTION: Record<QuizType, number> = {
  rc: 10,
  error: 5,
  cloze: 5,
  word_rearrangement: 5,
  para_jumble: 5,
  double_fillers: 0,
  phrase_replacement: 0,
  sentence_rearrangement: 0,
  ows: 0,
  vocab: 0,
  tone: 0,
};

export const QUIZ_TOTAL = Object.values(QUIZ_DISTRIBUTION).reduce((a, b) => a + b, 0);

export function labelFor(type: string): string {
  return QUIZ_TYPE_LABEL[type as QuizType] ?? type.replace(/_/g, " ");
}
