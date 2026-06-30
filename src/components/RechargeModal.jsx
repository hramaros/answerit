"use client";
import { useState } from "react";
import { apiPost } from "@/lib/api";

// Popup de recharge affiché quand le solde ne couvre pas le lancement de l'examen.
export default function RechargeModal({
  priceAr,
  balanceAr,
  busyRetry,
  onRecharged,
  onRetry,
  onClose,
}) {
  const [balance, setBalance] = useState(balanceAr || 0);
  const [busy, setBusy] = useState(false);
  const enough = balance >= priceAr;

  async function topup() {
    setBusy(true);
    const { ok, data } = await apiPost("/api/wallet/topup", {});
    setBusy(false);
    if (ok) {
      setBalance(data.balanceAr);
      onRecharged?.(data.balanceAr);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal stack gap-16" onClick={(e) => e.stopPropagation()}>
        <div className="stack gap-8" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.4rem" }}>Solde insuffisant</h2>
          <p className="muted">
            Lancer cet examen coûte <strong>{priceAr} Ar</strong>. Votre solde est
            de <strong>{balance} Ar</strong>.
          </p>
        </div>

        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={topup}
          disabled={busy}
        >
          {busy ? "Recharge…" : "Recharger +5 000 Ar (test)"}
        </button>
        <p className="tiny muted" style={{ textAlign: "center" }}>
          Paiement réel (mobile money / carte) à venir.
        </p>

        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          onClick={onRetry}
          disabled={!enough || busyRetry}
        >
          {busyRetry ? "Lancement…" : "Réessayer le lancement"}
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
          Annuler
        </button>
      </div>
    </div>
  );
}
