import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useReadingMode } from "@/hooks/use-reading-mode";
import {
  generateDailyMission,
  saveDailyMission,
  listDailyMissions,
  getDailyMission,
  deleteDailyMission,
  updateSectionProgress,
} from "@/lib/mission.functions";

function ReadingModeToggle() {
  const { mode, setMode } = useReadingMode();
  return (
    <div className="fbh-read-toolbar" role="group" aria-label="Text size">
      <button className={mode === "normal" ? "active" : ""} onClick={() => setMode("normal")} aria-pressed={mode === "normal"} aria-label="Normal text size">A</button>
      <button className={mode === "large" ? "active" : ""} onClick={() => setMode("large")} aria-pressed={mode === "large"} aria-label="Large text size" style={{ fontSize: 14 }}>A+</button>
    </div>
  );
}


export const Route = createFileRoute("/_authenticated/mission")({
  component: MissionPage,
});

type Mcq = { question: string; options: string[]; answer: number; explanation?: string };
type Vocab = { word: string; meaning: string; hindi: string; synonyms: string; antonyms: string; example: string };
type GrammarNote = { rule: string; example: string; common_error: string };
type Analysis = {
  issue: string;
  causes: string[];
  effects: string[];
  solutions: string[];
  author_tone: string;
  main_idea: string;
  one_line_summary: string;
};
type Mission = {
  id: string;
  title: string;
  source_text: string;
  summary: string;
  key_points: string[];
  difficulty: string;
  topic: string;
  analysis?: Analysis;
  vocabulary: Vocab[];
  rc_prelims: Mcq[];
  rc_mains: Mcq[];
  error_detection: Mcq[];
  cloze: Mcq[];
  sentence_improvement: Mcq[];
  grammar_notes: GrammarNote[];
  progress: Record<string, SectionProgress>;
  created_at: string;
  mission_date: string;
};
type SectionProgress = { completed: boolean; score: number; total: number; accuracy: number; time_taken_sec: number };
type SectionKey = "editorial" | "analysis" | "vocabulary" | "rc" | "error_detection" | "cloze" | "sentence_improvement";

const SECTIONS: { key: SectionKey; label: string; minutes: number; emoji: string }[] = [
  { key: "editorial", label: "Editorial Reading", minutes: 20, emoji: "📰" },
  { key: "analysis", label: "Editorial Analysis", minutes: 10, emoji: "🧠" },
  { key: "vocabulary", label: "Vocabulary", minutes: 8, emoji: "📚" },
  { key: "rc", label: "Reading Comprehension", minutes: 12, emoji: "🔍" },
  { key: "error_detection", label: "Error Detection", minutes: 8, emoji: "✂️" },
  { key: "cloze", label: "Cloze Test", minutes: 8, emoji: "🧩" },
  { key: "sentence_improvement", label: "Sentence Improvement", minutes: 8, emoji: "✏️" },
];


function MissionPage() {
  const [current, setCurrent] = useState<Mission | null>(null);
  const [view, setView] = useState<"home" | "input" | "play">("home");

  return (
    <div style={{ minHeight: "100dvh", background: "var(--paper)" }}>
      <header className="fbh-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link to="/app" className="fbh-btn" style={{ padding: "6px 10px" }}>← Back</Link>
          <div className="fbh-logo-badge">FJ</div>
          <div style={{ lineHeight: 1.15 }}>
            <strong style={{ display: "block", fontFamily: "var(--f-display)", fontSize: 18, fontWeight: 700 }}>Daily Editorial Mission</strong>
            <small style={{ fontSize: 10, fontWeight: 600, color: "var(--ink4)", textTransform: "uppercase", letterSpacing: ".8px" }}>One editorial · Full SBI PO session</small>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ReadingModeToggle />
          <button className="fbh-btn-primary" onClick={() => { setCurrent(null); setView("input"); }}>+ New Mission</button>
        </div>
      </header>

      <main className="fbh-wrap" style={{ maxWidth: 920 }}>
        {view === "input" && <InputView onCreated={(m) => { setCurrent(m); setView("play"); }} onCancel={() => setView("home")} />}
        {view === "play" && current && <PlayView mission={current} onChange={setCurrent} onExit={() => setView("home")} />}
        {view === "home" && <HomeView onOpen={(m) => { setCurrent(m); setView("play"); }} onNew={() => setView("input")} />}
      </main>
    </div>
  );
}

