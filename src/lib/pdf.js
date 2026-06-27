"use client";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Palette PDF (lisible sur fond blanc, cohérente avec l'identité verte).
const GREEN = [22, 163, 74]; // en-têtes / filets
const DARK = [17, 24, 20]; // texte principal
const MUTED = [110, 130, 120];

function frDate(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

/** En-tête commun : marque + titre + méta. Retourne le `y` courant. */
function header(doc, subtitle, board) {
  const m = 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...GREEN);
  doc.text("valio.fanontaniana", m, 20);

  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, m, 27);

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.6);
  doc.line(m, 31, 210 - m, 31);

  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text(board.title || "Quiz", m, 41);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`Salle ${board.code}  ·  ${frDate()}`, m, 48);

  return 56;
}

/** PDF formateur : classement complet de tous les participants + podium. */
export function downloadHostResultsPdf(board) {
  const doc = new jsPDF();
  let y = header(doc, "Résultats de la session", board);

  const lb = board.leaderboard || [];
  const podium = (board.podium || [])
    .map((p, i) => `${i + 1}${i === 0 ? "er" : "e"} ${p.pseudo} (${p.score})`)
    .join("    ");
  if (podium) {
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.text("Podium :", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(podium, 32, y);
    y += 8;
  }

  autoTable(doc, {
    startY: y,
    head: [["Rang", "Participant", "Score", "Note /20", "Bonnes rép."]],
    body: lb.map((p) => [
      p.rank,
      p.pseudo,
      p.score,
      p.note,
      `${p.nbCorrect} / ${board.nbQuestions}`,
    ]),
    styles: { fontSize: 10, cellPadding: 3, textColor: DARK },
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255], halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 18 },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
    },
    alternateRowStyles: { fillColor: [240, 250, 244] },
  });

  doc.save(`valio-resultats-${board.code}.pdf`);
}

/** PDF participant : son résultat personnel (score, note, classement). */
export function downloadParticipantPdf(board, me) {
  const doc = new jsPDF();
  const total = (board.leaderboard || []).length;
  let y = header(doc, "Résultat individuel", board);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(me.pseudo, 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    body: [
      ["Classement", `${me.rank}ᵉ / ${total}`],
      ["Points", `${me.score}`],
      ["Note", `${me.note} / 20`],
      ["Bonnes réponses", `${me.nbCorrect} / ${board.nbQuestions}`],
    ],
    theme: "grid",
    styles: { fontSize: 12, cellPadding: 4, textColor: DARK },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [240, 250, 244], cellWidth: 70 },
      1: { halign: "right" },
    },
  });

  doc.save(`valio-mon-resultat-${board.code}.pdf`);
}
