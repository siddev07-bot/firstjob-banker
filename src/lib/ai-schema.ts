import { z } from "zod";
import { QUIZ_DISTRIBUTION, type QuizType } from "@/lib/quiz-types";

/** Sections that must appear, with their exact required counts. */
export const REQUIRED_SECTIONS: Array<[QuizType, number]> = (
  Object.entries(QUIZ_DISTRIBUTION) as Array<[QuizType, number]>
).filter(([, n]) => n > 0);

const ALLOWED_TYPES = REQUIRED_SECTIONS.map(([t]) => t) as [QuizType, ...QuizType[]];

export const QuizQuestionSchema = z.object({
  type: z.enum(ALLOWED_TYPES),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
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
  quiz: z.array(QuizQuestionSchema),
});

export type GeneratedPackage = z.infer<typeof PackageSchema>;
