import { getMeta, deriveStatus, listParticipants } from "@/lib/rooms";
import { json, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Endpoint pollé (~1s) par le lobby host & participant : statut + arrivées + timing.
export const GET = handler(async (_request, { params }) => {
  const code = await codeFromParams(params);
  const meta = await getMeta(code);
  if (!meta) return json({ error: "Salle introuvable." }, 404);

  const status = deriveStatus(meta);
  const participants = await listParticipants(code);
  return json({
    code,
    status,
    hostName: meta.hostName,
    title: meta.quiz?.title || null,
    hasQuiz: !!meta.quiz,
    nbQuestions: meta.quiz?.questions.length || 0,
    participants,
    startedAt: meta.startedAt,
    durationMs: meta.durationMs,
    serverNow: Date.now(),
  });
});
