import { test } from "node:test";
import assert from "node:assert/strict";
import { setRedisClient } from "./redis.js";
import {
  createRoom,
  setQuiz,
  startGame,
  joinRoom,
  registerPlayer,
  revealQuestion,
  submitAnswer,
  getLeaderboard,
  getMe,
  deriveStatus,
} from "./rooms.js";

// Faux Redis en mémoire qui clone les valeurs (mime la (dé)sérialisation Upstash
// et attrape ainsi les bugs de mutation par référence).
function createFakeRedis() {
  const store = new Map();
  const sets = new Map();
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  return {
    async set(key, value) {
      store.set(key, clone(value));
      return "OK";
    },
    async get(key) {
      return store.has(key) ? clone(store.get(key)) : null;
    },
    async exists(key) {
      return store.has(key) ? 1 : 0;
    },
    async sadd(key, ...members) {
      const s = sets.get(key) || new Set();
      members.flat().forEach((m) => s.add(m));
      sets.set(key, s);
      return members.length;
    },
    async smembers(key) {
      return [...(sets.get(key) || [])];
    },
    async mget(...keys) {
      return keys.flat().map((k) => (store.has(k) ? clone(store.get(k)) : null));
    },
    async expire() {
      return 1;
    },
  };
}

const sampleQuiz = {
  title: "Capitales",
  totalDurationSec: 60,
  questions: [
    {
      text: "Capitale de la France ?",
      type: "single",
      basePoints: 1000,
      answers: [
        { text: "Paris", color: "#fff", correct: true },
        { text: "Lyon", color: "#fff", correct: false },
      ],
    },
    {
      text: "Lesquelles sont des îles ?",
      type: "multiple",
      basePoints: 1000,
      answers: [
        { text: "Madagascar", color: "#fff", correct: true },
        { text: "Maurice", color: "#fff", correct: true },
        { text: "Mali", color: "#fff", correct: false },
      ],
    },
  ],
};

test("flux complet : création → jeu → classement", async () => {
  setRedisClient(createFakeRedis());

  // 1) Création de la salle
  const meta = await createRoom("Prof");
  const code = meta.code;
  assert.ok(code, "un code est généré");
  assert.equal(deriveStatus(meta), "lobby");

  // 2) Configuration du quiz
  const quizRes = await setQuiz(code, sampleQuiz);
  assert.equal(quizRes.ok, true);

  // 3) Inscription de deux joueurs en lobby
  assert.equal((await joinRoom(code)).ok, true);
  const alice = await registerPlayer(code, "Alice");
  const bob = await registerPlayer(code, "Bob");
  assert.ok(alice.playerId && bob.playerId);

  // 4) Lancement → inscriptions closes
  const start = await startGame(code);
  assert.equal(start.ok, true);
  const refused = await joinRoom(code);
  assert.equal(refused.ok, false);
  assert.equal(refused.status, 409);

  // Récupère les ids de questions tels que stockés
  const board0 = await getLeaderboard(code);
  assert.equal(board0.status, "running");

  // On relit la meta via getMe plus tard ; ici on rejoue les ids depuis le quiz
  // sanitizé en passant par une réponse.
  const { getMeta } = await import("./rooms.js");
  const full = await getMeta(code);
  const [q1, q2] = full.quiz.questions;

  // 5) Alice répond juste aux deux questions
  await revealQuestion(code, alice.playerId, q1.id);
  const a1 = await submitAnswer(code, alice.playerId, q1.id, [
    q1.answers.find((a) => a.correct).id,
  ]);
  assert.equal(a1.correct, true);
  assert.ok(a1.points > 0, "bonne réponse rapide = points positifs");

  await revealQuestion(code, alice.playerId, q2.id);
  const correctMulti = q2.answers.filter((a) => a.correct).map((a) => a.id);
  const a2 = await submitAnswer(code, alice.playerId, q2.id, correctMulti);
  assert.equal(a2.correct, true);

  // Double réponse à la même question → refusée
  const dup = await submitAnswer(code, alice.playerId, q1.id, []);
  assert.equal(dup.ok, false);
  assert.equal(dup.status, 409);

  // 6) Bob répond faux à la Q1, partiel à la Q2 (donc faux)
  await revealQuestion(code, bob.playerId, q1.id);
  const b1 = await submitAnswer(code, bob.playerId, q1.id, [
    q1.answers.find((a) => !a.correct).id,
  ]);
  assert.equal(b1.correct, false);
  assert.equal(b1.points, 0);

  await revealQuestion(code, bob.playerId, q2.id);
  const b2 = await submitAnswer(code, bob.playerId, q2.id, [correctMulti[0]]);
  assert.equal(b2.correct, false, "sous-ensemble = faux (pas de crédit partiel)");

  // 7) Classement : Alice 1re, Bob 2e
  const board = await getLeaderboard(code);
  assert.equal(board.leaderboard[0].pseudo, "Alice");
  assert.equal(board.leaderboard[0].rank, 1);
  assert.equal(board.leaderboard[1].pseudo, "Bob");
  assert.equal(board.leaderboard[1].rank, 2);
  assert.equal(board.podium.length, 2);

  // 8) Résultat personnel d'Alice : 2/2 bonnes → note 20/20
  const meAlice = await getMe(code, alice.playerId);
  assert.equal(meAlice.rank, 1);
  assert.equal(meAlice.nbCorrect, 2);
  assert.equal(meAlice.note, 20);

  const meBob = await getMe(code, bob.playerId);
  assert.equal(meBob.score, 0);
  assert.equal(meBob.note, 0);
});

test("setQuiz refuse un quiz invalide (aucune bonne réponse)", async () => {
  setRedisClient(createFakeRedis());
  const meta = await createRoom("Prof");
  const res = await setQuiz(meta.code, {
    title: "X",
    totalDurationSec: 30,
    questions: [
      {
        text: "Q",
        type: "single",
        basePoints: 1000,
        answers: [
          { text: "a", color: "#fff", correct: false },
          { text: "b", color: "#fff", correct: false },
        ],
      },
    ],
  });
  assert.equal(res.ok, false);
  assert.match(res.error, /bonne réponse/i);
});
