"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";
import { normalizeCode } from "@/lib/code";
import { usePolling } from "@/lib/usePolling";

function LobbyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const code = normalizeCode(params.get("code") || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fetcher = useMemo(
    () => async () => (await apiGet(`/api/room/${code}/state`)).data,
    [code],
  );
  const state = usePolling(fetcher, 1200, true);

  // Si la partie est déjà lancée, on file vers le suivi des résultats.
  useEffect(() => {
    if (state && (state.status === "running" || state.status === "ended")) {
      router.replace(`/host/results?code=${code}`);
    }
  }, [state, code, router]);

  async function launch() {
    setError("");
    setBusy(true);
    const { ok, data } = await apiPost(`/api/host/${code}/start`);
    setBusy(false);
    if (!ok) {
      setError(data?.error || "Lancement impossible.");
      return;
    }
    router.push(`/host/results?code=${code}`);
  }

  const participants = state?.participants || [];

  return (
    <div className="container stack gap-24">
      <div className="row row--between wrap gap-12">
        <Link href="/" className="brand">
          <span className="brand__mark"><i /><i /><i /><i /></span>
          answer<b>it</b>
        </Link>
        <div className="panel row gap-12" style={{ padding: "10px 16px" }}>
          <span className="tiny muted">Code</span>
          <span className="code-chip">{code}</span>
        </div>
      </div>

      <div className="card stack gap-16" style={{ textAlign: "center" }}>
        <span className="eyebrow">Salle d'attente</span>
        <h1 style={{ fontSize: "2.6rem" }}>
          Rejoignez avec le code <span style={{ color: "var(--violet-bright)" }}>{code}</span>
        </h1>
        <p className="muted">
          Les participants apparaissent ci-dessous. Lancez quand tout le monde
          est prêt — les inscriptions seront alors fermées.
        </p>
      </div>

      <div className="stack gap-12">
        <div className="row row--between">
          <span className="eyebrow">
            {participants.length} participant{participants.length > 1 ? "s" : ""}
          </span>
        </div>
        {participants.length === 0 ? (
          <div className="panel" style={{ textAlign: "center" }}>
            <p className="muted">En attente des premiers participants…</p>
          </div>
        ) : (
          <div className="players">
            {participants.map((p) => (
              <span key={p.playerId} className="player-chip">
                <span className="player-chip__dot" />
                {p.pseudo}
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <button
        className="btn btn--primary btn--lg btn--block"
        onClick={launch}
        disabled={busy || participants.length === 0}
      >
        {busy
          ? "Lancement…"
          : participants.length === 0
            ? "En attente de participants"
            : "🚀 Lancer le quiz"}
      </button>
    </div>
  );
}

export default function HostLobbyPage() {
  return (
    <Suspense fallback={<div className="center-screen"><div className="spin" /></div>}>
      <LobbyInner />
    </Suspense>
  );
}
