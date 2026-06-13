import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Mcq = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().optional().default(""),
});

const VocabEntry = z.object({
  word: z.string(),
  meaning: z.string().optional().default(""),
  hindi: z.string().optional().default(""),
  synonyms: z.string().optional().default(""),
  antonyms: z.string().optional().default(""),
  example: z.string().optional().default(""),
});

const GrammarNote = z.object({
  rule: z.string(),
  example: z.string().optional().default(""),
  common_error: z.string().optional().default(""),
});

const Analysis = z.object({
  issue: z.string().default(""),
  causes: z.array(z.string()).default([]),
  effects: z.array(z.string()).default([]),
  solutions: z.array(z.string()).default([]),
  author_tone: z.string().default(""),
  main_idea: z.string().default(""),
  one_line_summary: z.string().default(""),
});

const MissionPayload = z.object({
  title: z.string().min(1).max(500),
  source_text: z.string().min(1),
  summary: z.string().default(""),
  key_points: z.array(z.string()).default([]),
  difficulty: z.string().default(""),
  topic: z.string().default(""),
  analysis: Analysis.default({
    issue: "", causes: [], effects: [], solutions: [],
    author_tone: "", main_idea: "", one_line_summary: "",
  }),
  vocabulary: z.array(VocabEntry).default([]),
  rc_prelims: z.array(Mcq).default([]),
  rc_mains: z.array(Mcq).default([]),
  error_detection: z.array(Mcq).default([]),
  cloze: z.array(Mcq).default([]),
  sentence_improvement: z.array(Mcq).default([]),
  grammar_notes: z.array(GrammarNote).default([]),
});


const SYSTEM_PROMPT = `You are an expert SBI PO English coach. From a newspaper editorial, produce a complete daily practice mission.

Return ONLY valid JSON in this exact shape (no markdown):

{
  "title": "concise editorial title",
  "summary": "100-140 word summary",
  "key_points": ["5 bullet points covering the editorial"],
  "difficulty": "Easy | Moderate | Hard",
  "topic": "one-line topic category (e.g., Economy, Banking, Geopolitics)",
  "vocabulary": [
    { "word": "...", "meaning": "english meaning", "hindi": "hindi meaning", "synonyms": "comma list", "antonyms": "comma list", "example": "sentence from or based on editorial" }
  ], // EXACTLY 15 high-value words from the editorial
  "rc_prelims": [ { "question": "...", "options": ["A","B","C","D"], "answer": 0, "explanation": "..." } ], // EXACTLY 5 SBI PO Prelims-level RC questions
  "rc_mains":   [ { "question": "...", "options": ["A","B","C","D"], "answer": 0, "explanation": "..." } ], // EXACTLY 5 SBI PO Mains-level RC questions (inference / tone / assumption)
  "error_detection": [ { "question": "Sentence split into 4 parts (a)/(b)/(c)/(d) — find the error part", "options": ["(a)","(b)","(c)","(d)"], "answer": 0, "explanation": "..." } ], // EXACTLY 10
  "cloze": [ { "question": "Sentence with a ____ blank from editorial context", "options": ["...","...","...","..."], "answer": 0, "explanation": "..." } ], // EXACTLY 10
  "sentence_improvement": [ { "question": "Sentence with an underlined/bracketed part to improve", "options": ["...","...","...","No improvement"], "answer": 0, "explanation": "..." } ], // EXACTLY 10
  "grammar_notes": [ { "rule": "grammar rule observed in the editorial", "example": "line from editorial illustrating the rule", "common_error": "typical SBI PO trap" } ] // 4-6 entries
}

All questions must be at SBI PO level. Keep options crisp and unambiguous.`;

const SECTION_KEYS = [
  "editorial",
  "vocabulary",
  "rc",
  "error_detection",
  "cloze",
  "sentence_improvement",
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

function logAndThrow(op: string, error: unknown): never {
  console.error(`[mission.${op}]`, error);
  throw new Error(`Unable to ${op}. Please try again.`);
}

export const generateDailyMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ article: z.string().min(50).max(20000) }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured. Please contact support.");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Editorial:\n\n${data.article}\n\nReturn the full mission JSON now.` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) throw new Error("Rate limit exceeded. Please wait and retry.");
    if (resp.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("[mission.generate] gateway error", resp.status, text);
      throw new Error("AI request failed. Please try again.");
    }

    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI returned an empty response.");
    try {
      return typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      throw new Error("AI returned malformed JSON.");
    }
  });

export const saveDailyMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MissionPayload.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("daily_missions")
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) logAndThrow("save mission", error);
    return row;
  });

export const listDailyMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("daily_missions")
      .select("id,title,topic,difficulty,mission_date,created_at,progress")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) logAndThrow("load missions", error);
    return data ?? [];
  });

export const getDailyMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("daily_missions").select("*").eq("id", data.id).single();
    if (error) logAndThrow("load mission", error);
    return row;
  });

export const deleteDailyMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("daily_missions").delete().eq("id", data.id);
    if (error) logAndThrow("delete mission", error);
    return { ok: true };
  });

const SectionProgress = z.object({
  completed: z.boolean().default(true),
  score: z.number().int().min(0).default(0),
  total: z.number().int().min(0).default(0),
  accuracy: z.number().min(0).max(100).default(0),
  time_taken_sec: z.number().int().min(0).default(0),
});

export const updateSectionProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      section: z.enum(SECTION_KEYS),
      progress: SectionProgress,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error: getErr } = await supabase
      .from("daily_missions").select("progress").eq("id", data.id).single();
    if (getErr) logAndThrow("update progress", getErr);
    const prev = (row?.progress ?? {}) as Record<string, unknown>;
    const next = { ...prev, [data.section]: data.progress };
    const { error } = await supabase
      .from("daily_missions").update({ progress: next as never }).eq("id", data.id);
    if (error) logAndThrow("update progress", error);
    return { ok: true };
  });
