import { getMeta, deriveStatus } from "@/lib/rooms";
import { json, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Renvoie les questions SANS le flag `correct` (anti-triche). Uniquement si la
// partie est en cours.
export const GET = handler(async (_request, { params }) => {
  const code = await codeFromParams(params);
  const meta = await getMeta(code);
  if (!meta) return json({ error: "Salle introuvable." }, 404);
  if (deriveStatus(meta) !== "running")
    return json({ error: "La partie n'est pas en cours." }, 409);

  const questions = meta.quiz.questions.map((q) => ({
    id: q.id,
    text: q.text,
    type: q.type,
    basePoints: q.basePoints,
    answers: q.answers.map((a) => ({ id: a.id, text: a.text, color: a.color })),
  }));

  return json({
    title: meta.quiz.title,
    totalDurationSec: meta.quiz.totalDurationSec,
    startedAt: meta.startedAt,
    durationMs: meta.durationMs,
    serverNow: Date.now(),
    questions,
  });
});
