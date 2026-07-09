import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const VocabEntry = z.object({
  word: z.string(),
  pos: z.string().optional().default("noun"),
  hindi: z.string().optional().default(""),
  english: z.string().optional().default(""),
  synonyms: z.string().optional().default(""),
  usage: z.string().optional().default(""),
});
const SbiNote = z.object({ word: z.string(), note: z.string() });
const QuizQ = z.object({
  type: z.enum(["rc", "vocab", "cloze", "error", "ows"]).default("vocab"),
  question: z.string(),
  options: z.array(z.string()).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().optional().default(""),
});

const Analysis = z.object({
  issue: z.string().default(""),
  causes: z.array(z.string()).default([]),
  effects: z.array(z.string()).default([]),
  solutions: z.array(z.string()).default([]),
  author_tone: z.string().default(""),
  main_idea: z.string().default(""),
  one_line_summary: z.string().default(""),
}).default({
  issue: "", causes: [], effects: [], solutions: [],
  author_tone: "", main_idea: "", one_line_summary: "",
});

const SavePayload = z.object({
  title: z.string().min(1).max(500),
  full_article: z.string().min(1),
  summary: z.string().optional().default(""),
  theme: z.string().optional().default(""),
  tone: z.string().optional().default(""),
  conclusion: z.string().optional().default(""),
  takeaways: z.array(z.string()).default([]),
  analysis: Analysis,
  vocabulary: z.array(VocabEntry).default([]),
  sbi_notes: z.array(SbiNote).default([]),
  quiz: z.array(QuizQ).default([]),
});

function logAndThrow(op: string, error: unknown): never {
  console.error(`[articles.${op}]`, error);
  throw new Error(`Unable to ${op}. Please try again.`);
}

export const saveArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SavePayload.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("articles")
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) logAndThrow("save article", error);
    await supabase.from("reading_log").insert({ user_id: userId, article_id: row.id });
    return row;
  });

export const listArticles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("articles")
      .select("id,title,summary,created_at,vocabulary,quiz,quiz_stats")
      .order("created_at", { ascending: false });
    if (error) logAndThrow("load articles", error);
    return data ?? [];
  });

export const getArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("articles").select("*").eq("id", data.id).single();
    if (error) logAndThrow("load article", error);
    return row;
  });

export const deleteArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("articles").delete().eq("id", data.id);
    if (error) logAndThrow("delete article", error);
    return { ok: true };
  });

export const updateArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SavePayload.partial().extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("articles").update(patch).eq("id", id).select().single();
    if (error) logAndThrow("update article", error);
    return row;
  });

export const saveQuizStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      score: z.number().int().min(0),
      total: z.number().int().min(0),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const accuracy = data.total ? Math.round((data.score / data.total) * 100) : 0;
    const stats = { score: data.score, total: data.total, accuracy, at: new Date().toISOString() };
    const { error } = await context.supabase
      .from("articles")
      .update({ quiz_stats: stats as never })
      .eq("id", data.id);
    if (error) logAndThrow("save quiz stats", error);
    return stats;
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ count: total }, { data: rows }, { data: logRows }] = await Promise.all([
      supabase.from("articles").select("*", { count: "exact", head: true }),
      supabase.from("articles").select("vocabulary,summary,quiz_stats"),
      supabase.from("reading_log").select("read_date").eq("user_id", userId).order("read_date", { ascending: false }).limit(120),
    ]);

    let vocabCount = 0;
    let summariesCompleted = 0;
    let rcTotal = 0;
    let rcScore = 0;
    let quizzesAttempted = 0;
    for (const r of rows ?? []) {
      if (Array.isArray(r.vocabulary)) vocabCount += r.vocabulary.length;
      if (typeof r.summary === "string" && r.summary.trim().length > 0) summariesCompleted += 1;
      const qs = r.quiz_stats as { score?: number; total?: number } | null;
      if (qs && typeof qs.total === "number" && qs.total > 0) {
        rcTotal += qs.total;
        rcScore += qs.score ?? 0;
        quizzesAttempted += 1;
      }
    }
    const rcAccuracy = rcTotal ? Math.round((rcScore / rcTotal) * 100) : 0;

    // Streak (consecutive days back from today)
    const days = new Set((logRows ?? []).map((r: any) => r.read_date));
    let streak = 0;
    const d = new Date();
    while (days.has(d.toISOString().slice(0, 10))) {
      streak += 1;
      d.setUTCDate(d.getUTCDate() - 1);
    }

    // Monthly progress (last 30 days)
    const monthly: { date: string; count: number }[] = [];
    const counts: Record<string, number> = {};
    for (const r of logRows ?? []) counts[(r as any).read_date] = (counts[(r as any).read_date] ?? 0) + 1;
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const dd = new Date(today);
      dd.setUTCDate(today.getUTCDate() - i);
      const key = dd.toISOString().slice(0, 10);
      monthly.push({ date: key.slice(5), count: counts[key] ?? 0 });
    }

    return {
      totalArticles: total ?? 0,
      vocabCount,
      streak,
      monthly,
      summariesCompleted,
      rcAccuracy,
      quizzesAttempted,
    };
  });
