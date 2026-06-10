import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — FirstJob Banker" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  const onGoogle = async () => {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/app" });
    if (r.error) { toast.error(r.error.message); setBusy(false); return; }
    if (r.redirected) return;
    navigate({ to: "/app", replace: true });
  };

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app", replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, var(--paper) 0%, var(--paper2) 100%)" }}>
      <div className="fbh-glass w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="fbh-logo-badge">FB</div>
          <div>
            <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 20, color: "var(--ink)" }}>Future Banker Hub</div>
            <div style={{ fontSize: 11, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".8px" }}>AI Editorial Platform</div>
          </div>
        </div>

        <h1 style={{ fontFamily: "var(--f-display)", fontSize: 24, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p style={{ color: "var(--ink4)", fontSize: 13, marginBottom: 20 }}>
          {mode === "signin" ? "Sign in to continue your SBI PO prep." : "Start preparing for SBI PO 2026 today."}
        </p>

        <button onClick={onGoogle} disabled={busy} className="fbh-btn w-full justify-center mb-4" style={{ padding: "11px 14px", fontSize: 14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "var(--ink4)", fontSize: 11, fontWeight: 600 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border-c)" }} />
          OR
          <div style={{ flex: 1, height: 1, background: "var(--border-c)" }} />
        </div>

        <form onSubmit={onEmail} className="space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="fbh-input" />
          <input type="password" required minLength={6} placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} className="fbh-input" />
          <button type="submit" disabled={busy} className="fbh-btn-primary w-full justify-center">
            {busy ? <span className="fbh-spinner" /> : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} style={{ marginTop: 16, width: "100%", textAlign: "center", color: "var(--ink3)", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
