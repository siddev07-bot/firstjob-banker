import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PackageSchema, RC_SUBTYPES, REQUIRED_SECTIONS } from "@/lib/ai-schema";


const InputSchema = z.object({ article: z.string().min(50).max(20000) });

const SYSTEM_PROMPT = `You are an expert IBPS PO Prelims English question setter with 15+ years of experience. You analyze newspaper editorials (The Hindu, Indian Express, LiveMint, etc.) and produce exam-ready practice material.

Generate ONLY IBPS PO PRELIMS level questions. Never UPSC, CAT, SSC CGL or Banking Mains level. Difficulty, wording, traps and options must closely resemble the latest IBPS PO Prelims (2024-2025) memory-based papers.

STEP 1 — silently analyze the editorial: main theme, central idea, paragraph-wise summary, facts, opinions, arguments, cause & effect, examples, data, vocabulary, tone, inferences. Do not output this analysis stage separately; use it to build the material.

STEP 2 — return ONLY valid JSON matching this exact schema (no markdown, no commentary):

{
  "title": "string - concise editorial title",
  "summary": "string - 80-120 word editorial summary",
  "theme": "string - one-line main theme",
  "tone": "string - author's tone",
  "conclusion": "string - 60-100 word conclusion",
  "takeaways": ["string", ...],  // exactly 5 one-line takeaways
  "analysis": {
    "issue": "1-2 sentence statement of the core problem",
    "causes": ["exactly 3 root causes from the editorial"],
    "effects": ["exactly 3 consequences discussed"],
    "solutions": ["exactly 3 solutions or recommendations"],
    "author_tone": "single line",
    "main_idea": "1-2 sentences",
    "one_line_summary": "single sentence",
    "best_title": "string - best title for the passage",
    "inferences": ["exactly 3 important inferences"],
    "facts": ["exactly 5 important facts from the passage"]
  },
  "vocabulary": [
    { "word": "string", "pos": "noun|verb|adj|adv|phrase", "hindi": "string", "english": "string", "synonyms": "comma separated", "antonyms": "comma separated", "usage": "simple sentence", "editorial_sentence": "the sentence from the editorial where the word appears", "memory_trick": "short trick to remember", "ibps_trap": "common IBPS trap with this word" }
  ], // exactly 10 important words from the article
  "sbi_notes": [ { "word": "string", "note": "exam-focused tip" } ], // 5-8 entries
  "quiz": [
    { "type": "rc", "subtype": "Inference Based", "question": "string", "options": ["A","B","C","D"], "answer": 0, "explanation": "detailed explanation", "para_ref": "Paragraph 2", "difficulty": "Moderate" }
  ] // EXACTLY 30 questions, see distribution below
}

QUIZ — EXACTLY 30 questions, in this order and with these exact counts:

SECTION A — READING COMPREHENSION ("type": "rc", 10 questions). Use these subtypes with exactly these counts:
${RC_SUBTYPES.map((s) => `  - ${s}: ${s === "Inference Based" || s === "Statement Based" ? 2 : 1}`).join("\n")}
  Rules: no direct copy-paste questions; tricky but fair options; exactly 4 options; one correct answer; answerable ONLY from the passage; no outside knowledge. Give a detailed explanation, a "para_ref" (e.g. "Paragraph 3") and a difficulty (Easy / Moderate / Difficult).

SECTION B — ERROR DETECTION ("type": "error", 5 questions). Sentences inspired by the editorial, split into 4 labelled parts as the options (A/B/C/D), one containing the error. Focus on subject-verb agreement, tenses, articles, prepositions, pronouns, conjunctions, modifiers, parallelism. IBPS PO Prelims level only.

SECTION C — SINGLE FILLERS ("type": "cloze", 5 questions). One blank per sentence, four close-in-meaning options requiring contextual understanding.

SECTION D — WORD SWAP ("type": "word_rearrangement", 5 questions). IBPS pattern: a sentence with marked words (A), (B), (C), (D); the candidate picks the pair that must be interchanged to correct the sentence. Only one correct arrangement.

SECTION E — PARA JUMBLE ("type": "para_jumble", 5 questions). Take 5-6 key ideas from the editorial as sentences labelled A-F, shuffle them once, and ask five questions on the SAME jumbled set: which is the first, second, third, fourth and fifth sentence. Restate the jumbled sentences inside each question so it is self-contained, and give the correct sequence plus reasoning in the explanation.

QUALITY RULES:
- Follow the latest IBPS PO Prelims 2025 trend; output must be indistinguishable from actual memory-based IBPS papers.
- Avoid repetitive questions and obvious options; wrong options must be believable; use banking exam language; maintain moderate difficulty overall.
- Prioritise inference, statement based, incorrect statement, vocabulary in context, situation based, para jumble and error detection.
- Before finalising, score every question for IBPS PO Prelims similarity out of 10 and silently regenerate any question below 8/10 (or any question that feels UPSC, CAT, SSC CGL, Mains or AI-generated) until it matches. Do not output the scores.
- Every question must have exactly 4 options and an "answer" index of 0-3. Vary the correct answer position across the set.`;


export const generateEditorialPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured. Please contact support.");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyze this article and return the JSON package:\n\n${data.article}` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 32000,
      }),
    });

    if (resp.status === 429) throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    if (resp.status === 402) throw new Error("AI credits exhausted. Please add credits in your workspace.");
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("[ai.generateEditorialPackage] gateway error", resp.status, text);
      throw new Error("AI request failed. Please try again.");
    }

    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI returned an empty response.");

    let parsed: any;
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      throw new Error("AI returned malformed JSON.");
    }

    const result = PackageSchema.safeParse(parsed);
    if (!result.success) {
      console.error(
        "[ai.generateEditorialPackage] schema validation failed",
        JSON.stringify(result.error.issues.slice(0, 20)),
      );
      throw new Error(
        "AI output did not match the required 30-question IBPS PO Prelims structure. Please try generating again.",
      );
    }

    // Hard-fail unless the exact section distribution is present.
    const counts: Record<string, number> = {};
    for (const q of result.data.quiz) counts[q.type] = (counts[q.type] ?? 0) + 1;
    const mismatch = Object.entries(REQUIRED_SECTIONS).filter(([type, n]) => (counts[type] ?? 0) !== n);
    if (mismatch.length) {
      console.error("[ai.generateEditorialPackage] distribution mismatch", counts);
      throw new Error(
        "AI output did not match the required section distribution (10 RC, 5 Error Detection, 5 Single Fillers, 5 Word Swap, 5 Para Jumble). Please try generating again.",
      );
    }

    return result.data;
  });


