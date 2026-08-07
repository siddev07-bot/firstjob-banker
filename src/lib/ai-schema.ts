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
  pos: z.string().min(1),
  hindi: z.string().min(1),
  english: z.string().min(1),
  synonyms: z.string().min(1),
  antonyms: z.string().optional().default(""),
  usage: z.string().min(1),
  editorial_sentence: z.string().optional().default(""),
  memory_trick: z.string().optional().default(""),
  ibps_trap: z.string().optional().default(""),
});

export const AnalysisSchema = z.object({
  issue: z.string().min(1),
  causes: z.array(z.string().min(1)).min(1),
  effects: z.array(z.string().min(1)).min(1),
  solutions: z.array(z.string().min(1)).min(1),
  author_tone: z.string().min(1),
  main_idea: z.string().min(1),
  one_line_summary: z.string().min(1),
  best_title: z.string().optional().default(""),
  inferences: z.array(z.string()).optional().default([]),
  facts: z.array(z.string()).optional().default([]),
});

export const PackageSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  theme: z.string().min(1),
  tone: z.string().min(1),
  conclusion: z.string().min(1),
  takeaways: z.array(z.string().min(1)).min(1),
  analysis: AnalysisSchema,
  vocabulary: z.array(VocabEntrySchema).min(1),
  sbi_notes: z.array(z.object({ word: z.string().min(1), note: z.string().min(1) })).min(1),
  quiz: z.array(QuizQuestionSchema).min(30).max(30),
});

export type GeneratedPackage = z.infer<typeof PackageSchema>;
