import { revealQuestion } from "@/lib/rooms";
import { json, readBody, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (request, { params }) => {
  const code = await codeFromParams(params);
  const { playerId, questionId } = await readBody(request);
  const result = await revealQuestion(code, playerId, questionId);
  if (!result.ok) return json({ error: result.error }, 409);
  return json({ ok: true });
});
