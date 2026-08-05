import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({ article: z.string().min(50).max(20000) });

const SYSTEM_PROMPT = `You are an expert SBI PO English coach. You analyze newspaper editorials and produce exam-ready study material.

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):

{
  "title": "string - concise editorial title",
  "summary": "string - 80-120 word editorial summary",
  "theme": "string - one-line main theme",
  "tone": "string - editorial tone (e.g. Analytical, Critical, Cautionary)",
  "conclusion": "string - 60-100 word conclusion",
  "takeaways": ["string", ...] // 4-6 bullet key takeaways,
  "analysis": {
    "issue": "1-2 sentence statement of the core problem the editorial addresses",
    "causes": ["exactly 3 root causes drawn from the editorial"],
    "effects": ["exactly 3 consequences or impacts discussed"],
    "solutions": ["exactly 3 solutions, reforms, or recommendations"],
    "author_tone": "single line (e.g. Analytical, Critical, Cautionary, Optimistic)",
    "main_idea": "1-2 sentence main idea of the editorial",
    "one_line_summary": "single sentence summarising the entire editorial"
  },
  "vocabulary": [
    { "word": "string", "pos": "noun|verb|adj|adv|phrase", "hindi": "string", "english": "string - english meaning", "synonyms": "comma separated", "usage": "string - example sentence" }
  ], // 12-20 high-value words from the article
  "sbi_notes": [
    { "word": "string", "note": "string - SBI PO exam-focused tip about this word" }
  ], // 5-8 entries
  "quiz": [
    { "type": "rc|cloze|error|double_fillers|para_jumble", "question": "string", "options": ["A","B","C","D"], "answer": 0, "explanation": "string - one line" }
  ]
}

QUIZ RULES — IBPS PO / SBI PO PRELIMS level, moderate difficulty:
Generate EXACTLY 15 questions in total. NEVER generate more than 15, regardless of editorial length. Do not produce a large question bank.

Exact distribution (15 total):
- "rc" (Reading Comprehension, from the editorial): 6
  · 1 main idea / gist question
  · 2 inference-based questions (implied, not directly stated)
  · 1 specific detail / fact recall question
  · 2 contextual vocabulary questions (synonym/antonym of a word AS USED in this passage)
- "cloze": 3 — pick ONE 4-6 sentence chunk from the editorial, remove 3 words and replace them with numbered blanks (1), (2), (3). Each of the 3 questions covers one blank and repeats the chunk with the blanks shown. Distractors must be grammatically or contextually close but wrong.
- "error" (Error Detection): 3 — take 3 sentences from the editorial (or lightly reworded), split each into parts (A)(B)(C)(D) shown in the question text; options are the four parts, and at least ONE of the 3 questions must use "No error" as the correct option. Errors: subject-verb agreement, tense, preposition, article, or parallelism.
- "double_fillers" (Fillers): 2 — take 2 sentences from the editorial, blank out 1-2 key words each; 4 options testing grammar/contextual fit.
- "para_jumble": 1 — pick 5 consecutive sentences from the editorial, present them jumbled as labelled sentences, and ask for the correct sequence with 4 different ordering options.

Every question must be derived FROM the editorial text provided — never invent unrelated content. Each question must have exactly 4 options, a 0-based "answer" index, and a brief one-line explanation.`;

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

    // Hard cap: keep at most the required count per section, 15 questions total.
    if (Array.isArray(parsed?.quiz)) {
      const seen: Record<string, number> = {};
      parsed.quiz = parsed.quiz.filter((q: any) => {
        const t = String(q?.type ?? "");
        const max = (QUIZ_DISTRIBUTION as Record<string, number>)[t] ?? 0;
        if (max === 0) return false;
        seen[t] = (seen[t] ?? 0) + 1;
        return seen[t] <= max;
      }).slice(0, QUIZ_TOTAL);
    }
    return parsed;
  });
