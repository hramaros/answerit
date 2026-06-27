import { getRedis } from "./redis.js";
import { generateCode, generateId } from "./code.js";
import {
  isAnswerCorrect,
  computePoints,
  computeNote,
  rankParticipants,
  getPodium,
  refMsForQuiz,
} from "./scoring.js";

// Durée de vie d'une salle dans Redis (auto-suppression = côté « éphémère »).
const ROOM_TTL_SEC = 2 * 60 * 60; // 2h

const metaKey = (code) => `room:${code}:meta`;
const playerIdsKey = (code) => `room:${code}:playerIds`;
const playerKey = (code, id) => `room:${code}:player:${id}`;

const now = () => Date.now();

/* ------------------------------------------------------------------ */
/* Statut dérivé                                                       */
/* ------------------------------------------------------------------ */

/**
 * Statut effectif d'une salle. La fin de partie est DÉRIVÉE des timestamps :
 * pas besoin de cron pour clôturer une partie sur Vercel.
 */
export function deriveStatus(meta, ts = now()) {
  if (!meta) return null;
  if (meta.status === "running" && meta.startedAt) {
    if (ts > meta.startedAt + meta.durationMs) return "ended";
  }
  return meta.status;
}

/* ------------------------------------------------------------------ */
/* Salle / meta                                                        */
/* ------------------------------------------------------------------ */

export async function createRoom(hostName) {
  const redis = getRedis();
  let code;
  // Évite les collisions de code (rare, mais on vérifie).
  for (let attempt = 0; attempt < 8; attempt++) {
    code = generateCode();
    const exists = await redis.exists(metaKey(code));
    if (!exists) break;
  }
  const meta = {
    code,
    hostName: String(hostName || "").slice(0, 40) || "Formateur",
    status: "lobby",
    quiz: null,
    startedAt: null,
    durationMs: 0,
    createdAt: now(),
  };
  await redis.set(metaKey(code), meta, { ex: ROOM_TTL_SEC });
  return meta;
}

export async function getMeta(code) {
  const redis = getRedis();
  return (await redis.get(metaKey(code))) || null;
}

async function saveMeta(meta) {
  const redis = getRedis();
  await redis.set(metaKey(meta.code), meta, { ex: ROOM_TTL_SEC });
}

/** Valide la structure d'un quiz. Retourne { ok, error? }. */
export function validateQuiz(quiz) {
  if (!quiz || typeof quiz !== "object") return { ok: false, error: "Quiz manquant." };
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0)
    return { ok: false, error: "Au moins une question est requise." };
  if (!Number(quiz.totalDurationSec) || Number(quiz.totalDurationSec) <= 0)
    return { ok: false, error: "Le temps total doit être supérieur à 0." };
  for (const [i, q] of quiz.questions.entries()) {
    if (!q.text || !String(q.text).trim())
      return { ok: false, error: `Question ${i + 1} : texte manquant.` };
    if (!Array.isArray(q.answers) || q.answers.length < 2)
      return { ok: false, error: `Question ${i + 1} : au moins deux réponses.` };
    const nbCorrect = q.answers.filter((a) => a.correct).length;
    if (nbCorrect < 1)
      return { ok: false, error: `Question ${i + 1} : au moins une bonne réponse.` };
    if (q.type === "single" && nbCorrect > 1)
      return {
        ok: false,
        error: `Question ${i + 1} : une seule bonne réponse en choix unique.`,
      };
    for (const a of q.answers) {
      if (!a.text || !String(a.text).trim())
        return { ok: false, error: `Question ${i + 1} : une réponse est vide.` };
    }
  }
  return { ok: true };
}

/** Normalise un quiz reçu du client (ids, types, bornes). */
function sanitizeQuiz(quiz) {
  return {
    title: String(quiz.title || "Quiz").slice(0, 120),
    totalDurationSec: Math.max(1, Math.round(Number(quiz.totalDurationSec) || 0)),
    questions: quiz.questions.map((q) => ({
      id: q.id || generateId("q"),
      text: String(q.text).slice(0, 500),
      type: q.type === "multiple" ? "multiple" : "single",
      basePoints: Math.max(1, Math.round(Number(q.basePoints) || 1000)),
      answers: q.answers.map((a) => ({
        id: a.id || generateId("a"),
        text: String(a.text).slice(0, 240),
        color: typeof a.color === "string" ? a.color : "#4f46e5",
        correct: !!a.correct,
      })),
    })),
  };
}

export async function setQuiz(code, quiz) {
  const meta = await getMeta(code);
  if (!meta) return { ok: false, error: "Salle introuvable." };
  if (deriveStatus(meta) !== "lobby")
    return { ok: false, error: "Le quiz ne peut plus être modifié." };
  const valid = validateQuiz(quiz);
  if (!valid.ok) return valid;
  meta.quiz = sanitizeQuiz(quiz);
  await saveMeta(meta);
  return { ok: true };
}

export async function startGame(code) {
  const meta = await getMeta(code);
  if (!meta) return { ok: false, error: "Salle introuvable." };
  if (!meta.quiz) return { ok: false, error: "Aucun quiz configuré." };
  if (deriveStatus(meta) !== "lobby")
    return { ok: false, error: "La partie a déjà démarré." };
  meta.status = "running";
  meta.startedAt = now();
  meta.durationMs = meta.quiz.totalDurationSec * 1000;
  await saveMeta(meta);
  return { ok: true, startedAt: meta.startedAt, durationMs: meta.durationMs };
}

