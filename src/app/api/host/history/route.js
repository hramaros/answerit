import { listExamRecords } from "@/lib/history";
import { accountFromRequest } from "@/lib/authServer";
import { json, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Historique des examens du formateur connecté (résumés).
export const GET = handler(async (request) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  const records = await listExamRecords(account.id, 100);
  return json({ records });
});
