import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_editorial",
  title: "Get editorial study",
  description:
    "Fetch one saved editorial study by id, including its summary, structured analysis (issue, causes, effects, solutions), takeaways, SBI PO notes and quiz stats.",
  inputSchema: {
    id: z.string().uuid().describe("The editorial id returned by list_editorials."),
    include_full_text: z.boolean().optional().describe("Include the full pasted editorial text (default false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, include_full_text }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const cols =
      "id,title,theme,tone,summary,conclusion,takeaways,analysis,sbi_notes,quiz_stats,created_at" +
      (include_full_text ? ",full_article" : "");
    const { data, error } = await supabaseForUser(ctx).from("articles").select(cols).eq("id", id).maybeSingle();
    if (error) return failure(error.message);
    if (!data) return failure("No editorial found with that id.");
    return ok(data);
  },
});
