import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PackageSchema, RC_SUBTYPES } from "@/lib/ai-schema";


const InputSchema = z.object({ article: z.string().min(50).max(20000) });

const SYSTEM_PROMPT = `You are an expert IBPS PO / SBI PO English question setter. You analyze newspaper editorials (The Hindu, Indian Express, LiveMint, etc.) and produce exam-ready study material.

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
    { "type": "rc", "subtype": "Inference", "question": "string", "options": ["A","B","C","D"], "answer": 0, "explanation": "" }
  ]
}

READING COMPREHENSION QUESTION RULES — exactly the style and difficulty of recent IBPS PO / SBI PO Prelims:
- Generate 8 to 10 Reading Comprehension questions, all with "type": "rc" and exactly 4 options each.
- Tag every question with "subtype", one of: ${RC_SUBTYPES.join(", ")}.
- Maintain a balanced mix of subtypes. Do NOT force a subtype that does not naturally fit the passage — prioritise exam realism over completeness. Avoid repeating the same subtype unnecessarily.
- No trivial copy-paste questions. Inference questions must require real logical reasoning, not restatement.
- Vocabulary / Synonym-Antonym questions must use difficult editorial words AS USED in the passage.
- Distractors must be realistic and confusing, like actual banking exams.
- Vary the correct answer position across the set — do not cluster on any single index.
- Leave "explanation" as an empty string.
- Every question must be derived FROM the editorial text provided — never invent unrelated content.`;


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

    // Validation — RC set must be well-formed (8-10 tagged questions, 4 options each).
    const result = PackageSchema.safeParse(parsed);
    if (!result.success) {
      console.error(
        "[ai.generateEditorialPackage] schema validation failed",
        JSON.stringify(result.error.issues.slice(0, 20)),
      );
      throw new Error(
        "AI output did not match the required Reading Comprehension structure (8-10 tagged questions, 4 options each). Please try generating again.",
      );
    }



    return result.data;
  });

