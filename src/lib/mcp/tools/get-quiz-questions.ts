import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_quiz_questions",
  title: "Get quiz questions",
  description:
    "Get the practice questions (RC, vocabulary, cloze, error detection, one-word substitution) generated for a saved editorial, with options, answers and explanations.",
  inputSchema: {
    editorial_id: z.string().uuid().describe("Editorial id returned by list_editorials."),
    type: z.enum(["rc", "vocab", "cloze", "error", "ows"]).optional().describe("Filter to a single question type."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ editorial_id, type }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("articles")
      .select("id,title,quiz")
      .eq("id", editorial_id)
      .maybeSingle();
    if (error) return failure(error.message);
    if (!data) return failure("No editorial found with that id.");
    let quiz = (Array.isArray(data.quiz) ? data.quiz : []) as Array<Record<string, unknown>>;
    if (type) quiz = quiz.filter((q) => q.type === type);
    return ok({ editorial_id: data.id, title: data.title, questions: quiz });
  },
});
