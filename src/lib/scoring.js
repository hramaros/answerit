/**
 * Logique de scoring — fonctions PURES, sans I/O, testables avec `node --test`.
 *
 * Modèle : score de jeu (style Kahoot, justesse + rapidité) ET note /20
 * (purement académique, basée sur le % de bonnes réponses). Les deux sont distincts.
 */

/**
 * Temps de référence par question (ms) à partir du temps total du quiz.
 * Sert de barème de rapidité : répondre en `refMs` rapporte la moitié des points.
 */
export function refMsForQuiz(totalDurationSec, nbQuestions) {
  const n = Number(nbQuestions) || 0;
  if (n <= 0) return Number(totalDurationSec) * 1000;
  return (Number(totalDurationSec) * 1000) / n;
}

/**
 * Une réponse est correcte si l'ensemble sélectionné == l'ensemble des bonnes
 * réponses (exact, pas de crédit partiel). Valable pour 'single' et 'multiple'.
 */
export function isAnswerCorrect(question, answerIds) {
  const correct = new Set(
    question.answers.filter((a) => a.correct).map((a) => a.id),
  );
  const selected = new Set(answerIds || []);
  if (correct.size !== selected.size) return false;
  for (const id of selected) {
    if (!correct.has(id)) return false;
  }
  return selected.size > 0;
}

/**
 * Points pour une réponse :
 *   - mauvaise → 0
 *   - bonne → basePoints * (1 - 0.5 * min(timeMs/refMs, 1))
 *     (instantané ≈ basePoints, à refMs ou au-delà = basePoints/2)
 */
export function computePoints({ correct, timeMs, refMs, basePoints }) {
  if (!correct) return 0;
  const base = Number(basePoints) || 0;
  const ref = Number(refMs) || 1;
  const t = Math.max(0, Number(timeMs) || 0);
  const factor = 1 - 0.5 * Math.min(t / ref, 1);
  return Math.round(base * factor);
}

/** Note /20 = (bonnes réponses / total) * 20, arrondie à une décimale. */
export function computeNote(nbCorrect, nbQuestions) {
  const n = Number(nbQuestions) || 0;
  if (n <= 0) return 0;
  return Math.round((Number(nbCorrect) / n) * 20 * 10) / 10;
}

/**
 * Trie les participants par score décroissant et attribue un rang en
 * « classement compétition » (les ex æquo partagent le même rang).
 */
export function rankParticipants(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return sorted.map((p) => ({
    ...p,
    rank: 1 + sorted.filter((o) => o.score > p.score).length,
  }));
}

/** Podium = les 3 meilleurs scores (participants déjà triés/classés). */
export function getPodium(rankedPlayers) {
  return rankedPlayers.slice(0, 3);
}
