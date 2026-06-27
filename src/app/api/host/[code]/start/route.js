import { startGame } from "@/lib/rooms";
import { json, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (_request, { params }) => {
  const code = await codeFromParams(params);
  const result = await startGame(code);
  if (!result.ok) return json({ error: result.error }, 400);
  return json({
    ok: true,
    startedAt: result.startedAt,
    durationMs: result.durationMs,
  });
});
