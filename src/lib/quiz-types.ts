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
  cloze: "Cloze Test",
  para_jumble: "Para Jumbles",
  phrase_replacement: "Phrase Replacement",
  double_fillers: "Double Fillers",
  sentence_rearrangement: "Sentence Rearrangement",
  word_rearrangement: "Word Rearrangement",
  ows: "One Word Substitution",
  vocab: "Vocabulary",
  tone: "Editorial Tone",
  rc: "Reading Comprehension",
};

/** Required number of questions per section in every generated editorial. */
export const QUIZ_DISTRIBUTION: Record<QuizType, number> = {
  error: 10,
  cloze: 10,
  para_jumble: 5,
  phrase_replacement: 5,
  double_fillers: 5,
  sentence_rearrangement: 5,
  word_rearrangement: 5,
  ows: 5,
  vocab: 5,
  tone: 2,
  rc: 3,
};

export const QUIZ_TOTAL = Object.values(QUIZ_DISTRIBUTION).reduce((a, b) => a + b, 0);

export function labelFor(type: string): string {
  return QUIZ_TYPE_LABEL[type as QuizType] ?? type.replace(/_/g, " ");
}
