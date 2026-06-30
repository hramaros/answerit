import { deleteSession } from "@/lib/accounts";
import { sessionTokenFromRequest, sessionClearCookie } from "@/lib/authServer";
import { handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (request) => {
  await deleteSession(sessionTokenFromRequest(request));
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": sessionClearCookie(),
    },
  });
});
