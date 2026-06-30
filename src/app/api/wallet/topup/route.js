import { topupTest } from "@/lib/accounts";
import { TOPUP_TEST_AR } from "@/lib/wallet";
import { accountFromRequest } from "@/lib/authServer";
import { json, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Recharge de test (stub) : crédite TOPUP_TEST_AR au solde du formateur connecté.
export const POST = handler(async (request) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  const res = await topupTest(account.id, TOPUP_TEST_AR);
  return json({ balanceAr: res.balanceAr });
});
