import { jsPDF } from "jspdf";

export interface VocabEntry {
  word: string; pos?: string; hindi?: string; english?: string; synonyms?: string; usage?: string;
}
export interface QuizQ {
  type: "rc" | "vocab" | "cloze" | "error" | "ows";
  question: string; options: string[]; answer: number; explanation?: string;
}
export interface EditorialAnalysis {
  issue?: string;
  causes?: string[];
  effects?: string[];
  solutions?: string[];
  author_tone?: string;
  main_idea?: string;
  one_line_summary?: string;
}
export interface QuizStats { score?: number; total?: number; accuracy?: number; at?: string }
export interface ArticlePackage {
  id?: string;
  title: string;
  full_article: string;
  summary: string;
  theme: string;
  tone: string;
  conclusion: string;
  takeaways: string[];
  analysis?: EditorialAnalysis;
  vocabulary: VocabEntry[];
  sbi_notes: { word: string; note: string }[];
  quiz: QuizQ[];
  quiz_stats?: QuizStats;
  created_at?: string;
}

function newPdf(title: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const lines = doc.splitTextToSize(title, 500);
  doc.text(lines, 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("FirstJob Banker — " + new Date().toLocaleDateString(), 40, 50 + lines.length * 22 + 10);
  doc.setTextColor(0);
  return { doc, y: 50 + lines.length * 22 + 36 };
}

function addBlock(doc: jsPDF, y: number, label: string, body: string): number {
  if (y > 760) { doc.addPage(); y = 50; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(192, 57, 43);
  doc.text(label.toUpperCase(), 40, y); y += 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30);
  const lines = doc.splitTextToSize(body, 515);
  for (const ln of lines) {
    if (y > 780) { doc.addPage(); y = 50; }
    doc.text(ln, 40, y); y += 14;
  }
  return y + 10;
}

export function exportArticlePDF(a: ArticlePackage) {
  const { doc, y: y0 } = newPdf(a.title);
  let y = y0;
  if (a.summary) y = addBlock(doc, y, "Editorial Summary", a.summary);
  if (a.theme) y = addBlock(doc, y, "Main Theme", a.theme);
  if (a.tone) y = addBlock(doc, y, "Editorial Tone", a.tone);
  if (a.takeaways?.length) y = addBlock(doc, y, "Key Takeaways", a.takeaways.map((t, i) => `${i + 1}. ${t}`).join("\n"));
  if (a.conclusion) y = addBlock(doc, y, "Conclusion", a.conclusion);
  if (a.full_article) y = addBlock(doc, y, "Full Editorial", a.full_article);
  doc.save(`${slug(a.title)}.pdf`);
}

export function exportVocabPDF(a: ArticlePackage) {
  const { doc, y: y0 } = newPdf("Vocabulary — " + a.title);
  let y = y0;
  for (const v of a.vocabulary ?? []) {
    if (y > 740) { doc.addPage(); y = 50; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(37, 99, 235);
    doc.text(v.word, 40, y); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40);
    const lines = [
      v.pos ? `Part of Speech: ${v.pos}` : "",
      v.hindi ? `Hindi: ${v.hindi}` : "",
      v.english ? `English: ${v.english}` : "",
      v.synonyms ? `Synonyms: ${v.synonyms}` : "",
      v.usage ? `Usage: ${v.usage}` : "",
    ].filter(Boolean);
    for (const l of lines) {
      const wrapped = doc.splitTextToSize(l, 515);
      for (const w of wrapped) {
        if (y > 780) { doc.addPage(); y = 50; }
        doc.text(w, 40, y); y += 13;
      }
    }
    y += 10;
  }
  doc.save(`vocab-${slug(a.title)}.pdf`);
}

export function exportNotesPDF(a: ArticlePackage) {
  const { doc, y: y0 } = newPdf("SBI PO Notes — " + a.title);
  let y = y0;
  for (const n of a.sbi_notes ?? []) {
    if (y > 760) { doc.addPage(); y = 50; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(124, 58, 237);
    doc.text(n.word, 40, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40);
    const lines = doc.splitTextToSize(n.note, 515);
    for (const ln of lines) { if (y > 780) { doc.addPage(); y = 50; } doc.text(ln, 40, y); y += 13; }
    y += 8;
  }
  doc.save(`notes-${slug(a.title)}.pdf`);
}

export function printArticle(a: ArticlePackage) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<html><head><title>${escape(a.title)}</title>
  <style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 20px;color:#1a1a2e;line-height:1.7}
  h1{font-size:26px;border-left:4px solid #c0392b;padding-left:14px}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.8px;color:#c0392b;margin-top:24px}
  p{margin:10px 0} .meta{color:#888;font-size:12px}</style></head><body>
  <h1>${escape(a.title)}</h1>
  <div class="meta">${a.created_at ? new Date(a.created_at).toLocaleString() : ""}</div>
  ${a.summary ? `<h2>Summary</h2><p>${escape(a.summary)}</p>` : ""}
  ${a.theme ? `<h2>Theme</h2><p>${escape(a.theme)}</p>` : ""}
  ${a.conclusion ? `<h2>Conclusion</h2><p>${escape(a.conclusion)}</p>` : ""}
  <h2>Full Editorial</h2>${a.full_article.split(/\n+/).map(p => `<p>${escape(p)}</p>`).join("")}
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

function escape(s: string) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c]); }
function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "article"; }
