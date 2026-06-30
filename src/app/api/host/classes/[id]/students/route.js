import { addStudent, removeStudent } from "@/lib/classrooms";
import { accountFromRequest } from "@/lib/authServer";
import { json, readBody, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (request, { params }) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  const { id } = await params;
  const { name } = await readBody(request);
  const res = await addStudent(account.id, id, name);
  if (!res.ok) return json({ error: res.error }, res.status || 400);
  return json({ student: res.student, classroom: res.classroom });
});

export const DELETE = handler(async (request, { params }) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  const { id } = await params;
  const { studentId } = await readBody(request);
  const res = await removeStudent(account.id, id, studentId);
  if (!res.ok) return json({ error: res.error }, res.status || 400);
  return json({ classroom: res.classroom });
});
