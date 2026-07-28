import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="fbh-glass max-w-md p-8 text-center" style={{ color: "var(--ink)" }}>
        Could not load this authorization request: {String((error as Error)?.message ?? error)}
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as any;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "this app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, var(--paper) 0%, var(--paper2) 100%)" }}
    >
      <div className="fbh-glass w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="fbh-logo-badge">FJ</div>
          <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 18, color: "var(--ink)" }}>
            FirstJob Banker
          </div>
        </div>
        <h1 style={{ fontFamily: "var(--f-display)", fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
          Connect {clientName} to your account
        </h1>
        <p style={{ color: "var(--ink4)", fontSize: 14, margin: "10px 0 20px" }}>
          {clientName} will be able to read your saved editorials, vocabulary, quizzes and study progress as you.
        </p>
        {error ? (
          <p role="alert" style={{ color: "crimson", fontSize: 13, marginBottom: 12 }}>
            {error}
          </p>
        ) : null}
        <div className="flex gap-3">
          <button disabled={busy} onClick={() => decide(true)} className="fbh-btn-primary flex-1 justify-center">
            Approve
          </button>
          <button disabled={busy} onClick={() => decide(false)} className="fbh-btn flex-1 justify-center">
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
