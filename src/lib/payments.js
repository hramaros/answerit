import { getRedis } from "./redis.js";
import { generateId } from "./code.js";
import { credit } from "./accounts.js";

// Abstraction de paiement PROVIDER-AGNOSTIQUE.
// Une recharge = une transaction (pending → completed/failed). Le crédit du
// solde n'a lieu qu'à la complétion, une seule fois (idempotent).
//
// Pour brancher un vrai agrégateur (MVola/Orange/Airtel via un PSP, Stripe…) :
//   1. implémenter un provider { initiate(txn), handleWebhook(request) }
//   2. registerProvider("mvola", impl)
//   3. exposer le webhook sur /api/wallet/webhook/mvola (déjà en place).
// Rien d'autre ne change : la couche solde/examen reste identique.

const TXN_TTL_SEC = 30 * 24 * 3600; // transactions conservées 30 j
const txnKey = (id) => `txn:${id}`;

export const TXN_PENDING = "pending";
export const TXN_COMPLETED = "completed";
export const TXN_FAILED = "failed";

/**
 * Provider STUB : valide la recharge immédiatement (pas de vrai paiement).
 * `autoComplete: true` → la transaction est complétée dans la foulée.
 */
const providers = {
  stub: {
    async initiate(txn) {
      return { providerRef: `stub-${txn.id}`, autoComplete: true };
    },
  },
};

export function registerProvider(name, impl) {
  providers[name] = impl;
}
export function getProvider(name) {
  return providers[name] || null;
}

export async function getTransaction(id) {
  const redis = getRedis();
  return (await redis.get(txnKey(id))) || null;
}

async function saveTxn(txn) {
  await getRedis().set(txnKey(txn.id), txn, { ex: TXN_TTL_SEC });
}

/** Démarre une recharge : crée une transaction et la confie au provider. */
export async function initiateTopup(accountId, amountAr, providerName = "stub") {
  const provider = getProvider(providerName);
  if (!provider)
    return { ok: false, status: 400, error: "Fournisseur de paiement inconnu." };
  const amount = Math.max(0, Math.round(Number(amountAr) || 0));
  if (amount <= 0)
    return { ok: false, status: 400, error: "Montant de recharge invalide." };

  const txn = {
    id: generateId("txn"),
    accountId,
    amountAr: amount,
    provider: providerName,
    providerRef: null,
    status: TXN_PENDING,
    createdAt: Date.now(),
    completedAt: null,
  };
  const started = (await provider.initiate(txn)) || {};
  txn.providerRef = started.providerRef || null;
  await saveTxn(txn);

  // Provider synchrone (ex. stub) : on complète tout de suite.
  if (started.autoComplete) return completeTransaction(txn.id);

  return {
    ok: true,
    transaction: txn,
    redirectUrl: started.redirectUrl || null,
    instructions: started.instructions || null,
  };
}

/** Confirme une transaction et crédite le solde — idempotent. */
export async function completeTransaction(id) {
  const txn = await getTransaction(id);
  if (!txn) return { ok: false, status: 404, error: "Transaction introuvable." };
  if (txn.status === TXN_COMPLETED)
    return { ok: true, transaction: txn, alreadyCompleted: true };

  const res = await credit(txn.accountId, txn.amountAr);
  txn.status = TXN_COMPLETED;
  txn.completedAt = Date.now();
  await saveTxn(txn);
  return { ok: true, transaction: txn, balanceAr: res.balanceAr };
}

export async function failTransaction(id) {
  const txn = await getTransaction(id);
  if (!txn) return { ok: false, status: 404, error: "Transaction introuvable." };
  if (txn.status === TXN_PENDING) {
    txn.status = TXN_FAILED;
    await saveTxn(txn);
  }
  return { ok: true, transaction: txn };
}
