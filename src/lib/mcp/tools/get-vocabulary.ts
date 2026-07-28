import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_vocabulary",
  title: "Get vocabulary",
  description:
    "Get vocabulary words (word, part of speech, Hindi and English meaning, synonyms, usage) from the user's saved editorials. Give an editorial id for one study, or omit it to pull recent words across studies.",
  inputSchema: {
    editorial_id: z.string().uuid().optional().describe("Editorial id to pull vocabulary from."),
    limit: z.number().int().min(1).max(20).optional().describe("How many recent editorials to pull from when no id is given (default 5)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ editorial_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase.from("articles").select("id,title,vocabulary,created_at").order("created_at", { ascending: false });
    query = editorial_id ? query.eq("id", editorial_id) : query.limit(limit ?? 5);
    const { data, error } = await query;
    if (error) return failure(error.message);
    const words = (data ?? []).flatMap((row) =>
      (Array.isArray(row.vocabulary) ? row.vocabulary : []).map((w) => ({ editorial_id: row.id, title: row.title, ...(w as object) })),
    );
    return ok(words);
  },
});
