import { endSession } from "@/lib/rooms";
import { json, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Le formateur termine la session avant la fin du chrono.
export const POST = handler(async (_request, { params }) => {
  const code = await codeFromParams(params);
  const result = await endSession(code);
  if (!result.ok) return json({ error: result.error }, result.status || 400);
  return json({ ok: true, endedAt: result.endedAt });
});
