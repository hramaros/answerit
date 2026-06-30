import { getClass } from "@/lib/classrooms";
import { getClassExamRecords } from "@/lib/history";
import { buildGradebook } from "@/lib/gradebook";
import { accountFromRequest } from "@/lib/authServer";
import { json, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Carnet de notes d'une classe (matrice élèves × examens).
export const GET = handler(async (request, { params }) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  const { id } = await params;
  const cls = await getClass(account.id, id);
  if (!cls) return json({ error: "Classe introuvable." }, 404);
  const records = await getClassExamRecords(id);
  return json({
    className: cls.name,
    gradebook: buildGradebook(cls.students, records),
  });
});
