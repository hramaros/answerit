import { createRoom } from "@/lib/rooms";
import { json, readBody, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (request) => {
  const { hostName } = await readBody(request);
  const meta = await createRoom(hostName);
  return json({ code: meta.code, hostName: meta.hostName });
});
