"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Leaderboard from "@/components/Leaderboard";
import { apiGet } from "@/lib/api";
import { useAccount } from "@/lib/account-client";

// Chargé à la demande (jsPDF est lourd).
async function exportPdf(record) {
  const { downloadHostResultsPdf } = await import("@/lib/pdf");
  downloadHostResultsPdf(record);
}

function frDate(ts) {
  return ts
    ? new Date(ts).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
    : "";
}

export default function HostHistoryPage() {
  const { account, loading } = useAccount();
  const [records, setRecords] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!account) return;
    (async () => {
      const { ok, data } = await apiGet("/api/host/history");
      if (ok) setRecords(data.records);
    })();
  }, [account]);

  async function open(id) {
    const { ok, data } = await apiGet(`/api/host/history/${id}`);
    if (ok) setSelected(data.record);
  }

  if (loading) {
    return <div className="center-screen"><div className="spin" /></div>;
  }

  if (!account) {
    return (
      <div className="center-screen">
        <div className="card stack gap-16" style={{ textAlign: "center" }}>
          <h2>Mes examens</h2>
          <p className="muted">
            Connectez-vous pour consulter l'historique de vos examens.
          </p>
          <Link href="/host" className="btn btn--primary">
            Espace formateur
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container stack gap-24">
      <div className="row row--between wrap gap-12">
        <Link href="/" className="brand">
          <img src="/logo.png" alt="valio" className="brand__logo" />
          <b>.fanontaniana</b>
        </Link>
        <Link href="/host" className="pill">← Espace formateur</Link>
      </div>

      <div className="stack gap-8">
        <span className="eyebrow">
          {account.email} · Solde {account.balanceAr} Ar
        </span>
        <h1 style={{ fontSize: "2rem" }}>Mes examens</h1>
      </div>

      {!records ? (
        <div className="spin" style={{ margin: "0 auto" }} />
      ) : records.length === 0 ? (
        <div className="panel" style={{ textAlign: "center" }}>
          <p className="muted">Aucun examen enregistré pour l'instant.</p>
        </div>
      ) : (
        <div className="stack gap-8">
          {records.map((r) => (
            <button
              key={r.id}
              type="button"
              className="grade-row"
              style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
              onClick={() => open(r.id)}
            >
              <div className="grade-row__ans">
                <div style={{ fontWeight: 700 }}>{r.title}</div>
                <div className="muted tiny">
                  {frDate(r.endedAt)} · {r.participantCount} participant
                  {r.participantCount > 1 ? "s" : ""} · {r.priceAr} Ar
                </div>
              </div>
              <span className="pill">Voir</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal stack gap-16"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <div className="row row--between">
              <h2 style={{ fontSize: "1.3rem" }}>{selected.title}</h2>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ padding: "6px 10px" }}
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>
            <span className="tiny muted">
              {frDate(selected.endedAt)} · Salle {selected.code} · {selected.priceAr} Ar
            </span>
            <Leaderboard players={selected.leaderboard} />
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => exportPdf(selected)}
            >
              ⬇ Télécharger le PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
