import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useReadingMode } from "@/hooks/use-reading-mode";
import { generateEditorialPackage } from "@/lib/ai.functions";
import { saveArticle, listArticles, getArticle, deleteArticle, getDashboardStats, saveQuizStats } from "@/lib/articles.functions";
import { exportArticlePDF, exportVocabPDF, exportNotesPDF, printArticle, type ArticlePackage } from "@/lib/export";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppPage,
});

type Tab = "dashboard" | "generate" | "history" | "editorial" | "vocab" | "quiz" | "flashcards";

function ReadingModeToggle() {
  const { mode, setMode } = useReadingMode();
  return (
    <div className="fbh-read-toolbar" role="group" aria-label="Text size">
      <button className={mode === "normal" ? "active" : ""} onClick={() => setMode("normal")} aria-pressed={mode === "normal"} aria-label="Normal text size">A</button>
      <button className={mode === "large" ? "active" : ""} onClick={() => setMode("large")} aria-pressed={mode === "large"} aria-label="Large text size" style={{ fontSize: 14 }}>A+</button>
    </div>
  );
}

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
    <div style={{ minHeight: "100dvh", background: "var(--paper)" }}>
      <div className="fbh-top-strip">
        <div>📅 {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        <div>🎯 SBI PO 2026 Prep</div>
      </div>
      <header className="fbh-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="fbh-logo-badge">FJ</div>
          <div style={{ lineHeight: 1.15 }}>
            <strong style={{ display: "block", fontFamily: "var(--f-display)", fontSize: 19, fontWeight: 700 }}>FirstJob Banker</strong>
            <small style={{ fontSize: 10, fontWeight: 600, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".8px" }}>From Aspirant to Banker</small>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="fbh-tag fbh-tag-ibps">IBPS PO</span>
          <span className="fbh-tag fbh-tag-sbi">SBI PO</span>
          <span className="fbh-tag fbh-tag-eng">English</span>
          <ReadingModeToggle />
          <button onClick={toggleDark} className="fbh-btn" style={{ width: 36, height: 36, padding: 0, justifyContent: "center", borderRadius: "50%" }} aria-label="Toggle dark mode">{dark ? "☀️" : "🌙"}</button>
          <button onClick={signOut} className="fbh-btn">Sign out</button>
        </div>
      </header>

      <main className="fbh-wrap">
        <nav className="fbh-tabs" role="tablist" aria-label="App sections">
          <button role="tab" aria-selected={tab === "dashboard"} className={`fbh-tab text-lg ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>📊 Dashboard</button>
          <button role="tab" aria-selected={tab === "generate"} className={`fbh-tab text-lg ${tab === "generate" ? "active" : ""}`} onClick={() => setTab("generate")}>🤖 AI Generator</button>
          <button role="tab" aria-selected={tab === "history"} className={`fbh-tab text-lg ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>🗂️ History</button>
          <button role="tab" aria-selected={tab === "editorial"} className={`fbh-tab text-lg ${tab === "editorial" ? "active" : ""}`} onClick={() => setTab("editorial")} disabled={!current}>📰 Editorial</button>
          <button role="tab" aria-selected={tab === "vocab"} className={`fbh-tab text-lg ${tab === "vocab" ? "active" : ""}`} onClick={() => setTab("vocab")} disabled={!current}>📚 Vocabulary</button>
          <button role="tab" aria-selected={tab === "quiz"} className={`fbh-tab text-lg ${tab === "quiz" ? "active" : ""}`} onClick={() => setTab("quiz")} disabled={!current}>📝 Quiz</button>
          <button role="tab" aria-selected={tab === "flashcards"} className={`fbh-tab text-lg ${tab === "flashcards" ? "active" : ""}`} onClick={() => setTab("flashcards")} disabled={!current}>🎴 Flashcards</button>
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
          <div className="fbh-stat-label">Editorials Studied</div>
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
          <div className="fbh-stat-val" style={{ color: "var(--purple)" }}>{stats.data?.summariesCompleted ?? "—"}</div>
          <div className="fbh-stat-label">Summaries Completed</div>
        </div>
        <div className="fbh-stat-card" style={{ borderLeftColor: "var(--fbh-accent)" }}>
          <div className="fbh-stat-val" style={{ color: "var(--fbh-accent)" }}>{stats.data?.rcAccuracy ?? 0}%</div>
          <div className="fbh-stat-label">RC / Quiz Accuracy</div>
        </div>
        <div className="fbh-stat-card" style={{ borderLeftColor: "var(--teal)" }}>
          <div className="fbh-stat-val" style={{ color: "var(--teal)" }}>{stats.data?.quizzesAttempted ?? 0}</div>
          <div className="fbh-stat-label">Quizzes Attempted</div>
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
            <Line type="monotone" dataKey="count" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3, fill: "#F59E0B" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="fbh-section-title">🆕 Recent Editorials</div>
      {recent.data && recent.data.length === 0 && (
        <div className="fbh-glass" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📰</div>
          <div style={{ fontFamily: "var(--f-display)", fontSize: 18, marginBottom: 6 }}>No editorials yet</div>
          <p style={{ color: "var(--ink4)", fontSize: 13, marginBottom: 16 }}>Paste your first editorial to build a full analysis, vocabulary and quiz.</p>
          <button className="fbh-btn-primary" onClick={onGenerate}>✨ Start Now</button>
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {recent.data?.slice(0, 6).map((r: any) => (
          <button key={r.id} onClick={async () => { const full = await getFn({ data: { id: r.id } }); onOpen(full as any); }} className="fbh-glass" style={{ padding: 14, textAlign: "left", cursor: "pointer", border: "1px solid var(--border-c)" }}>
            <div style={{ fontFamily: "var(--f-display)", fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{r.title}</div>
            <div style={{ fontSize: 12, color: "var(--ink4)" }}>{new Date(r.created_at).toLocaleString()} · {(r.vocabulary as any[])?.length ?? 0} words · {(r.quiz as any[])?.length ?? 0} questions{r.quiz_stats?.total ? ` · ${r.quiz_stats.accuracy ?? 0}% quiz` : ""}</div>
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
          analysis: pkg.analysis ?? { issue: "", causes: [], effects: [], solutions: [], author_tone: "", main_idea: "", one_line_summary: "" },
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

  const [showSample, setShowSample] = useState(false);

  return (
    <div>
      <div className="fbh-meta-row">
        <span className="fbh-meta-badge">AI Generator</span>
        <span className="fbh-meta-dot" /> <span>Powered by Gemini · Save & study forever</span>
      </div>

      <div className="fbh-glass" style={{ padding: 22, marginBottom: 22 }}>
        <h2 style={{ fontFamily: "var(--f-display)", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>🤖 AI Editorial Package Generator</h2>
        <p style={{ color: "var(--ink3)", fontSize: 14, marginBottom: 16 }}>Paste any newspaper editorial (The Hindu, Indian Express, ET, etc.) and get a complete SBI PO study package in ~30 seconds.</p>

        <textarea className="fbh-textarea" aria-label="Editorial text to analyze" placeholder="Paste your editorial here… (minimum 100 words recommended)" value={text} onChange={(e) => setText(e.target.value)} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <button className="fbh-btn-primary" disabled={gen.isPending || text.trim().length < 50} onClick={() => gen.mutate()}>
            {gen.isPending ? <span className="fbh-spinner" /> : "✨"}
            {gen.isPending ? "Generating…" : "Generate Editorial Package"}
          </button>
          <button type="button" className="fbh-btn" onClick={() => setShowSample((s) => !s)}>
            {showSample ? "Hide" : "📖 View"} Sample Breakdown
          </button>
          {progress && <span style={{ color: "var(--ink3)", fontSize: 13 }}>{progress}</span>}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink4)" }}>{text.trim().split(/\s+/).filter(Boolean).length} words</span>
        </div>
      </div>

      {showSample && <SampleBreakdown />}

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

function SampleBreakdown() {
  const vocab: [string, string, string][] = [
    ["Disintermediation", "The removal of intermediaries (banks) from financial transactions.", "Bypassing, Cutting out the middleman"],
    ["Frictionless", "Smooth, occurring without difficulty or resistance.", "Seamless, Effortless"],
    ["Double-edged sword", "Something that has both positive and negative consequences.", "Mixed blessing"],
    ["Wholesale funding", "Funds raised by banks from large institutional sources rather than retail deposits.", "Institutional borrowing"],
    ["Holding limits", "Caps placed on the maximum amount of CBDC an individual can hold.", "Ceilings, Caps"],
  ];
  return (
    <div className="fbh-glass" style={{ padding: 22, marginBottom: 22 }}>
      <h3 style={{ fontFamily: "var(--f-display)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>📖 Sample Editorial Breakdown</h3>
      <p style={{ fontSize: 12, color: "var(--ink4)", marginBottom: 14 }}>Reference format — this is the depth and structure you'll get from each generation.</p>

      <div style={{ display: "grid", gap: 14, fontSize: 13, lineHeight: 1.55 }}>
        <div>
          <div className="fbh-info-label">Topic</div>
          <div>Digital Currency Adoption and Banking Disintermediation</div>
        </div>
        <div>
          <div className="fbh-info-label">Central Idea</div>
          <div>While Central Bank Digital Currencies (CBDCs) enhance payment efficiency, rapid retail adoption risks pulling deposits away from commercial banks, altering monetary policy transmission and bank stability.</div>
        </div>
        <div>
          <div className="fbh-info-label">Key Vocabulary</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 11, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".5px" }}>
                <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>Word</th>
                <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>Meaning</th>
                <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>Synonyms</th>
              </tr>
            </thead>
            <tbody>
              {vocab.map(([w, m, s]) => (
                <tr key={w}>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)", fontWeight: 600 }}>{w}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>{m}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)", color: "var(--ink3)" }}>{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="fbh-info-label">3-Sentence Précis</div>
          <div>The introduction of retail CBDCs aims to modernize the financial ecosystem by providing a secure, digitized alternative to physical cash. However, this shift threatens the stable deposit base of commercial banks, potentially increasing their reliance on costlier wholesale funding. Consequently, policymakers must introduce holding limits to balance technological innovation with banking sector stability.</div>
        </div>
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
        <input className="fbh-input" aria-label="Search articles by title" placeholder="🔍 Search by title…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <input type="date" className="fbh-input" aria-label="Filter articles by date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 200 }} />
        {(q || date) && <button className="fbh-btn" onClick={() => { setQ(""); setDate(""); }}>Clear filters</button>}
      </div>

      {list.isLoading && <p>Loading…</p>}
      {filtered.length === 0 && !list.isLoading && (
        <div className="fbh-glass" style={{ padding: 32, textAlign: "center", color: "var(--ink4)" }}>No articles match your filters.</div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((a: any) => (
          <div key={a.id} className="fbh-glass" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{ flex: 1, cursor: "pointer" }}
              role="button"
              tabIndex={0}
              aria-label={`Open article: ${a.title}`}
              onClick={async () => onOpen((await getFn({ data: { id: a.id } })) as any)}
              onKeyDown={async (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen((await getFn({ data: { id: a.id } })) as any); } }}
            >
              <div style={{ fontFamily: "var(--f-display)", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{a.title}</div>
              <div style={{ fontSize: 12, color: "var(--ink4)", marginTop: 2 }}>
                {new Date(a.created_at).toLocaleString()} · {(a.vocabulary as any[])?.length ?? 0} words · {(a.quiz as any[])?.length ?? 0} questions
              </div>
            </div>
            <button className="fbh-btn" aria-label={`Open article: ${a.title}`} onClick={async () => onOpen((await getFn({ data: { id: a.id } })) as any)}>Open</button>
            <button className="fbh-btn" aria-label={`Delete article: ${a.title}`} onClick={() => remove(a.id)} style={{ color: "var(--fbh-accent)" }}>🗑</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────── EDITORIAL VIEW ────────── */
function EditorialView({ a }: { a: ArticlePackage }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [a.id]);

  const words = (a.full_article || "").trim().split(/\s+/).filter(Boolean).length;
  const readMin = Math.max(1, Math.round(words / 220));

  return (
    <div>
      <div className="fbh-read-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Reading progress"><div className="fbh-read-progress-fill" style={{ width: `${progress}%` }} /></div>

      <div className="fbh-meta-row">
        <span className="fbh-meta-badge">Editorial</span>
        <span className="fbh-meta-dot" />
        <span>{a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}</span>
        <span className="fbh-meta-dot" />
        <span>FirstJob Banker</span>
      </div>

      <div className="fbh-article-header">
        <div className="fbh-article-label">📰 Editorial Vocabulary</div>
        <h1>{a.title}</h1>
        <p style={{ fontSize: 13, color: "var(--ink3)" }}>By FirstJob Banker</p>
      </div>

      <div className="fbh-read-meta">
        <span className="pill">⏱ {readMin} min read</span>
        <span className="pill">📝 {words.toLocaleString()} words</span>
        <span className="pill">📚 {a.vocabulary?.length ?? 0} vocab words</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink4)" }}>Tap highlighted words for meaning</span>
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
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, marginBottom: 28, padding: 0 }}>
            {a.takeaways.map((t, i) => (
              <li key={i} className="fbh-takeaway"><span className="fbh-tk-num">0{i + 1}</span><span>{t}</span></li>
            ))}
          </ul>
        </>
      )}

      <AnalysisSection analysis={a.analysis} />

      <div className="fbh-section-title">📖 Full Editorial</div>
      <EditorialBody text={a.full_article} vocabulary={a.vocabulary ?? []} />

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

function EditorialBody({ text, vocabulary }: { text: string; vocabulary: ArticlePackage["vocabulary"] }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const close = () => setOpen(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const vocabMap = useMemo(() => {
    const m = new Map<string, ArticlePackage["vocabulary"][number]>();
    (vocabulary ?? []).forEach((v) => { if (v?.word) m.set(v.word.toLowerCase(), v); });
    return m;
  }, [vocabulary]);

  const renderParagraph = (para: string, pi: number) => {
    const parts = para.split(/(\b[\p{L}'-]+\b)/u);
    return (
      <p key={pi}>
        {parts.map((tok, i) => {
          const v = vocabMap.get(tok.toLowerCase());
          if (!v) return <span key={i}>{tok}</span>;
          const id = `${pi}-${i}`;
          const isOpen = open === id;
          return (
            <span
              key={i}
              className="fbh-vocab-pop"
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              aria-label={`Show meaning of ${v.word}`}
              onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : id); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen(isOpen ? null : id); } }}
            >
              {tok}
              {isOpen && (
                <span className="fbh-vocab-card" onClick={(e) => e.stopPropagation()}>
                  <h4>{v.word}</h4>
                  {v.english && <div className="row"><b>Meaning:</b> {v.english}</div>}
                  {v.hindi && <div className="row"><b>Hindi:</b> {v.hindi}</div>}
                  {v.synonyms && <div className="row"><b>Synonyms:</b> <i>{v.synonyms}</i></div>}
                </span>
              )}
            </span>
          );
        })}
      </p>
    );
  };

  return (
    <div className="fbh-editorial-body">
      {text.split(/\n+/).map((p, i) => renderParagraph(p, i))}
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

/* ────────── ANALYSIS ────────── */
function AnalysisSection({ analysis }: { analysis?: ArticlePackage["analysis"] }) {
  if (!analysis) return null;
  const { issue, causes, effects, solutions, author_tone, main_idea, one_line_summary } = analysis;
  const hasAny = issue || main_idea || one_line_summary || author_tone ||
    (causes?.length ?? 0) + (effects?.length ?? 0) + (solutions?.length ?? 0) > 0;
  if (!hasAny) return null;
  const List = ({ title, items, emoji }: { title: string; items?: string[]; emoji: string }) => (
    <div className="fbh-glass" style={{ padding: 16 }}>
      <div className="fbh-info-label" style={{ marginBottom: 8 }}>{emoji} {title}</div>
      <ol style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 14, lineHeight: 1.55 }}>
        {(items ?? []).map((x, i) => <li key={i}>{x}</li>)}
      </ol>
    </div>
  );
  return (
    <>
      <div className="fbh-section-title">🔎 Editorial Analysis</div>
      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {issue && (
          <div className="fbh-glass" style={{ padding: 16 }}>
            <div className="fbh-info-label" style={{ marginBottom: 6 }}>❗ Issue</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{issue}</p>
          </div>
        )}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
          <List title="Causes" items={causes} emoji="⚙️" />
          <List title="Effects" items={effects} emoji="📉" />
          <List title="Solutions" items={solutions} emoji="💡" />
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
          {main_idea && (
            <div className="fbh-glass" style={{ padding: 16 }}>
              <div className="fbh-info-label" style={{ marginBottom: 6 }}>🎯 Main Idea</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{main_idea}</p>
            </div>
          )}
          {author_tone && (
            <div className="fbh-glass" style={{ padding: 16 }}>
              <div className="fbh-info-label" style={{ marginBottom: 6 }}>🎨 Author's Tone</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{author_tone}</p>
            </div>
          )}
        </div>
        {one_line_summary && (
          <div className="fbh-summary-box">
            <div className="fbh-summary-title">📝 One-Line Summary</div>
            <p>{one_line_summary}</p>
          </div>
        )}
      </div>
    </>
  );
}

/* ────────── QUIZ ────────── */
function QuizView({ a }: { a: ArticlePackage }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();
  const saveStatsFn = useServerFn(saveQuizStats);
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

  const finish = async () => {
    if (!a.id || saved) return;
    try {
      await saveStatsFn({ data: { id: a.id, score, total: a.quiz.length } });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["articles"] });
      setSaved(true);
      toast.success(`Quiz saved · ${score}/${a.quiz.length}`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not save quiz stats");
    }
  };

  if (!a.quiz || a.quiz.length === 0) return <p style={{ color: "var(--ink4)" }}>No quiz available.</p>;

  const isLast = idx === a.quiz.length - 1;

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
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--fbh-accent)", background: "rgba(245,158,11,.08)", padding: "4px 10px", borderRadius: 20, marginBottom: 12 }}>
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
          <div role="status" style={{ marginTop: 14, padding: "14px 16px", background: "var(--blue-bg)", border: "1px solid #bfdbfe", borderRadius: 10, fontSize: 13, color: "var(--ink2)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--blue2)", marginBottom: 4 }}>💡 Explanation</div>
            {q!.explanation}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, gap: 8, flexWrap: "wrap" }}>
          <button className="fbh-btn" onClick={prev} disabled={idx === 0}>← Previous</button>
          {isLast ? (
            <button className="fbh-btn-primary" onClick={finish} disabled={saved}>
              {saved ? `✅ Saved · ${score}/${a.quiz.length}` : `🏁 Finish & Save · ${score}/${a.quiz.length}`}
            </button>
          ) : (
            <button className="fbh-btn-primary" onClick={next}>Next →</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────── FLASHCARDS ────────── */
function FlashcardView({ a }: { a: ArticlePackage }) {
  const allWords = a.vocabulary ?? [];
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("");

  const filteredWords = useMemo(() => {
    return allWords.filter((v) => {
      if (posFilter && v.pos !== posFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${v.word} ${v.hindi ?? ""} ${v.english ?? ""} ${v.synonyms ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allWords, search, posFilter]);

  useEffect(() => {
    setIdx(0);
    setFlipped(false);
  }, [search, posFilter]);

  useEffect(() => {
    setFlipped(false);
  }, [idx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); setFlipped((f) => !f); }
      if (e.code === "ArrowRight") next();
      if (e.code === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filteredWords.length]);

  const next = () => { setIdx((i) => Math.min(i + 1, filteredWords.length - 1)); };
  const prev = () => { setIdx((i) => Math.max(0, i - 1)); };
  const mark = (ok: boolean) => { setKnown({ ...known, [idx]: ok }); next(); };

  const posOptions = useMemo(() => {
    const set = new Set<string>();
    allWords.forEach((v) => { if (v.pos) set.add(v.pos); });
    return Array.from(set).sort();
  }, [allWords]);

  if (!allWords.length) return <p style={{ color: "var(--ink4)" }}>No vocabulary available.</p>;

  const mastered = Object.values(known).filter(Boolean).length;
  const v = filteredWords[idx];

  return (
    <div>
      <div className="fbh-meta-row">
        <span className="fbh-meta-badge">Flashcards</span>
        <span className="fbh-meta-dot" />
        <span>Card {Math.min(idx + 1, filteredWords.length)} of {filteredWords.length}</span>
        <span className="fbh-meta-dot" />
        <span>Mastered: {mastered}</span>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          className="fbh-input"
          aria-label="Search flashcards by word, meaning, or synonym"
          placeholder="🔍 Search word, meaning, synonym…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select
          className="fbh-input"
          aria-label="Filter by part of speech"
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value)}
          style={{ maxWidth: 180 }}
        >
          <option value="">All types</option>
          {posOptions.map((p) => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
        {(search || posFilter) && (
          <button className="fbh-btn" onClick={() => { setSearch(""); setPosFilter(""); }}>Clear</button>
        )}
      </div>

      {filteredWords.length === 0 ? (
        <div className="fbh-glass" style={{ padding: 32, textAlign: "center", color: "var(--ink4)" }}>
          No words match your filters.
        </div>
      ) : (
        <>
          <div className="fbh-progress-bar" role="progressbar" aria-valuenow={idx + 1} aria-valuemin={1} aria-valuemax={filteredWords.length} aria-label={`Card ${idx + 1} of ${filteredWords.length}`}><div className="fbh-progress-fill" style={{ width: `${((idx + 1) / filteredWords.length) * 100}%` }} /></div>

          <div
            className="fbh-flip-wrap"
            onClick={() => setFlipped(!flipped)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setFlipped(!flipped); } }}
            role="button"
            tabIndex={0}
            aria-label={flipped ? `Meaning shown for ${v.word}. Press Enter to flip back` : `Flashcard: ${v.word}. Press Enter to reveal meaning`}
          >
            <div className={`fbh-flip-card ${flipped ? "flipped" : ""}`}>
              <div className="fbh-flip-front">
                <div className="fbh-flip-badge">WORD</div>
                <div className="fbh-flip-word">{v.word}</div>
                {v.pos && <div className="fbh-flip-pos">{v.pos}</div>}
                <div className="fbh-flip-hint">Tap or press Space to flip</div>
              </div>
              <div className="fbh-flip-back">
                <div className="fbh-flip-badge">MEANING</div>
                {v.hindi && (
                  <div className="fbh-flip-hindi">{v.hindi}</div>
                )}
                {v.english && (
                  <div className="fbh-flip-meaning">{v.english}</div>
                )}
                {v.synonyms && (
                  <div style={{ marginTop: 10, fontSize: 13, color: "var(--ink4)" }}>
                    <span style={{ fontWeight: 700, color: "var(--ink3)" }}>Synonyms: </span>{v.synonyms}
                  </div>
                )}
                {v.usage && (
                  <div className="fbh-flip-usage">
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--teal)", marginBottom: 4 }}>Usage</div>
                    <em>{v.usage}</em>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <button className="fbh-btn" onClick={prev} disabled={idx === 0}>← Prev</button>
            <button className="fbh-btn" onClick={() => setFlipped(!flipped)}>{flipped ? "🙈 Hide" : "👁 Reveal"}</button>
            <button className="fbh-btn" onClick={next} disabled={idx === filteredWords.length - 1}>Next →</button>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 14 }}>
            <button className="fbh-btn" style={{ borderColor: "var(--green)", color: "var(--green)" }} onClick={() => mark(true)}>
              ✅ Know it
            </button>
            <button className="fbh-btn" style={{ borderColor: "var(--fbh-accent)", color: "var(--fbh-accent)" }} onClick={() => mark(false)}>
              🔁 Review again
            </button>
          </div>
        </>
      )}
    </div>
  );
}
