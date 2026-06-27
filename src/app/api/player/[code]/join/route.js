import { joinRoom } from "@/lib/rooms";
import { json, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (_request, { params }) => {
  const code = await codeFromParams(params);
  const result = await joinRoom(code);
  if (!result.ok) return json({ error: result.error }, result.status || 400);
  return json({ ok: true });
});
