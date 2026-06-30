import { createRoom } from "@/lib/rooms";
import { accountFromRequest } from "@/lib/authServer";
import { json, readBody, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (request) => {
  const { hostName } = await readBody(request);
  const account = await accountFromRequest(request);
  const meta = await createRoom(hostName, account?.id || null);
  return json({ code: meta.code, hostName: meta.hostName });
});
