import { getClass, renameClass, deleteClass } from "@/lib/classrooms";
import { accountFromRequest } from "@/lib/authServer";
import { json, readBody, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handler(async (request, { params }) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  const { id } = await params;
  const classroom = await getClass(account.id, id);
  if (!classroom) return json({ error: "Classe introuvable." }, 404);
  return json({ classroom });
});

export const PATCH = handler(async (request, { params }) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  const { id } = await params;
  const { name } = await readBody(request);
  const res = await renameClass(account.id, id, name);
  if (!res.ok) return json({ error: res.error }, res.status || 400);
  return json({ classroom: res.classroom });
});

export const DELETE = handler(async (request, { params }) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  const { id } = await params;
  const res = await deleteClass(account.id, id);
  if (!res.ok) return json({ error: res.error }, res.status || 400);
  return json({ ok: true });
});
