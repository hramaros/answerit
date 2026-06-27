import { getLeaderboard } from "@/lib/rooms";
import { json, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handler(async (_request, { params }) => {
  const code = await codeFromParams(params);
  const board = await getLeaderboard(code);
  if (!board) return json({ error: "Salle introuvable." }, 404);
  return json(board);
});
