import { listClasses, createClass } from "@/lib/classrooms";
import { accountFromRequest } from "@/lib/authServer";
import { json, readBody, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  return json({ classes: await listClasses(account.id) });
});

export const POST = handler(async (request) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  const { name } = await readBody(request);
  const res = await createClass(account.id, name);
  if (!res.ok) return json({ error: res.error }, res.status || 400);
  return json({ classroom: res.classroom });
});
