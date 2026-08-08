import { z } from "zod";

/** RC question sub-types tagged beside each question (IBPS PO Prelims labels). */
export const RC_SUBTYPES = [
  "Inference Based",
  "Statement Based",
  "Fact Based",
  "Incorrect Statement",
  "Situation Based",
  "Vocabulary in Context",
  "Context Meaning",
  "Best Conclusion",
] as const;

export type RcSubtype = (typeof RC_SUBTYPES)[number];

/** Exact section distribution required from every generation (30 questions). */
export const REQUIRED_SECTIONS = {
  rc: 10,
  error: 5,
  cloze: 5,
  word_rearrangement: 5,
  para_jumble: 5,
} as const;

export const QUIZ_SECTION_TYPES = ["rc", "error", "cloze", "word_rearrangement", "para_jumble"] as const;

export const DIFFICULTIES = ["Easy", "Moderate", "Difficult"] as const;

export const QuizQuestionSchema = z.object({
  type: z.enum(QUIZ_SECTION_TYPES),
  subtype: z.string().optional().default(""),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().optional().default(""),
  para_ref: z.string().optional().default(""),
  difficulty: z.enum(DIFFICULTIES).catch("Moderate").default("Moderate"),
});

export const VocabEntrySchema = z.object({
  word: z.string().min(1),
  pos: z.string().optional().default(""),
  hindi: z.string().optional().default(""),
  english: z.string().optional().default(""),
  synonyms: z.string().optional().default(""),
  antonyms: z.string().optional().default(""),
  usage: z.string().optional().default(""),
  editorial_sentence: z.string().optional().default(""),
  memory_trick: z.string().optional().default(""),
  ibps_trap: z.string().optional().default(""),
});

export const AnalysisSchema = z.object({
  issue: z.string().optional().default(""),
  causes: z.array(z.string()).optional().default([]),
  effects: z.array(z.string()).optional().default([]),
  solutions: z.array(z.string()).optional().default([]),
  author_tone: z.string().optional().default(""),
  main_idea: z.string().optional().default(""),
  one_line_summary: z.string().optional().default(""),
  best_title: z.string().optional().default(""),
  inferences: z.array(z.string()).optional().default([]),
  facts: z.array(z.string()).optional().default([]),
});

/** Everything except the quiz — produced by the "study" generation call. */
export const StudySchema = z.object({
  title: z.string().min(1),
  summary: z.string().optional().default(""),
  theme: z.string().optional().default(""),
  tone: z.string().optional().default(""),
  conclusion: z.string().optional().default(""),
  takeaways: z.array(z.string()).optional().default([]),
  analysis: AnalysisSchema.optional().default({}),
  vocabulary: z.array(VocabEntrySchema).optional().default([]),
  sbi_notes: z.array(z.object({ word: z.string().min(1), note: z.string().min(1) })).optional().default([]),
});

/** Quiz-only payload — produced by the RC call and the non-RC sections call. */
export const QuizOnlySchema = z.object({
  quiz: z.array(QuizQuestionSchema).min(1),
});

export const PackageSchema = StudySchema.extend({
  quiz: z.array(QuizQuestionSchema).min(1),
});

export type GeneratedPackage = z.infer<typeof PackageSchema>;

