import { getExamRecord } from "@/lib/history";
import { accountFromRequest } from "@/lib/authServer";
import { json, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Détail d'un examen (vérifie l'appartenance au compte connecté).
export const GET = handler(async (request, { params }) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  const { id } = await params;
  const record = await getExamRecord(account.id, id);
  if (!record) return json({ error: "Examen introuvable." }, 404);
  return json({ record });
});