/* ------------------------------------------------------------------ */
/* Joueurs                                                             */
/* ------------------------------------------------------------------ */

export async function joinRoom(code) {
  const meta = await getMeta(code);
  if (!meta) return { ok: false, status: 404, error: "Salle introuvable." };
  if (deriveStatus(meta) !== "lobby")
    return { ok: false, status: 409, error: "La partie a déjà commencé." };
  return { ok: true };
}

export async function registerPlayer(code, pseudo) {
  const redis = getRedis();
  const meta = await getMeta(code);
  if (!meta) return { ok: false, status: 404, error: "Salle introuvable." };
  if (deriveStatus(meta) !== "lobby")
    return { ok: false, status: 409, error: "Les inscriptions sont closes." };
  const clean = String(pseudo || "").trim().slice(0, 30);
  if (!clean) return { ok: false, status: 400, error: "Pseudo requis." };

  const id = generateId("p");
  const player = { id, pseudo: clean, score: 0, answered: {}, shownAt: {} };
  await redis.set(playerKey(code, id), player, { ex: ROOM_TTL_SEC });
  await redis.sadd(playerIdsKey(code), id);
  await redis.expire(playerIdsKey(code), ROOM_TTL_SEC);
  return { ok: true, playerId: id, pseudo: clean };
}

export async function getPlayer(code, playerId) {
  const redis = getRedis();
  return (await redis.get(playerKey(code, playerId))) || null;
}

async function savePlayer(code, player) {
  const redis = getRedis();
  await redis.set(playerKey(code, player.id), player, { ex: ROOM_TTL_SEC });
}

export async function listPlayers(code) {
  const redis = getRedis();
  const ids = await redis.smembers(playerIdsKey(code));
  if (!ids || ids.length === 0) return [];
  const keys = ids.map((id) => playerKey(code, id));
  const players = await redis.mget(...keys);
  return players.filter(Boolean);
}

/** Liste légère pour le lobby (pas de données de score sensibles). */
export async function listParticipants(code) {
  const players = await listPlayers(code);
  return players.map((p) => ({ playerId: p.id, pseudo: p.pseudo }));
}

/* ------------------------------------------------------------------ */
/* Déroulé du jeu                                                      */
/* ------------------------------------------------------------------ */

/** Horodatage serveur de l'affichage d'une question (barème de rapidité fiable). */
export async function revealQuestion(code, playerId, questionId) {
  const meta = await getMeta(code);
  if (!meta || deriveStatus(meta) !== "running")
    return { ok: false, error: "Partie non active." };
  const player = await getPlayer(code, playerId);
  if (!player) return { ok: false, error: "Joueur inconnu." };
  if (!player.shownAt[questionId]) {
    player.shownAt[questionId] = now();
    await savePlayer(code, player);
  }
  return { ok: true };
}

export async function submitAnswer(code, playerId, questionId, answerIds) {
  const meta = await getMeta(code);
  if (!meta) return { ok: false, status: 404, error: "Salle introuvable." };
  if (deriveStatus(meta) !== "running")
    return { ok: false, status: 409, error: "Le temps est écoulé." };

  const question = meta.quiz?.questions.find((q) => q.id === questionId);
  if (!question) return { ok: false, status: 400, error: "Question inconnue." };

  const player = await getPlayer(code, playerId);
  if (!player) return { ok: false, status: 404, error: "Joueur inconnu." };
  if (player.answered[questionId])
    return { ok: false, status: 409, error: "Question déjà répondue." };

  const shownAt = player.shownAt[questionId] || meta.startedAt;
  const timeMs = now() - shownAt;
  const refMs = refMsForQuiz(
    meta.quiz.totalDurationSec,
    meta.quiz.questions.length,
  );
  const correct = isAnswerCorrect(question, answerIds);
  const points = computePoints({
    correct,
    timeMs,
    refMs,
    basePoints: question.basePoints,
  });

  player.answered[questionId] = {
    answerIds: Array.isArray(answerIds) ? answerIds : [],
    correct,
    timeMs,
    points,
  };
  player.score += points;
  await savePlayer(code, player);

  return { ok: true, correct, points, score: player.score };
}

/* ------------------------------------------------------------------ */
/* Résultats                                                           */
/* ------------------------------------------------------------------ */

export async function getLeaderboard(code) {
  const meta = await getMeta(code);
  if (!meta) return null;
  const players = await listPlayers(code);
  const ranked = rankParticipants(
    players.map((p) => ({
      id: p.id,
      pseudo: p.pseudo,
      score: p.score,
      nbCorrect: Object.values(p.answered || {}).filter((a) => a.correct).length,
    })),
  );
  const nbQuestions = meta.quiz?.questions.length || 0;
  const withNote = ranked.map((p) => ({
    ...p,
    note: computeNote(p.nbCorrect, nbQuestions),
  }));
  return {
    status: deriveStatus(meta),
    leaderboard: withNote,
    podium: getPodium(withNote),
    nbQuestions,
  };
}

/** Résultat personnel d'un participant : score, note /20, rang, total joueurs. */
export async function getMe(code, playerId) {
  const board = await getLeaderboard(code);
  if (!board) return null;
  const me = board.leaderboard.find((p) => p.id === playerId);
  if (!me) return null;
  return {
    score: me.score,
    note: me.note,
    rank: me.rank,
    total: board.leaderboard.length,
    nbCorrect: me.nbCorrect,
    nbQuestions: board.nbQuestions,
    status: board.status,
  };
}
