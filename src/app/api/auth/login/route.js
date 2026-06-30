import { authenticate, createSession } from "@/lib/accounts";
import { sessionSetCookie } from "@/lib/authServer";
import { readBody, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (request) => {
  const { email, password } = await readBody(request);
  const res = await authenticate({ email, password });
  if (!res.ok)
    return Response.json({ error: res.error }, { status: res.status || 401 });
  const token = await createSession(res.account.id);
  return new Response(JSON.stringify({ account: res.account }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": sessionSetCookie(token),
    },
  });
});
