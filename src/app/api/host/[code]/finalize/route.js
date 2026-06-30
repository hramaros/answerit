import { finalizeSession } from "@/lib/rooms";
import { json, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Clôt définitivement la session : fige le classement et débloque les notes.
export const POST = handler(async (_request, { params }) => {
  const code = await codeFromParams(params);
  const result = await finalizeSession(code);
  if (!result.ok) return json({ error: result.error }, result.status || 400);
  return json({ ok: true });
});
