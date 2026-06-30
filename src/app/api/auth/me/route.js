import { accountFromRequest } from "@/lib/authServer";
import { json, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  const account = await accountFromRequest(request);
  return json({ account: account || null });
});
