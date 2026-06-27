import { getMe } from "@/lib/rooms";
import { json, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handler(async (request, { params }) => {
  const code = await codeFromParams(params);
  const playerId = new URL(request.url).searchParams.get("playerId");
  if (!playerId) return json({ error: "playerId requis." }, 400);
  const me = await getMe(code, playerId);
  if (!me) return json({ error: "Joueur introuvable." }, 404);
  return json(me);
});
