import { defineTool } from "@lovable.dev/mcp-js";
import { ok, supabaseForUser, unauthenticated, failure } from "../supabase";

export default defineTool({
  name: "get_study_stats",
  title: "Get study stats",
  description:
    "Get the signed-in user's overall preparation progress: editorials studied, vocabulary words learned, quizzes attempted and average quiz accuracy.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("articles")
      .select("id,vocabulary,quiz_stats,created_at")
      .order("created_at", { ascending: false });
    if (error) return failure(error.message);
    const rows = data ?? [];
    let vocab = 0;
    let attempted = 0;
    let correct = 0;
    let total = 0;
    for (const r of rows) {
      vocab += Array.isArray(r.vocabulary) ? r.vocabulary.length : 0;
      const s = (r.quiz_stats ?? {}) as { correct?: number; total?: number };
      if (typeof s.total === "number" && s.total > 0) {
        attempted += 1;
        correct += s.correct ?? 0;
        total += s.total;
      }
    }
    return ok({
      editorials_studied: rows.length,
      vocabulary_learned: vocab,
      quizzes_attempted: attempted,
      quiz_accuracy_percent: total ? Math.round((correct / total) * 100) : 0,
      last_studied_at: rows[0]?.created_at ?? null,
    });
  },
});
