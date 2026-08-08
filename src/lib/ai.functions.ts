import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  PackageSchema,

  QuizQuestionSchema,
  StudySchema,
  RC_SUBTYPES,
  REQUIRED_SECTIONS,
} from "@/lib/ai-schema";

const InputSchema = z.object({ article: z.string().min(50).max(20000) });

const BASE_PERSONA = `You are an expert IBPS PO Prelims English question setter with 15+ years of experience. You analyze newspaper editorials (The Hindu, Indian Express, LiveMint, etc.) and produce exam-ready practice material.

Generate ONLY IBPS PO PRELIMS level material. Never UPSC, CAT, SSC CGL or Banking Mains level. Difficulty, wording, traps and options must closely resemble the latest IBPS PO Prelims (2024-2025) memory-based papers.

Silently analyze the editorial first (theme, paragraph-wise ideas, facts, arguments, tone, vocabulary), then return ONLY valid JSON — no markdown, no commentary.`;

const STUDY_PROMPT = `${BASE_PERSONA}

Return JSON with exactly this shape:
{
  "title": "concise editorial title",
  "summary": "80-120 word summary",
  "theme": "one-line main theme",
  "tone": "author's tone",
  "conclusion": "60-100 word conclusion",
  "takeaways": ["exactly 5 one-line takeaways"],
  "analysis": {
    "issue": "1-2 sentences on the core problem",
    "causes": ["exactly 3"],
    "effects": ["exactly 3"],
    "solutions": ["exactly 3"],
    "author_tone": "single line",
    "main_idea": "1-2 sentences",
    "one_line_summary": "single sentence",
    "best_title": "best title for the passage",
    "inferences": ["exactly 3"],
    "facts": ["exactly 5"]
  },
  "vocabulary": [ { "word": "", "pos": "noun|verb|adj|adv|phrase", "hindi": "", "english": "", "synonyms": "comma separated", "antonyms": "comma separated", "usage": "simple sentence", "editorial_sentence": "sentence from the editorial", "memory_trick": "short trick", "ibps_trap": "common IBPS trap" } ],  // exactly 10 words
  "sbi_notes": [ { "word": "", "note": "exam-focused tip" } ]  // 5-8 entries
}`;

const RC_PROMPT = `${BASE_PERSONA}

Return JSON: { "quiz": [ ... ] } with EXACTLY 10 Reading Comprehension questions, each:
{ "type": "rc", "subtype": "<one of the labels below>", "question": "", "options": ["A","B","C","D"], "answer": 0, "explanation": "detailed", "para_ref": "Paragraph 2", "difficulty": "Easy|Moderate|Difficult" }

Subtype counts (must total 10):
${RC_SUBTYPES.map((s) => `  - ${s}: ${s === "Inference Based" || s === "Statement Based" ? 2 : 1}`).join("\n")}

Rules: no copy-paste questions; tricky but fair options; exactly 4 options; exactly one correct answer; answerable ONLY from the passage; vary the correct-answer position.`;

const SECTIONS_PROMPT = `${BASE_PERSONA}

Return JSON: { "quiz": [ ... ] } with EXACTLY 20 questions in this order, each object shaped
{ "type": "", "question": "", "options": ["A","B","C","D"], "answer": 0, "explanation": "", "difficulty": "Easy|Moderate|Difficult" }:

A — "error" (5): Error Detection. Sentences inspired by the editorial split into 4 labelled parts as the options, one containing the error (subject-verb agreement, tenses, articles, prepositions, pronouns, modifiers, parallelism).
B — "cloze" (5): Single Fillers. One blank per sentence, four close-in-meaning options needing contextual understanding.
C — "word_rearrangement" (5): Word Swap. A sentence with marked words (A), (B), (C), (D); pick the pair to interchange to correct it.
D — "para_jumble" (5): Take 5 key ideas from the editorial as sentences labelled A-E, shuffle them once, and ask five questions on the SAME jumbled set (which is first, second, third, fourth, fifth). Restate the jumbled sentences inside each question so it is self-contained.

Every question needs exactly 4 options and an "answer" index 0-3. Vary the correct-answer position.`;

