// Logique PURE du porte-monnaie (sans I/O), testable avec `node --test`.

// Montant de la recharge de test (en attendant le paiement réel mobile money / carte).
export const TOPUP_TEST_AR = 5000;

/** Le solde couvre-t-il le prix de l'examen ? */
export function canAfford(balanceAr, priceAr) {
  return (Number(balanceAr) || 0) >= (Number(priceAr) || 0);
}
