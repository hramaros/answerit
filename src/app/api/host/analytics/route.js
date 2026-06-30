import { listExamRecords } from "@/lib/history";
import { aggregateStats } from "@/lib/analytics";
import { accountFromRequest } from "@/lib/authServer";
import { json, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Statistiques cumulées + examens récents du formateur connecté.
export const GET = handler(async (request) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  const records = await listExamRecords(account.id, 200);
  return json({ stats: aggregateStats(records), recent: records.slice(0, 8) });
});
