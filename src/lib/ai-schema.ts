import { z } from "zod";

/** RC question sub-types tagged beside each question (exam-style labels). */
export const RC_SUBTYPES = [
  "Factual",
  "Inference",
  "Main Idea",
  "Best Title",
  "Tone",
  "Purpose",
  "Vocabulary",
  "Synonym/Antonym",
  "Phrase Meaning",
  "True/False/Cannot Be Inferred",
] as const;

export type RcSubtype = (typeof RC_SUBTYPES)[number];

export const QuizQuestionSchema = z.object({
  type: z.literal("rc").catch("rc").default("rc"),
  subtype: z.enum(RC_SUBTYPES),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().optional().default(""),
});

export const VocabEntrySchema = z.object({
  word: z.string().min(1),
  pos: z.string().min(1),
  hindi: z.string().min(1),
  english: z.string().min(1),
  synonyms: z.string().min(1),
  usage: z.string().min(1),
});

export const AnalysisSchema = z.object({
  issue: z.string().min(1),
  causes: z.array(z.string().min(1)).min(1),
  effects: z.array(z.string().min(1)).min(1),
  solutions: z.array(z.string().min(1)).min(1),
  author_tone: z.string().min(1),
  main_idea: z.string().min(1),
  one_line_summary: z.string().min(1),
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
  quiz: z.array(QuizQuestionSchema).min(6).max(12),
});

export type GeneratedPackage = z.infer<typeof PackageSchema>;
