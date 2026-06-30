import { gradeFreeAnswer } from "@/lib/rooms";
import { json, readBody, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Le formateur valide (ou refuse) une réponse libre d'un participant.
export const POST = handler(async (request, { params }) => {
  const code = await codeFromParams(params);
  const { playerId, questionId, correct } = await readBody(request);
  const result = await gradeFreeAnswer(code, playerId, questionId, correct);
  if (!result.ok) return json({ error: result.error }, result.status || 400);
  return json({ correct: result.correct, points: result.points, score: result.score });
});
