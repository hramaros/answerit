"use client";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Countdown from "@/components/Countdown";
import Leaderboard from "@/components/Leaderboard";
import Podium from "@/components/Podium";
import { apiGet } from "@/lib/api";
import { normalizeCode } from "@/lib/code";
import { usePolling } from "@/lib/usePolling";

function HostResultsInner() {
  const params = useSearchParams();
  const code = normalizeCode(params.get("code") || "");

  const stateFetcher = useMemo(
    () => async () => (await apiGet(`/api/room/${code}/state`)).data,
    [code],
  );
  const resultsFetcher = useMemo(
    () => async () => (await apiGet(`/api/room/${code}/results`)).data,
    [code],
  );

  const state = usePolling(stateFetcher, 1200, true);
  const board = usePolling(resultsFetcher, 1500, true);

  const ended = state?.status === "ended";

  if (!state || !board) {
    return <div className="center-screen"><div className="spin" /></div>;
  }

  const offset = state.serverNow - Date.now();
  const endsAt = state.startedAt + state.durationMs;

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

      {ended ? (
        <div className="stack gap-8" style={{ textAlign: "center" }}>
          <span className="eyebrow">Quiz terminé</span>
          <h1 style={{ fontSize: "2.4rem" }}>Classement final</h1>
        </div>
      ) : (
        <div className="card row row--between wrap gap-16">
          <div className="stack gap-8">
            <span className="eyebrow">Quiz en cours</span>
            <h1 style={{ fontSize: "1.8rem" }}>
              {board.leaderboard.length} participant
              {board.leaderboard.length > 1 ? "s" : ""} en jeu
            </h1>
            <p className="muted tiny">Le classement se fige à la fin du chrono.</p>
          </div>
          <Countdown
            endsAt={endsAt}
            durationMs={state.durationMs}
            serverOffset={offset}
          />
        </div>
      )}

      {ended && <Podium podium={board.podium} />}

      <div className="stack gap-12">
        <span className="eyebrow">
          {ended ? "Tous les participants" : "Classement en direct"}
        </span>
        <Leaderboard players={board.leaderboard} />
      </div>

      {ended && (
        <Link href="/host" className="btn btn--ghost btn--block">
          Créer un nouveau quiz
        </Link>
      )}
    </div>
  );
}

export default function HostResultsPage() {
  return (
    <Suspense fallback={<div className="center-screen"><div className="spin" /></div>}>
      <HostResultsInner />
    </Suspense>
  );
}