/** Best-effort repair of truncated/fenced JSON coming back from the model. */
function parseLoose(raw: string): unknown {
  let s = raw.trim();
  // strip markdown fences
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  if (start > 0) s = s.slice(start);
  try {
    return JSON.parse(s);
  } catch { /* try repair */ }

  // Drop a trailing incomplete token, then close open strings/brackets.
  let depthStack: string[] = [];
  let inStr = false;
  let esc = false;
  let lastSafe = -1; // index after last complete top-level-ish value
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depthStack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") { depthStack.pop(); lastSafe = i; }
    else if (c === ",") lastSafe = i;
  }

  const candidates: string[] = [];
  const closeAll = (str: string) => {
    // recompute open brackets for this truncated slice
    const stack: string[] = [];
    let q = false, e = false;
    for (const c of str) {
      if (q) { if (e) e = false; else if (c === "\\") e = true; else if (c === '"') q = false; continue; }
      if (c === '"') q = true;
      else if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if (c === "}" || c === "]") stack.pop();
    }
    let out = str;
    if (q) out += '"';
    out = out.replace(/,\s*$/, "");
    while (stack.length) out += stack.pop();
    return out;
  };

  candidates.push(closeAll(s));
  if (lastSafe > 0) candidates.push(closeAll(s.slice(0, lastSafe)));

  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch { /* next */ }
  }
  throw new Error("AI returned malformed JSON.");
}

async function callGatewayOnce(apiKey: string, system: string, user: string, maxTokens: number) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
    }),
  });

  if (resp.status === 429) throw new Error("Rate limit exceeded. Please wait a moment and try again.");
  if (resp.status === 402) throw new Error("AI credits exhausted. Please add credits in your workspace.");
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("[ai] gateway error", resp.status, text.slice(0, 500));
    throw new Error("AI request failed. Please try again.");
  }

  const json: any = await resp.json();
  const choice = json?.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new Error("AI returned an empty response.");
  if (typeof content !== "string") return content;
  try {
    return JSON.parse(content);
  } catch {
    console.warn("[ai] loose-parsing model output", { finish: choice?.finish_reason, len: content.length });
    return parseLoose(content);
  }
}

async function callGateway(apiKey: string, system: string, user: string, maxTokens: number) {
  try {
    return await callGatewayOnce(apiKey, system, user, maxTokens);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    // Only retry on parse/empty issues, never on rate limit / credits.
    if (!/malformed JSON|empty response/i.test(msg)) throw err;
    console.warn("[ai] retrying after", msg);
    return await callGatewayOnce(
      apiKey,
      `${system}\n\nIMPORTANT: Keep every string short. Return ONLY compact, complete, valid JSON. Never truncate.`,
      user,
      maxTokens,
    );
  }
}


/** Keep only structurally valid questions instead of failing the whole batch. */
function cleanQuiz(raw: unknown) {
  const list = Array.isArray((raw as any)?.quiz) ? (raw as any).quiz : [];
  const out: z.infer<typeof QuizQuestionSchema>[] = [];
  for (const q of list) {
    const parsed = QuizQuestionSchema.safeParse(q);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export const generateEditorialPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured. Please contact support.");

    const user = `Editorial:\n\n${data.article}`;

    // Three smaller parallel calls instead of one 30-question mega-call:
    // faster, and it stops the response from being truncated mid-JSON.
    const [studyRaw, rcRaw, sectionsRaw] = await Promise.all([
      callGateway(apiKey, STUDY_PROMPT, user, 8000),
      callGateway(apiKey, RC_PROMPT, user, 12000),
      callGateway(apiKey, SECTIONS_PROMPT, user, 14000),
    ]);

    const study = StudySchema.safeParse(studyRaw);
    if (!study.success) {
      console.error("[ai] study validation failed", JSON.stringify(study.error.issues.slice(0, 10)));
      throw new Error("AI analysis came back incomplete. Please try generating again.");
    }

    const rc = cleanQuiz(rcRaw).filter((q) => q.type === "rc");
    const others = cleanQuiz(sectionsRaw).filter((q) => q.type !== "rc");

    // Cap each section to its required count; keep whatever the model produced otherwise.
    const bySection: Record<string, typeof rc> = { rc };
    for (const q of others) (bySection[q.type] ??= []).push(q);

    const quiz: typeof rc = [];
    for (const [type, required] of Object.entries(REQUIRED_SECTIONS)) {
      quiz.push(...(bySection[type] ?? []).slice(0, required));
    }

    if (quiz.length < 20) {
      console.error("[ai] too few usable questions", quiz.length, Object.fromEntries(Object.entries(bySection).map(([k, v]) => [k, v.length])));
      throw new Error("AI produced too few usable questions. Please try generating again.");
    }

    const result = PackageSchema.safeParse({ ...study.data, quiz });
    if (!result.success) {
      console.error("[ai] package validation failed", JSON.stringify(result.error.issues.slice(0, 10)));
      throw new Error("AI output could not be assembled. Please try generating again.");
    }

    return result.data;
  });




