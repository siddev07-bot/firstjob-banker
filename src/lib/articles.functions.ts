import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { QUIZ_TYPES } from "@/lib/quiz-types";

const VocabEntry = z.object({
  word: z.string(),
  pos: z.string().optional().default("noun"),
  hindi: z.string().optional().default(""),
  english: z.string().optional().default(""),
  synonyms: z.union([z.string(), z.array(z.string())]).optional().default("").transform((v) => (Array.isArray(v) ? v.join(", ") : v)),
  antonyms: z.union([z.string(), z.array(z.string())]).optional().default("").transform((v) => (Array.isArray(v) ? v.join(", ") : v)),
  usage: z.string().optional().default(""),
  editorial_sentence: z.string().optional().default(""),
  memory_trick: z.string().optional().default(""),
  ibps_trap: z.string().optional().default(""),
});
const SbiNote = z.object({ word: z.string(), note: z.string().optional().default("") });
const QuizQ = z.object({
  type: z.enum(QUIZ_TYPES).catch("vocab").default("vocab"),
  subtype: z.string().optional().default(""),
  question: z.string(),
  options: z.array(z.string()).min(2),
  answer: z.coerce.number().int().min(0).catch(0).default(0),
  explanation: z.string().optional().default(""),
  para_ref: z.string().optional().default(""),
  difficulty: z.string().optional().default(""),
});

/** AI output is best-effort: drop malformed entries instead of failing the whole save. */
function lenientArray<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (v) => (Array.isArray(v) ? v.filter((item) => schema.safeParse(item).success) : []),
    z.array(schema).default([]),
  );
}
const StringList = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((s) => typeof s === "string") : []),
  z.array(z.string()).default([]),
);


const Analysis = z.object({
  issue: z.string().catch("").default(""),
  causes: StringList,
  effects: StringList,
  solutions: StringList,
  author_tone: z.string().catch("").default(""),
  main_idea: z.string().catch("").default(""),
  one_line_summary: z.string().catch("").default(""),
  best_title: z.string().catch("").default(""),
  inferences: StringList,
  facts: StringList,
}).catch({
  issue: "", causes: [], effects: [], solutions: [],
  author_tone: "", main_idea: "", one_line_summary: "",
  best_title: "", inferences: [], facts: [],
}).default({
  issue: "", causes: [], effects: [], solutions: [],
  author_tone: "", main_idea: "", one_line_summary: "",
  best_title: "", inferences: [], facts: [],
});

const SavePayload = z.object({
  title: z.string().min(1).max(500),
  full_article: z.string().min(1),
  summary: z.string().optional().default(""),
  theme: z.string().optional().default(""),
  tone: z.string().optional().default(""),
  conclusion: z.string().optional().default(""),
  takeaways: StringList,
  analysis: Analysis,
  vocabulary: lenientArray(VocabEntry),
  sbi_notes: lenientArray(SbiNote),
  quiz: lenientArray(QuizQ),
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

/* ────────── QUIZ PROGRESS (persistent) ────────── */

const AnswerEntry = z.object({
  picked: z.number().int().min(0),
  correct: z.boolean(),
  type: z.string().default("vocab"),
});

const SaveProgress = z.object({
  articleId: z.string().uuid(),
  answers: z.record(z.string(), AnswerEntry),
  total: z.number().int().min(0),
  timeSpentSeconds: z.number().int().min(0).default(0),
  completed: z.boolean().default(false),
});

export const getQuizProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ articleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("quiz_attempts")
      .select("*")
      .eq("article_id", data.articleId)
      .maybeSingle();
    if (error) logAndThrow("load quiz progress", error);
    return row ?? null;
  });

export const saveQuizProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveProgress.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const entries = Object.values(data.answers);
    const attempted = entries.length;
    const score = entries.filter((e) => e.correct).length;
    const accuracy = attempted ? Math.round((score / attempted) * 100) : 0;
    const now = new Date().toISOString();

    const { data: row, error } = await supabase
      .from("quiz_attempts")
      .upsert(
        {
          user_id: userId,
          article_id: data.articleId,
          answers: data.answers as never,
          attempted,
          score,
          total: data.total,
          time_spent_seconds: data.timeSpentSeconds,
          completed: data.completed || (data.total > 0 && attempted >= data.total),
          last_attempted_at: now,
        },
        { onConflict: "user_id,article_id" },
      )
      .select()
      .single();
    if (error) logAndThrow("save quiz progress", error);

    const { error: statErr } = await supabase
      .from("articles")
      .update({
        quiz_stats: { score, total: data.total, attempted, accuracy, at: now } as never,
      })
      .eq("id", data.articleId);
    if (statErr) logAndThrow("save quiz progress", statErr);

    return row;
  });

