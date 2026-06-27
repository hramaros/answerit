import { submitAnswer } from "@/lib/rooms";
import { json, readBody, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (request, { params }) => {
  const code = await codeFromParams(params);
  const { playerId, questionId, answerIds } = await readBody(request);
  const result = await submitAnswer(code, playerId, questionId, answerIds);
  if (!result.ok) return json({ error: result.error }, result.status || 400);
  return json({ correct: result.correct, points: result.points, score: result.score });
});
