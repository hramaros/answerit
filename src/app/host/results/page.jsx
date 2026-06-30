"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Countdown from "@/components/Countdown";
import Leaderboard from "@/components/Leaderboard";
import Podium from "@/components/Podium";
import ReviewGrader from "@/components/ReviewGrader";
import { apiGet, apiPost } from "@/lib/api";
import { normalizeCode } from "@/lib/code";
import { usePolling } from "@/lib/usePolling";

// Chargé à la demande (jsPDF est lourd) : on n'alourdit pas le bundle de la page.
async function exportPdf(board) {
  const { downloadHostResultsPdf } = await import("@/lib/pdf");
  downloadHostResultsPdf(board);
}

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
  const reviewFetcher = useMemo(
    () => async () => (await apiGet(`/api/host/${code}/review`)).data,
    [code],
  );

  const state = usePolling(stateFetcher, 1200, true);
  const status = state?.status;
  const review = status === "review";
  const ended = status === "ended";

  const board = usePolling(resultsFetcher, 1500, true);
  const reviewData = usePolling(reviewFetcher, 1000, review);

  // Aperçu local instantané pendant que le polling rattrape le serveur.
  const [overlay, setOverlay] = useState({});
  const [finalizing, setFinalizing] = useState(false);

  async function grade(questionId, playerId, correct) {
    setOverlay((o) => ({ ...o, [`${questionId}:${playerId}`]: correct }));
    await apiPost(`/api/host/${code}/grade`, { questionId, playerId, correct });
  }

  async function finalize() {
    setFinalizing(true);
    await apiPost(`/api/host/${code}/finalize`);
    setFinalizing(false);
  }

  async function endExam() {
    await apiPost(`/api/host/${code}/end`, {});
  }

  const mergedReview = useMemo(() => {
    if (!reviewData) return null;
    return {
      ...reviewData,
      questions: reviewData.questions.map((q) => ({
        ...q,
        submissions: q.submissions.map((s) => {
          const k = `${q.id}:${s.playerId}`;
          return k in overlay ? { ...s, correct: overlay[k] } : s;
        }),
      })),
    };
  }, [reviewData, overlay]);

  const pending = mergedReview
    ? mergedReview.questions.reduce(
        (n, q) => n + q.submissions.filter((s) => s.correct === null).length,
        0,
      )
    : 0;

  if (!state) {
    return <div className="center-screen"><div className="spin" /></div>;
  }

  const offset = state.serverNow - Date.now();
  const endsAt = state.startedAt + state.durationMs;

  const header = (
    <div className="row row--between wrap gap-12">
      <Link href="/" className="brand">
        <img src="/logo.png" alt="valio" className="brand__logo" />
        <b>.fanontaniana</b>
      </Link>
      <div className="panel row gap-12" style={{ padding: "10px 16px" }}>
        <span className="tiny muted">Code</span>
        <span className="code-chip">{code}</span>
      </div>
    </div>
  );

  // — Phase de correction : le formateur valide les réponses libres —
  if (review) {
    return (
      <div className="container stack gap-24">
        {header}
        <div className="card stack gap-8" style={{ textAlign: "center" }}>
          <span className="eyebrow">Chrono terminé</span>
          <h1 style={{ fontSize: "1.9rem" }}>Validez les réponses libres</h1>
          <p className="muted">
            Validez ou refusez chaque réponse, puis finalisez la session pour
            publier le classement et les notes.
          </p>
        </div>

        {mergedReview ? (
          <ReviewGrader review={mergedReview} onGrade={grade} />
        ) : (
          <div className="panel" style={{ textAlign: "center" }}>
            <div className="spin" style={{ margin: "0 auto" }} />
          </div>
        )}

        <div className="stack gap-8">
          <button
            className="btn btn--primary btn--lg btn--block"
            onClick={finalize}
            disabled={finalizing}
          >
            {finalizing ? "Finalisation…" : "Finaliser et publier le classement"}
          </button>
          <p className="tiny muted" style={{ textAlign: "center" }}>
            {pending > 0
              ? `${pending} réponse${pending > 1 ? "s" : ""} non validée${
                  pending > 1 ? "s" : ""
                } — comptée${pending > 1 ? "s" : ""} comme fausse${
                  pending > 1 ? "s" : ""
                } si vous finalisez maintenant.`
              : "Toutes les réponses libres sont validées."}
          </p>
        </div>
      </div>
    );
  }

  // — Phase en cours / terminée : classement (comportement existant) —
  if (!board) {
    return <div className="center-screen"><div className="spin" /></div>;
  }

  return (
    <div className="container stack gap-24">
      {header}

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
          <div className="stack gap-8" style={{ alignItems: "flex-end" }}>
            <Countdown
              endsAt={endsAt}
              durationMs={state.durationMs}
              serverOffset={offset}
            />
            <button className="btn btn--ghost" onClick={endExam}>
              Terminer l'examen
            </button>
          </div>
        </div>
      )}

      {ended && <Podium podium={board.podium} />}

      <div className="stack gap-12">
        <span className="eyebrow">
          {ended ? "Tous les participants" : "Classement en direct"}
        </span>
        <Leaderboard players={board.leaderboard} />
      </div>

      {ended && state.mode === "examen" && (
        <div className="panel" style={{ textAlign: "center" }}>
          <span className="tiny muted">Coût de cet examen</span>
          <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>
            {board.priceAr} Ar
          </div>
          <span className="tiny muted">
            Débit en fin de session — paiement à venir (non débité)
          </span>
        </div>
      )}

      {ended && (
        <div className="stack gap-12">
          <button
            className="btn btn--primary btn--lg btn--block"
            onClick={() => exportPdf(board)}
          >
            ⬇ Télécharger le classement (PDF)
          </button>
          <Link href="/host" className="btn btn--ghost btn--block">
            Créer un nouveau quiz
          </Link>
        </div>
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