export const resetQuizProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ articleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("quiz_attempts").delete().eq("article_id", data.articleId);
    if (error) logAndThrow("reset quiz", error);
    const { error: e2 } = await supabase
      .from("articles")
      .update({ quiz_stats: {} as never })
      .eq("id", data.articleId);
    if (e2) logAndThrow("reset quiz", e2);
    return { ok: true };
  });

export const listQuizProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("quiz_attempts")
      .select("article_id,score,attempted,total,completed,time_spent_seconds,last_attempted_at")
      .order("last_attempted_at", { ascending: false });
    if (error) logAndThrow("load quiz progress", error);
    return data ?? [];
  });

export const getQuizAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: attempts, error }, { data: articles }, { data: logRows }] = await Promise.all([
      supabase.from("quiz_attempts").select("*").order("last_attempted_at", { ascending: false }),
      supabase.from("articles").select("id,title,quiz"),
      supabase.from("reading_log").select("read_date").eq("user_id", userId).order("read_date", { ascending: false }).limit(730),
    ]);
    if (error) logAndThrow("load analytics", error);

    const titleById = new Map((articles ?? []).map((a) => [a.id, a.title]));
    const quizLenById = new Map(
      (articles ?? []).map((a) => [a.id, Array.isArray(a.quiz) ? a.quiz.length : 0]),
    );

    const sections: Record<string, { attempted: number; correct: number }> = {};
    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalTime = 0;

    const perEditorial = (attempts ?? []).map((row) => {
      const answers = (row.answers ?? {}) as Record<string, { correct?: boolean; type?: string }>;
      for (const entry of Object.values(answers)) {
        const key = entry?.type ?? "vocab";
        const s = (sections[key] ??= { attempted: 0, correct: 0 });
        s.attempted += 1;
        if (entry?.correct) s.correct += 1;
      }
      totalQuestions += row.attempted;
      totalCorrect += row.score;
      totalTime += row.time_spent_seconds;
      const total = row.total || quizLenById.get(row.article_id) || 0;
      return {
        articleId: row.article_id,
        title: titleById.get(row.article_id) ?? "Untitled editorial",
        date: row.last_attempted_at,
        total,
        attempted: row.attempted,
        correct: row.score,
        wrong: row.attempted - row.score,
        accuracy: row.attempted ? Math.round((row.score / row.attempted) * 100) : 0,
        completed: row.completed,
        timeSpentSeconds: row.time_spent_seconds,
      };
    });

    const sectionStats = Object.entries(sections).map(([type, s]) => ({
      type,
      attempted: s.attempted,
      correct: s.correct,
      wrong: s.attempted - s.correct,
      accuracy: s.attempted ? Math.round((s.correct / s.attempted) * 100) : 0,
    }));

    // Streaks from reading log
    const days = Array.from(new Set((logRows ?? []).map((r) => r.read_date))).sort();
    let best = 0;
    let run = 0;
    let prev: Date | null = null;
    for (const d of days) {
      const cur = new Date(`${d}T00:00:00Z`);
      run = prev && (cur.getTime() - prev.getTime()) / 86400000 === 1 ? run + 1 : 1;
      if (run > best) best = run;
      prev = cur;
    }
    const daySet = new Set(days);
    let streak = 0;
    const walker = new Date();
    while (daySet.has(walker.toISOString().slice(0, 10))) {
      streak += 1;
      walker.setUTCDate(walker.getUTCDate() - 1);
    }

    return {
      overall: {
        editorialsAttempted: perEditorial.length,
        questionsSolved: totalQuestions,
        correct: totalCorrect,
        wrong: totalQuestions - totalCorrect,
        accuracy: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
        timeSpentSeconds: totalTime,
        streak,
        bestStreak: best,
      },
      sections: sectionStats,
      editorials: perEditorial,
    };
  });
