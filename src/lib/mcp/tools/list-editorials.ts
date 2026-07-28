import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_editorials",
  title: "List editorials",
  description:
    "List the signed-in user's saved editorial studies (newest first), with title, theme, tone and date. Optionally filter by a search term.",
  inputSchema: {
    search: z.string().optional().describe("Optional text to match against editorial titles."),
    limit: z.number().int().min(1).max(50).optional().describe("Maximum number of editorials to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let query = supabaseForUser(ctx)
      .from("articles")
      .select("id,title,theme,tone,summary,created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (search) query = query.ilike("title", `%${search}%`);
    const { data, error } = await query;
    if (error) return failure(error.message);
    return ok(data ?? []);
  },
});
