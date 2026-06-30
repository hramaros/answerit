import { initiateTopup } from "@/lib/payments";
import { TOPUP_TEST_AR } from "@/lib/wallet";
import { accountFromRequest } from "@/lib/authServer";
import { json, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Recharge via la couche paiement. Provider « stub » par défaut = crédit
// immédiat (en attendant un vrai agrégateur).
export const POST = handler(async (request) => {
  const account = await accountFromRequest(request);
  if (!account) return json({ error: "Connexion requise." }, 401);
  const res = await initiateTopup(account.id, TOPUP_TEST_AR, "stub");
  if (!res.ok) return json({ error: res.error }, res.status || 400);
  return json({
    balanceAr: res.balanceAr,
    transactionId: res.transaction?.id,
    status: res.transaction?.status,
  });
});
