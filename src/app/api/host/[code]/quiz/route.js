import { setQuiz } from "@/lib/rooms";
import { json, readBody, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (request, { params }) => {
  const code = await codeFromParams(params);
  const { quiz } = await readBody(request);
  const result = await setQuiz(code, quiz);
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true });
});
