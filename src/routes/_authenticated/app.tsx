import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateEditorialPackage } from "@/lib/ai.functions";
import { saveArticle, listArticles, getArticle, deleteArticle, getDashboardStats } from "@/lib/articles.functions";
import { exportArticlePDF, exportVocabPDF, exportNotesPDF, printArticle, type ArticlePackage } from "@/lib/export";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppPage,
});

type Tab = "dashboard" | "generate" | "history" | "editorial" | "vocab" | "quiz" | "flashcards";

function AppPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [current, setCurrent] = useState<ArticlePackage | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const d = localStorage.getItem("fbh-dark") === "1";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("fbh-dark", next ? "1" : "0");
    document.documentElement.classList.toggle("dark", next);
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  };

  const openArticle = (a: ArticlePackage) => {
    setCurrent(a);
    setTab("editorial");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <div className="fbh-top-strip">
        <div>📅 {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        <div>🎯 SBI PO 2026 Prep</div>
      </div>
      <header className="fbh-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="fbh-logo-badge">FB</div>
          <div style={{ lineHeight: 1.15 }}>
            <strong style={{ display: "block", fontFamily: "var(--f-display)", fontSize: 19, fontWeight: 700 }}>Future Banker Hub</strong>
            <small style={{ fontSize: 10, fontWeight: 600, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".8px" }}>AI Editorial Learning Platform</small>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="fbh-tag fbh-tag-ibps">IBPS PO</span>
          <span className="fbh-tag fbh-tag-sbi">SBI PO</span>
          <span className="fbh-tag fbh-tag-eng">English</span>
          <button onClick={toggleDark} className="fbh-btn" style={{ width: 36, height: 36, padding: 0, justifyContent: "center", borderRadius: "50%" }}>{dark ? "☀️" : "🌙"}</button>
          <button onClick={signOut} className="fbh-btn">Sign out</button>
        </div>
      </header>

      <main className="fbh-wrap">
        <nav className="fbh-tabs">
          <button className={`fbh-tab ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>📊 Dashboard</button>
          <button className={`fbh-tab ${tab === "generate" ? "active" : ""}`} onClick={() => setTab("generate")}>🤖 AI Generator</button>
          <button className={`fbh-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>🗂️ History</button>
          <button className={`fbh-tab ${tab === "editorial" ? "active" : ""}`} onClick={() => setTab("editorial")} disabled={!current}>📰 Editorial</button>
          <button className={`fbh-tab ${tab === "vocab" ? "active" : ""}`} onClick={() => setTab("vocab")} disabled={!current}>📚 Vocabulary</button>
          <button className={`fbh-tab ${tab === "quiz" ? "active" : ""}`} onClick={() => setTab("quiz")} disabled={!current}>📝 Quiz</button>
          <button className={`fbh-tab ${tab === "flashcards" ? "active" : ""}`} onClick={() => setTab("flashcards")} disabled={!current}>🎴 Flashcards</button>
        </nav>

        {tab === "dashboard" && <DashboardView onOpen={openArticle} onGenerate={() => setTab("generate")} />}
        {tab === "generate" && <GeneratorView onGenerated={openArticle} />}
        {tab === "history" && <HistoryView onOpen={openArticle} />}
        {tab === "editorial" && current && <EditorialView a={current} />}
        {tab === "vocab" && current && <VocabView a={current} />}
        {tab === "quiz" && current && <QuizView a={current} />}
        {tab === "flashcards" && current && <FlashcardView a={current} />}
      </main>
    </div>
  );
}

/* ────────── DASHBOARD ────────── */
function DashboardView({ onOpen, onGenerate }: { onOpen: (a: ArticlePackage) => void; onGenerate: () => void }) {
  const statsFn = useServerFn(getDashboardStats);
  const listFn = useServerFn(listArticles);
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => statsFn() });
  const recent = useQuery({ queryKey: ["articles"], queryFn: () => listFn() });
  const getFn = useServerFn(getArticle);

  return (
    <div>
      <div className="fbh-meta-row">
        <span className="fbh-meta-badge">Dashboard</span>
        <span className="fbh-meta-dot" /> <span>Your study at a glance</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 22 }}>
        <div className="fbh-stat-card">
          <div className="fbh-stat-val">{stats.data?.totalArticles ?? "—"}</div>
          <div className="fbh-stat-label">Total Articles Read</div>
        </div>
        <div className="fbh-stat-card" style={{ borderLeftColor: "var(--blue2)" }}>
          <div className="fbh-stat-val" style={{ color: "var(--blue2)" }}>{stats.data?.vocabCount ?? "—"}</div>
          <div className="fbh-stat-label">Vocabulary Learned</div>
        </div>
        <div className="fbh-stat-card" style={{ borderLeftColor: "var(--green)" }}>
          <div className="fbh-stat-val" style={{ color: "var(--green)" }}>{stats.data?.streak ?? "—"} 🔥</div>
          <div className="fbh-stat-label">Reading Streak (days)</div>
        </div>
        <div className="fbh-stat-card" style={{ borderLeftColor: "var(--purple)" }}>
          <div className="fbh-stat-val" style={{ color: "var(--purple)" }}>{(stats.data?.monthly ?? []).reduce((s, d) => s + d.count, 0)}</div>
          <div className="fbh-stat-label">This Month</div>
        </div>
      </div>

      <div className="fbh-section-title">📈 Monthly Progress (Last 30 Days)</div>
      <div className="fbh-glass" style={{ padding: 16, marginBottom: 28, height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats.data?.monthly ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-c)" />
            <XAxis dataKey="date" stroke="var(--ink4)" fontSize={11} />
            <YAxis stroke="var(--ink4)" fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "var(--paper)", border: "1px solid var(--border-c)", borderRadius: 8 }} />
            <Line type="monotone" dataKey="count" stroke="#c0392b" strokeWidth={2.5} dot={{ r: 3, fill: "#c0392b" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="fbh-section-title">🆕 Recent Articles</div>
      {recent.data && recent.data.length === 0 && (
        <div className="fbh-glass" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📰</div>
          <div style={{ fontFamily: "var(--f-display)", fontSize: 18, marginBottom: 6 }}>No articles yet</div>
          <p style={{ color: "var(--ink4)", fontSize: 13, marginBottom: 16 }}>Generate your first editorial package to start your prep.</p>
          <button className="fbh-btn-primary" onClick={onGenerate}>✨ Generate Now</button>
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {recent.data?.slice(0, 6).map((r: any) => (
          <button key={r.id} onClick={async () => { const full = await getFn({ data: { id: r.id } }); onOpen(full as any); }} className="fbh-glass" style={{ padding: 14, textAlign: "left", cursor: "pointer", border: "1px solid var(--border-c)" }}>
            <div style={{ fontFamily: "var(--f-display)", fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{r.title}</div>
            <div style={{ fontSize: 12, color: "var(--ink4)" }}>{new Date(r.created_at).toLocaleString()} · {(r.vocabulary as any[])?.length ?? 0} words · {(r.quiz as any[])?.length ?? 0} questions</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ────────── GENERATOR ────────── */
function GeneratorView({ onGenerated }: { onGenerated: (a: ArticlePackage) => void }) {
  const [text, setText] = useState("");
  const [progress, setProgress] = useState("");
  const qc = useQueryClient();
  const genFn = useServerFn(generateEditorialPackage);
  const saveFn = useServerFn(saveArticle);

  const gen = useMutation({
    mutationFn: async () => {
      setProgress("Analyzing article with AI…");
      const pkg = await genFn({ data: { article: text } });
      setProgress("Saving to your library…");
      const saved = await saveFn({
        data: {
          title: pkg.title || text.slice(0, 60),
          full_article: text,
          summary: pkg.summary ?? "",
          theme: pkg.theme ?? "",
          tone: pkg.tone ?? "",
          conclusion: pkg.conclusion ?? "",
          takeaways: pkg.takeaways ?? [],
          vocabulary: pkg.vocabulary ?? [],
          sbi_notes: pkg.sbi_notes ?? [],
          quiz: pkg.quiz ?? [],
        },
      });
      return saved as unknown as ArticlePackage;
    },
    onSuccess: (a) => {
      toast.success("Editorial package ready!");
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      setText("");
      setProgress("");
      onGenerated(a);
    },
    onError: (e: any) => { setProgress(""); toast.error(e.message ?? "Generation failed"); },
  });

  return (
    <div>
      <div className="fbh-meta-row">
        <span className="fbh-meta-badge">AI Generator</span>
        <span className="fbh-meta-dot" /> <span>Powered by Gemini · Save & study forever</span>
      </div>

      <div className="fbh-glass" style={{ padding: 22, marginBottom: 22 }}>
        <h2 style={{ fontFamily: "var(--f-display)", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>🤖 AI Editorial Package Generator</h2>
        <p style={{ color: "var(--ink3)", fontSize: 14, marginBottom: 16 }}>Paste any newspaper editorial (The Hindu, Indian Express, ET, etc.) and get a complete SBI PO study package in ~30 seconds.</p>

        <textarea className="fbh-textarea" placeholder="Paste your editorial here… (minimum 100 words recommended)" value={text} onChange={(e) => setText(e.target.value)} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <button className="fbh-btn-primary" disabled={gen.isPending || text.trim().length < 50} onClick={() => gen.mutate()}>
            {gen.isPending ? <span className="fbh-spinner" /> : "✨"}
            {gen.isPending ? "Generating…" : "Generate Editorial Package"}
          </button>
          {progress && <span style={{ color: "var(--ink3)", fontSize: 13 }}>{progress}</span>}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink4)" }}>{text.trim().split(/\s+/).filter(Boolean).length} words</span>
        </div>
      </div>

      <div className="fbh-section-title">📦 What you'll get</div>
      <div className="fbh-info-cards">
        {[
          ["✅ Editorial", "Summary · Theme · Tone · Conclusion"],
          ["✅ Vocabulary", "Hindi · English · Synonyms · Usage"],
          ["✅ SBI PO Notes", "Exam-focused vocabulary insights"],
          ["✅ Quiz", "RC · Vocab · Cloze · Error · OWS"],
        ].map(([l, v]) => (
          <div key={l} className="fbh-info-card">
            <div className="fbh-info-label">{l}</div>
            <div className="fbh-info-val">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────── HISTORY ────────── */
function HistoryView({ onOpen }: { onOpen: (a: ArticlePackage) => void }) {
  const listFn = useServerFn(listArticles);
  const getFn = useServerFn(getArticle);
  const delFn = useServerFn(deleteArticle);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["articles"], queryFn: () => listFn() });
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");

  const filtered = useMemo(() => {
    return (list.data ?? []).filter((a: any) => {
      if (q && !a.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (date && !a.created_at.startsWith(date)) return false;
      return true;
    });
  }, [list.data, q, date]);

  const remove = async (id: string) => {
    if (!confirm("Delete this article permanently?")) return;
    await delFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["articles"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    toast.success("Deleted");
  };

  return (
    <div>
      <div className="fbh-meta-row">
        <span className="fbh-meta-badge">History</span>
        <span className="fbh-meta-dot" /> <span>{list.data?.length ?? 0} saved articles</span>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input className="fbh-input" placeholder="🔍 Search by title…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <input type="date" className="fbh-input" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 200 }} />
        {(q || date) && <button className="fbh-btn" onClick={() => { setQ(""); setDate(""); }}>Clear</button>}
      </div>

      {list.isLoading && <p>Loading…</p>}
      {filtered.length === 0 && !list.isLoading && (
        <div className="fbh-glass" style={{ padding: 32, textAlign: "center", color: "var(--ink4)" }}>No articles match your filters.</div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((a: any) => (
          <div key={a.id} className="fbh-glass" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1, cursor: "pointer" }} onClick={async () => onOpen((await getFn({ data: { id: a.id } })) as any)}>
              <div style={{ fontFamily: "var(--f-display)", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{a.title}</div>
              <div style={{ fontSize: 12, color: "var(--ink4)", marginTop: 2 }}>
                {new Date(a.created_at).toLocaleString()} · {(a.vocabulary as any[])?.length ?? 0} words · {(a.quiz as any[])?.length ?? 0} questions
              </div>
            </div>
            <button className="fbh-btn" onClick={async () => onOpen((await getFn({ data: { id: a.id } })) as any)}>Open</button>
            <button className="fbh-btn" onClick={() => remove(a.id)} style={{ color: "var(--fbh-accent)" }}>🗑</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────── EDITORIAL VIEW ────────── */
function EditorialView({ a }: { a: ArticlePackage }) {
  return (
    <div>
      <div className="fbh-meta-row">
        <span className="fbh-meta-badge">Editorial</span>
        <span className="fbh-meta-dot" />
        <span>{a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}</span>
        <span className="fbh-meta-dot" />
        <span>Future Banker Hub</span>
      </div>

      <div className="fbh-article-header">
        <div className="fbh-article-label">📰 Editorial Vocabulary</div>
        <h1>{a.title}</h1>
        <p style={{ fontSize: 13, color: "var(--ink3)" }}>By Future Banker Hub</p>
      </div>

      {(a.theme || a.tone) && (
        <div className="fbh-info-cards">
          {a.theme && <div className="fbh-info-card"><div className="fbh-info-label">🎯 Main Theme</div><div className="fbh-info-val">{a.theme}</div></div>}
          {a.tone && <div className="fbh-info-card"><div className="fbh-info-label">🎨 Editorial Tone</div><div className="fbh-info-val">{a.tone}</div></div>}
        </div>
      )}

      {a.summary && (
        <div className="fbh-summary-box">
          <div className="fbh-summary-title">📋 Editorial Summary</div>
          <p>{a.summary}</p>
        </div>
      )}

      {a.takeaways?.length > 0 && (
        <>
          <div className="fbh-section-title">💡 Key Takeaways</div>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, marginBottom: 22, padding: 0 }}>
            {a.takeaways.map((t, i) => (
              <li key={i} className="fbh-takeaway"><span className="fbh-tk-num">0{i + 1}</span><span>{t}</span></li>
            ))}
          </ul>
        </>
      )}

      <div className="fbh-section-title">📖 Full Editorial</div>
      <div className="fbh-editorial-body">
        {a.full_article.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
      </div>

      {a.conclusion && (
        <div className="fbh-conclusion-box">
          <div className="fbh-conclusion-title">📌 Conclusion</div>
          <p>{a.conclusion}</p>
        </div>
      )}

      <div className="fbh-section-title">📤 Export</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="fbh-btn" onClick={() => exportArticlePDF(a)}>📄 Export PDF</button>
        <button className="fbh-btn" onClick={() => exportVocabPDF(a)}>📚 Vocabulary PDF</button>
        <button className="fbh-btn" onClick={() => exportNotesPDF(a)}>📓 Notes PDF</button>
        <button className="fbh-btn" onClick={() => printArticle(a)}>🖨 Print</button>
      </div>
    </div>
  );
}

/* ────────── VOCAB ────────── */
function VocabView({ a }: { a: ArticlePackage }) {
  return (
    <div>
      <div className="fbh-meta-row">
        <span className="fbh-meta-badge">Vocabulary</span>
        <span className="fbh-meta-dot" /> <span>{a.vocabulary?.length ?? 0} words</span>
      </div>
      <div className="fbh-section-title">📚 Vocabulary List</div>
      <div className="fbh-table-wrap">
        <table className="fbh-vocab-table">
          <thead><tr><th>#</th><th>Word</th><th>POS</th><th>Hindi</th><th>English</th><th>Synonyms</th></tr></thead>
          <tbody>
            {a.vocabulary?.map((v, i) => (
              <tr key={i}>
                <td style={{ color: "var(--ink4)", fontFamily: "var(--f-mono)" }}>{i + 1}</td>
                <td className="fbh-vt-word">{v.word}</td>
                <td><span className="fbh-vt-pos">{v.pos}</span></td>
                <td style={{ color: "var(--ink2)", fontWeight: 600 }}>{v.hindi}</td>
                <td style={{ color: "var(--ink3)" }}>{v.english}</td>
                <td style={{ fontSize: 12, color: "var(--ink4)", fontStyle: "italic" }}>{v.synonyms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {a.sbi_notes?.length > 0 && (
        <>
          <div className="fbh-section-title">🏦 SBI PO Vocabulary Notes</div>
          <div>
            {a.sbi_notes.map((n, i) => (
              <div key={i} className="fbh-sbi-note">
                <div className="fbh-sbi-word">{n.word}</div>
                <div>{n.note}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="fbh-btn" onClick={() => exportVocabPDF(a)}>📥 Export Vocabulary PDF</button>
      </div>
    </div>
  );
}

/* ────────── QUIZ ────────── */
function QuizView({ a }: { a: ArticlePackage }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<Record<number, boolean>>({});
  const q = a.quiz?.[idx];

  const choose = (i: number) => {
    if (picked != null) return;
    setPicked(i);
    if (i === q!.answer && !answered[idx]) {
      setScore((s) => s + 1);
      setAnswered({ ...answered, [idx]: true });
    }
  };
  const next = () => { setPicked(null); setIdx((i) => Math.min(i + 1, (a.quiz?.length ?? 1) - 1)); };
  const prev = () => { setPicked(null); setIdx((i) => Math.max(0, i - 1)); };

  if (!a.quiz || a.quiz.length === 0) return <p style={{ color: "var(--ink4)" }}>No quiz available.</p>;

  return (
    <div>
      <div className="fbh-meta-row">
        <span className="fbh-meta-badge">Quiz</span>
        <span className="fbh-meta-dot" />
        <span>Question {idx + 1} of {a.quiz.length}</span>
        <span className="fbh-meta-dot" />
        <span>Score: {score}/{a.quiz.length}</span>
      </div>

      <div className="fbh-glass" style={{ padding: 22 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--fbh-accent)", background: "rgba(192,57,43,.08)", padding: "4px 10px", borderRadius: 20, marginBottom: 12 }}>
          {q!.type.toUpperCase()} · Q{idx + 1}
        </div>
        <div style={{ fontFamily: "var(--f-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", lineHeight: 1.6, marginBottom: 16 }}>{q!.question}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q!.options.map((o, i) => {
            const cls = picked == null ? "" : i === q!.answer ? "correct" : i === picked ? "wrong" : "";
            return (
              <button key={i} className={`fbh-q-opt ${cls}`} onClick={() => choose(i)} disabled={picked != null}>
                <span className="fbh-q-label">{String.fromCharCode(65 + i)}</span>
                <span style={{ flex: 1, fontSize: 14, color: "var(--ink2)" }}>{o}</span>
              </button>
            );
          })}
        </div>
        {picked != null && q!.explanation && (
          <div style={{ marginTop: 14, padding: "14px 16px", background: "var(--blue-bg)", border: "1px solid #bfdbfe", borderRadius: 10, fontSize: 13, color: "var(--ink2)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--blue2)", marginBottom: 4 }}>💡 Explanation</div>
            {q!.explanation}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
          <button className="fbh-btn" onClick={prev} disabled={idx === 0}>← Previous</button>
          <button className="fbh-btn-primary" onClick={next} disabled={idx === a.quiz.length - 1}>Next →</button>
        </div>
      </div>
    </div>
  );
}
