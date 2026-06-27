"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";
import { normalizeCode } from "@/lib/code";
import { usePolling } from "@/lib/usePolling";
import { savePlayerSession, getPlayerSession } from "@/lib/session";

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const code = normalizeCode(params.get("code") || "");

  const [step, setStep] = useState("pseudo"); // 'pseudo' | 'lobby'
  const [pseudo, setPseudo] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Reprise de session si déjà inscrit dans cette salle.
  useEffect(() => {
    const s = getPlayerSession();
    if (s && s.code === code && s.playerId) {
      setPlayerId(s.playerId);
      setPseudo(s.pseudo);
      setStep("lobby");
    }
  }, [code]);

  const stateFetcher = useMemo(
    () => async () => (await apiGet(`/api/room/${code}/state`)).data,
    [code],
  );
  const state = usePolling(stateFetcher, 1200, step === "lobby");

  // Bascule vers le jeu / résultats quand l'hôte lance ou que le temps est fini.
  useEffect(() => {
    if (!state) return;
    if (state.status === "running") router.push(`/play?code=${code}`);
    else if (state.status === "ended") router.push(`/result?code=${code}`);
  }, [state, code, router]);

  async function register(e) {
    e.preventDefault();
    const clean = pseudo.trim();
    if (!clean) {
      setError("Choisissez un pseudo.");
      return;
    }
    setError("");
    setLoading(true);
    const { ok, data } = await apiPost(`/api/player/${code}/register`, {
      pseudo: clean,
    });
    setLoading(false);
    if (!ok) {
      setError(data?.error || "Inscription impossible.");
      return;
    }
    savePlayerSession({ code, playerId: data.playerId, pseudo: data.pseudo });
    setPlayerId(data.playerId);
    setStep("lobby");
  }

  if (!code) {
    return (
      <div className="center-screen">
        <div className="card stack gap-16" style={{ textAlign: "center" }}>
          <h2>Code manquant</h2>
          <Link href="/" className="btn btn--primary">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  if (step === "pseudo") {
    return (
      <div className="center-screen">
        <div className="container container--narrow stack gap-24">
          <div className="row gap-12">
            <Link href="/" className="pill">← Quitter</Link>
            <span className="pill">
              Salle <span className="code-chip" style={{ fontSize: "1rem" }}>{code}</span>
            </span>
          </div>
          <form className="card stack gap-16" onSubmit={register}>
            <span className="eyebrow">Étape 2 / 2</span>
            <h1 style={{ fontSize: "2rem" }}>Votre pseudo</h1>
            <p className="muted">Il apparaîtra dans le classement.</p>
            <input
              className="input"
              placeholder="ex. Lucie"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              maxLength={30}
              autoFocus
              autoComplete="off"
            />
            {error && <div className="error">{error}</div>}
            <button
              type="submit"
              className="btn btn--primary btn--lg btn--block"
              disabled={loading}
            >
              {loading ? "…" : "Rejoindre la salle"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Lobby d'attente
  return (
    <div className="center-screen">
      <div className="container container--narrow stack gap-24" style={{ textAlign: "center" }}>
        <div className="spin" style={{ margin: "0 auto" }} />
        <div className="stack gap-8">
          <span className="eyebrow">Salle {code}</span>
          <h1 style={{ fontSize: "2rem" }}>Bienvenue, {pseudo} !</h1>
          <p className="muted">
            En attente du lancement par le formateur…
          </p>
        </div>
        {state?.participants && (
          <div className="panel stack gap-12">
            <div className="tiny muted">
              {state.participants.length} participant
              {state.participants.length > 1 ? "s" : ""} dans la salle
            </div>
            <div className="players" style={{ justifyContent: "center" }}>
              {state.participants.map((p) => (
                <span
                  key={p.playerId}
                  className="player-chip"
                  style={p.playerId === playerId ? { borderColor: "var(--violet)" } : undefined}
                >
                  <span className="player-chip__dot" />
                  {p.pseudo}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="center-screen"><div className="spin" /></div>}>
      <JoinInner />
    </Suspense>
  );
}
