import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEditorials from "./tools/list-editorials";
import getEditorial from "./tools/get-editorial";
import getVocabulary from "./tools/get-vocabulary";
import getQuizQuestions from "./tools/get-quiz-questions";
import getStudyStats from "./tools/get-study-stats";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "firstjob-banker-mcp",
  title: "FirstJob Banker",
  version: "0.1.0",
  instructions:
    "Tools for FirstJob Banker, an SBI PO exam preparation workspace. Use list_editorials to find the user's saved editorial studies, get_editorial for the full analysis of one, get_vocabulary for word lists with Hindi and English meanings, get_quiz_questions for practice questions, and get_study_stats for overall progress.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listEditorials, getEditorial, getVocabulary, getQuizQuestions, getStudyStats],
});
