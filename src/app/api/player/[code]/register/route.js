import { registerPlayer } from "@/lib/rooms";
import { json, readBody, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (request, { params }) => {
  const code = await codeFromParams(params);
  const { pseudo } = await readBody(request);
  const result = await registerPlayer(code, pseudo);
  if (!result.ok) return json({ error: result.error }, result.status || 400);
  return json({ playerId: result.playerId, pseudo: result.pseudo });
});