/* ─────────── HOME ─────────── */
function HomeView({ onOpen, onNew }: { onOpen: (m: Mission) => void; onNew: () => void }) {
  const listFn = useServerFn(listDailyMissions);
  const getFn = useServerFn(getDailyMission);
  const delFn = useServerFn(deleteDailyMission);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["missions"], queryFn: () => listFn() });

  const remove = async (id: string) => {
    if (!confirm("Delete this mission?")) return;
    await delFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["missions"] });
    toast.success("Deleted");
  };

  const today = list.data?.[0] as any;
  const todayDate = new Date().toISOString().slice(0, 10);
  const hasToday = today?.mission_date === todayDate;

  return (
    <div>
      <div className="fbh-meta-row">
        <span className="fbh-meta-badge">Today</span>
        <span className="fbh-meta-dot" /> <span>Convert one editorial into a full SBI PO English session</span>
      </div>

      {!hasToday && (
        <div className="fbh-glass" style={{ padding: 22, marginBottom: 22, textAlign: "center" }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>🎯</div>
          <h2 style={{ fontFamily: "var(--f-display)", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Start today's mission</h2>
          <p style={{ color: "var(--ink3)", fontSize: 14, marginBottom: 14 }}>Paste any newspaper editorial. We'll build vocabulary, RC, error detection, cloze, sentence improvement & grammar notes — all timed.</p>
          <button className="fbh-btn-primary" onClick={onNew}>+ New Daily Mission</button>
        </div>
      )}

      <div className="fbh-section-title">📋 Recent Missions</div>
      {list.isLoading && <p>Loading…</p>}
      {!list.isLoading && (list.data ?? []).length === 0 && (
        <div className="fbh-glass" style={{ padding: 24, textAlign: "center", color: "var(--ink4)" }}>No missions yet.</div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {(list.data ?? []).map((m: any) => {
          const prog = (m.progress ?? {}) as Record<string, SectionProgress>;
          const done = SECTIONS.filter((s) => prog[s.key]?.completed).length;
          return (
            <div key={m.id} className="fbh-glass" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--f-display)", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{m.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink4)", marginTop: 2 }}>
                  {m.mission_date} · {m.topic || "—"} · {m.difficulty || "—"} · {done}/{SECTIONS.length} done
                </div>
              </div>
              <button className="fbh-btn-primary" aria-label={`Open mission: ${m.title}`} onClick={async () => onOpen((await getFn({ data: { id: m.id } })) as unknown as Mission)}>Open</button>
              <button className="fbh-btn" aria-label={`Delete mission: ${m.title}`} onClick={() => remove(m.id)}>Delete</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── INPUT ─────────── */
function InputView({ onCreated, onCancel }: { onCreated: (m: Mission) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const [step, setStep] = useState("");
  const genFn = useServerFn(generateDailyMission);
  const saveFn = useServerFn(saveDailyMission);
  const qc = useQueryClient();

  const gen = useMutation({
    mutationFn: async () => {
      setStep("Analyzing editorial with AI…");
      const pkg = await genFn({ data: { article: text } });
      setStep("Saving mission…");
      const saved = await saveFn({
        data: {
          title: pkg.title || text.slice(0, 80),
          source_text: text,
          summary: pkg.summary ?? "",
          key_points: pkg.key_points ?? [],
          difficulty: pkg.difficulty ?? "",
          topic: pkg.topic ?? "",
          analysis: pkg.analysis ?? { issue: "", causes: [], effects: [], solutions: [], author_tone: "", main_idea: "", one_line_summary: "" },
          vocabulary: pkg.vocabulary ?? [],
          rc_prelims: pkg.rc_prelims ?? [],
          rc_mains: pkg.rc_mains ?? [],
          error_detection: pkg.error_detection ?? [],
          cloze: pkg.cloze ?? [],
          sentence_improvement: pkg.sentence_improvement ?? [],
          grammar_notes: pkg.grammar_notes ?? [],
        },
      });
      return saved as unknown as Mission;
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      toast.success("Mission ready!");
      setStep("");
      onCreated(m);
    },
    onError: (e: any) => { setStep(""); toast.error(e?.message ?? "Failed"); },
  });

  return (
    <div className="fbh-glass" style={{ padding: 22, marginBottom: 22 }}>
      <h2 style={{ fontFamily: "var(--f-display)", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>📰 New Daily Editorial</h2>
      <p style={{ color: "var(--ink3)", fontSize: 14, marginBottom: 14 }}>Paste the full editorial text below. Minimum ~150 words recommended.</p>
      <textarea
        className="fbh-textarea"
        aria-label="Editorial text for daily mission"
        placeholder="Paste editorial text here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ minHeight: 220 }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button className="fbh-btn-primary" disabled={gen.isPending || text.trim().length < 80} onClick={() => gen.mutate()}>
          {gen.isPending ? <span className="fbh-spinner" /> : "🚀"} {gen.isPending ? "Generating…" : "Generate Mission"}
        </button>
        <button className="fbh-btn" onClick={onCancel} disabled={gen.isPending}>Cancel</button>
        {step && <span style={{ color: "var(--ink3)", fontSize: 13 }}>{step}</span>}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink4)" }}>{text.trim().split(/\s+/).filter(Boolean).length} words</span>
      </div>
    </div>
  );
}

/* ─────────── PLAY (mission dashboard + sections) ─────────── */
function PlayView({ mission, onChange, onExit }: { mission: Mission; onChange: (m: Mission) => void; onExit: () => void }) {
  const [section, setSection] = useState<SectionKey | null>(null);
  const getFn = useServerFn(getDailyMission);
  const refresh = async () => {
    const fresh = (await getFn({ data: { id: mission.id } })) as unknown as Mission;
    onChange(fresh);
  };

  if (section) {
    return (
      <SectionRunner
        mission={mission}
        section={section}
        onDone={async () => { await refresh(); setSection(null); }}
        onBack={() => setSection(null)}
      />
    );
  }

  const progress = mission.progress ?? {};
  const completedSections = SECTIONS.filter((s) => progress[s.key]?.completed);
  const totalScore = completedSections.reduce((a, s) => a + (progress[s.key]?.score ?? 0), 0);
  const totalMax = completedSections.reduce((a, s) => a + (progress[s.key]?.total ?? 0), 0);
  const pct = SECTIONS.length ? Math.round((completedSections.length / SECTIONS.length) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button className="fbh-btn" onClick={onExit}>← All missions</button>
        <span className="fbh-tag fbh-tag-eng">{mission.topic || "Editorial"}</span>
        {mission.difficulty && <span className="fbh-tag fbh-tag-sbi">{mission.difficulty}</span>}
      </div>

      <h1 style={{ fontFamily: "var(--f-display)", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>{mission.title}</h1>
      <p style={{ color: "var(--ink3)", fontSize: 14, marginBottom: 18 }}>{mission.summary}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 22 }}>
        <Stat val={`${completedSections.length}/${SECTIONS.length}`} label="Sections done" />
        <Stat val={`${pct}%`} label="Daily completion" />
        <Stat val={`${totalScore}/${totalMax || "—"}`} label="Today's score" />
        <Stat val={`${totalMax ? Math.round((totalScore / totalMax) * 100) : 0}%`} label="Accuracy" />
      </div>

      <div className="fbh-section-title">🎯 Sections</div>
      <div style={{ display: "grid", gap: 10 }}>
        {SECTIONS.map((s) => {
          const p = progress[s.key];
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className="fbh-glass"
              style={{ padding: 14, textAlign: "left", border: "1px solid var(--border-c)", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
            >
              <div style={{ fontSize: 24 }}>{s.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--f-display)", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--ink4)", marginTop: 2 }}>
                  ⏱ {s.minutes} min{p?.completed ? ` · ✅ ${p.score}/${p.total} · ${p.accuracy}% · ${Math.floor(p.time_taken_sec / 60)}m ${p.time_taken_sec % 60}s` : ""}
                </div>
              </div>
              <span className="fbh-btn-primary" style={{ pointerEvents: "none" }}>{p?.completed ? "Retry" : "Start"}</span>
            </button>
          );
        })}
      </div>

      {mission.grammar_notes?.length > 0 && (
        <>
          <div className="fbh-section-title" style={{ marginTop: 28 }}>📘 Grammar Notes</div>
          <div style={{ display: "grid", gap: 10 }}>
            {mission.grammar_notes.map((g, i) => (
              <div key={i} className="fbh-glass" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Rule: {g.rule}</div>
                {g.example && <div style={{ fontSize: 13, color: "var(--ink3)" }}><b>Example:</b> {g.example}</div>}
                {g.common_error && <div style={{ fontSize: 13, color: "var(--ink3)" }}><b>Common error:</b> {g.common_error}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ val, label }: { val: string; label: string }) {
  return (
    <div className="fbh-stat-card">
      <div className="fbh-stat-val">{val}</div>
      <div className="fbh-stat-label">{label}</div>
    </div>
  );
}

/* ─────────── SECTION RUNNER (timer + content) ─────────── */
function SectionRunner({ mission, section, onDone, onBack }: { mission: Mission; section: SectionKey; onDone: () => void; onBack: () => void }) {
  const meta = SECTIONS.find((s) => s.key === section)!;
  const totalSec = meta.minutes * 60;
  const [remaining, setRemaining] = useState(totalSec);
  const [running, setRunning] = useState(true);
  const startedAt = useRef<number>(Date.now());
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const elapsed = () => Math.min(totalSec, Math.round((Date.now() - startedAt.current) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const updateFn = useServerFn(updateSectionProgress);
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: async (p: SectionProgress) => updateFn({ data: { id: mission.id, section, progress: p } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      toast.success("Saved!");
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const finish = (score: number, total: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunning(false);
    const time_taken_sec = elapsed();
    const accuracy = total ? Math.round((score / total) * 100) : 0;
    submit.mutate({ completed: true, score, total, accuracy, time_taken_sec });
  };

  return (
    <div>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--paper)", padding: "10px 0", borderBottom: "1px solid var(--border-c)", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="fbh-btn" onClick={onBack}>← Back</button>
        <div style={{ fontFamily: "var(--f-display)", fontSize: 18, fontWeight: 700 }}>{meta.emoji} {meta.label}</div>
        <div role="timer" aria-label={`Time remaining: ${mm} minutes ${ss} seconds`} style={{ marginLeft: "auto", fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 22, color: remaining < 60 ? "#dc2626" : "var(--ink)" }}>⏱ {mm}:{ss}</div>
        <button className="fbh-btn" aria-label={running ? "Pause timer" : "Resume timer"} onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Resume"}</button>
      </div>

      {section === "editorial" && <EditorialReader mission={mission} onFinish={() => finish(1, 1)} />}
      {section === "analysis" && <AnalysisSection mission={mission} onFinish={() => finish(1, 1)} />}
      {section === "vocabulary" && <VocabSection mission={mission} onFinish={finish} />}
      {section === "rc" && <McqSection items={[...mission.rc_prelims, ...mission.rc_mains]} onFinish={finish} labelFor={(i) => (i < mission.rc_prelims.length ? "Prelims" : "Mains")} />}
      {section === "error_detection" && <McqSection items={mission.error_detection} onFinish={finish} />}
      {section === "cloze" && <McqSection items={mission.cloze} onFinish={finish} />}
      {section === "sentence_improvement" && <McqSection items={mission.sentence_improvement} onFinish={finish} />}
    </div>
  );
}

/* Editorial reading: just show source text + key points, "Mark as read" finishes */
function EditorialReader({ mission, onFinish }: { mission: Mission; onFinish: () => void }) {
  return (
    <div>
      <div className="fbh-glass" style={{ padding: 18, marginBottom: 14 }}>
        <h3 style={{ fontFamily: "var(--f-display)", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Summary</h3>
        <p className="fbh-mission-summary" style={{ color: "var(--ink3)", lineHeight: 1.6 }}>{mission.summary}</p>
      </div>
      {mission.key_points?.length > 0 && (
        <div className="fbh-glass" style={{ padding: 18, marginBottom: 14 }}>
          <h3 style={{ fontFamily: "var(--f-display)", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>5 Key Points</h3>
          <ul style={{ paddingLeft: 20, display: "grid", gap: 6 }}>
            {mission.key_points.map((p, i) => <li key={i} className="fbh-mission-kp">{p}</li>)}
          </ul>
        </div>
      )}
      <div className="fbh-glass fbh-mission-editorial" style={{ padding: 18, marginBottom: 14, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
        {mission.source_text}
      </div>
      <button className="fbh-btn-primary" onClick={onFinish}>✅ Mark editorial as read</button>
    </div>
  );
}

/* Editorial Analysis: structured breakdown (Issue / Causes / Effects / Solutions / Tone / Main Idea) */
function AnalysisSection({ mission, onFinish }: { mission: Mission; onFinish: () => void }) {
  const a = mission.analysis ?? { issue: "", causes: [], effects: [], solutions: [], author_tone: "", main_idea: "", one_line_summary: "" };
  const hasAny = a.issue || a.causes?.length || a.effects?.length || a.solutions?.length || a.author_tone || a.main_idea || a.one_line_summary;

  const Block = ({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) => (
    <div className="fbh-glass" style={{ padding: 18, marginBottom: 14 }}>
      <h3 style={{ fontFamily: "var(--f-display)", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{emoji} {title}</h3>
      {children}
    </div>
  );

  const List = ({ items }: { items: string[] }) => (
    <ol style={{ paddingLeft: 22, display: "grid", gap: 8 }}>
      {items.map((s, i) => <li key={i} className="fbh-mission-kp">{s}</li>)}
    </ol>
  );

  return (
    <div>
      {!hasAny && (
        <div className="fbh-glass" style={{ padding: 18, marginBottom: 14, color: "var(--ink4)" }}>
          This mission was created before the Editorial Analysis feature. Generate a new mission to see the full breakdown.
        </div>
      )}

      {a.issue && <Block title="Issue" emoji="⚠️"><p style={{ lineHeight: 1.7 }}>{a.issue}</p></Block>}
      {a.causes?.length > 0 && <Block title="Causes" emoji="🔎"><List items={a.causes} /></Block>}
      {a.effects?.length > 0 && <Block title="Effects" emoji="📈"><List items={a.effects} /></Block>}
      {a.solutions?.length > 0 && <Block title="Solutions" emoji="🛠"><List items={a.solutions} /></Block>}
      {a.author_tone && <Block title="Author's Tone" emoji="🎙"><p style={{ lineHeight: 1.7 }}>{a.author_tone}</p></Block>}
      {a.main_idea && <Block title="Main Idea" emoji="💡"><p style={{ lineHeight: 1.7 }}>{a.main_idea}</p></Block>}
      {a.one_line_summary && (
        <Block title="One-Sentence Summary" emoji="📝">
          <p style={{ lineHeight: 1.7, fontStyle: "italic", color: "var(--ink2)" }}>"{a.one_line_summary}"</p>
        </Block>
      )}

      <button className="fbh-btn-primary" onClick={onFinish}>✅ Mark analysis as studied</button>
    </div>
  );
}


function VocabSection({ mission, onFinish }: { mission: Mission; onFinish: (score: number, total: number) => void }) {
  const total = mission.vocabulary.length;
  const [known, setKnown] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setKnown((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  return (
    <div>
      <div style={{ marginBottom: 12, color: "var(--ink3)" }} className="fbh-mission-hint">Tap "I know this" as you study each word. Submit when done.</div>
      <div style={{ display: "grid", gap: 10 }}>
        {mission.vocabulary.map((v, i) => (
          <div key={i} className="fbh-glass" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontFamily: "var(--f-display)", fontSize: 18, fontWeight: 700 }}>{v.word}</div>
              <button className={known.has(i) ? "fbh-btn-primary" : "fbh-btn"} onClick={() => toggle(i)}>{known.has(i) ? "✅ Known" : "I know this"}</button>
            </div>
            <div className="fbh-mission-vocab-meaning" style={{ marginTop: 6 }}><b>Meaning:</b> {v.meaning}</div>
            {v.hindi && <div className="fbh-mission-vocab-meaning"><b>Hindi:</b> {v.hindi}</div>}
            {v.synonyms && <div className="fbh-mission-vocab-meaning"><b>Synonyms:</b> {v.synonyms}</div>}
            {v.antonyms && <div className="fbh-mission-vocab-meaning"><b>Antonyms:</b> {v.antonyms}</div>}
            {v.example && <div className="fbh-mission-vocab-meaning" style={{ color: "var(--ink3)", marginTop: 4 }}><i>"{v.example}"</i></div>}
          </div>
        ))}
      </div>
      <button className="fbh-btn-primary" style={{ marginTop: 16 }} onClick={() => onFinish(known.size, total)}>Submit Vocabulary</button>
    </div>
  );
}

function McqSection({ items, onFinish, labelFor }: { items: Mcq[]; onFinish: (score: number, total: number) => void; labelFor?: (i: number) => string }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(() => items.reduce((a, q, i) => a + (answers[i] === q.answer ? 1 : 0), 0), [answers, items]);

  if (items.length === 0) {
    return (
      <div className="fbh-glass" style={{ padding: 24, textAlign: "center" }}>
        <p>No questions available for this section.</p>
        <button className="fbh-btn-primary" style={{ marginTop: 10 }} onClick={() => onFinish(0, 0)}>Skip</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gap: 14 }}>
        {items.map((q, i) => (
          <div key={i} className="fbh-glass" style={{ padding: 14 }}>
            <div className="fbh-mission-q-label" style={{ color: "var(--ink4)", marginBottom: 4 }}>Q{i + 1}{labelFor ? ` · ${labelFor(i)}` : ""}</div>
            <div className="fbh-mission-question" style={{ fontWeight: 600, marginBottom: 10 }}>{q.question}</div>
            <div style={{ display: "grid", gap: 6 }}>
              {q.options.map((o, oi) => {
                const picked = answers[i] === oi;
                const correct = submitted && oi === q.answer;
                const wrong = submitted && picked && oi !== q.answer;
                return (
                  <button
                    key={oi}
                    disabled={submitted}
                    onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                    className="fbh-mission-opt"
                    style={{
                      textAlign: "left", padding: "10px 12px", borderRadius: 8,
                      border: `1px solid ${correct ? "#16a34a" : wrong ? "#dc2626" : picked ? "var(--ink)" : "var(--border-c)"}`,
                      background: correct ? "#dcfce7" : wrong ? "#fee2e2" : picked ? "var(--ink)" : "transparent",
                      color: correct ? "#166534" : wrong ? "#991b1b" : picked ? "#fff" : "var(--ink)",
                      cursor: submitted ? "default" : "pointer",
                    }}
                  >
                    {String.fromCharCode(65 + oi)}. {o}
                  </button>
                );
              })}
            </div>
            {submitted && q.explanation && (
              <div className="fbh-mission-explanation" style={{ marginTop: 8, color: "var(--ink3)" }}><b>Explanation:</b> {q.explanation}</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ position: "sticky", bottom: 0, background: "var(--paper)", padding: "12px 0", marginTop: 16, borderTop: "1px solid var(--border-c)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {!submitted && (
          <button className="fbh-btn-primary" onClick={() => setSubmitted(true)}>Check Answers</button>
        )}
        {submitted && (
          <>
            <div style={{ fontWeight: 700 }}>Score: {score}/{items.length} · {Math.round((score / items.length) * 100)}%</div>
            <button className="fbh-btn-primary" style={{ marginLeft: "auto" }} onClick={() => onFinish(score, items.length)}>Save & Finish</button>
          </>
        )}
      </div>
    </div>
  );
}
