import { test } from "node:test";
import assert from "node:assert/strict";
import { setRedisClient } from "./redis.js";
import {
  saveExamRecord,
  listExamRecords,
  getExamRecord,
  getClassExamRecords,
} from "./history.js";

function createFakeRedis() {
  const store = new Map();
  const lists = new Map();
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const end = (arr, stop) => (stop < 0 ? arr.length + stop + 1 : stop + 1);
  return {
    async set(key, value) {
      store.set(key, clone(value));
      return "OK";
    },
    async get(key) {
      return store.has(key) ? clone(store.get(key)) : null;
    },
    async lpush(key, ...vals) {
      const arr = lists.get(key) || [];
      for (const v of vals.flat()) arr.unshift(v);
      lists.set(key, arr);
      return arr.length;
    },
    async lrange(key, start, stop) {
      const arr = lists.get(key) || [];
      return arr.slice(start, end(arr, stop)).map(clone);
    },
    async ltrim(key, start, stop) {
      const arr = lists.get(key) || [];
      lists.set(key, arr.slice(start, end(arr, stop)));
      return "OK";
    },
    async mget(...keys) {
      return keys.flat().map((k) => (store.has(k) ? clone(store.get(k)) : null));
    },
  };
}

function rec(id, accountId, extra = {}) {
  return {
    id,
    accountId,
    code: "ABC123",
    title: "Exam " + id,
    mode: "examen",
    capacity: "small",
    priceAr: 1000,
    charged: true,
    nbQuestions: 1,
    participantCount: 2,
    endedAt: Date.now(),
    leaderboard: [{ pseudo: "Alice", score: 900, note: 20, rank: 1, nbCorrect: 1 }],
    podium: [],
    ...extra,
  };
}

test("saveExamRecord puis listExamRecords (plus récent en tête, résumé)", async () => {
  setRedisClient(createFakeRedis());
  await saveExamRecord(rec("ex1", "acc1"));
  await saveExamRecord(rec("ex2", "acc1"));
  const list = await listExamRecords("acc1");
  assert.equal(list.length, 2);
  assert.equal(list[0].id, "ex2"); // dernier sauvegardé en premier
  assert.equal(list[0].title, "Exam ex2");
  assert.equal(list[0].leaderboard, undefined); // résumé seulement
});

test("getExamRecord respecte l'appartenance au compte", async () => {
  setRedisClient(createFakeRedis());
  await saveExamRecord(rec("ex1", "acc1"));
  assert.equal((await getExamRecord("acc1", "ex1")).id, "ex1");
  assert.equal((await getExamRecord("acc1", "ex1")).leaderboard.length, 1);
  assert.equal(await getExamRecord("acc2", "ex1"), null); // autre compte
  assert.equal(await getExamRecord("acc1", "inconnu"), null);
});

test("historique isolé par compte", async () => {
  setRedisClient(createFakeRedis());
  await saveExamRecord(rec("ex1", "acc1"));
  await saveExamRecord(rec("ex2", "acc2"));
  assert.equal((await listExamRecords("acc1")).length, 1);
  assert.equal((await listExamRecords("acc2")).length, 1);
});

test("index par classe : getClassExamRecords (ordre chronologique)", async () => {
  setRedisClient(createFakeRedis());
  await saveExamRecord(rec("ex1", "acc1", { classId: "c1" }));
  await saveExamRecord(rec("ex2", "acc1", { classId: "c1" }));
  await saveExamRecord(rec("ex3", "acc1", { classId: "c2" }));

  const c1 = await getClassExamRecords("c1");
  assert.equal(c1.length, 2);
  assert.equal(c1[0].id, "ex1"); // plus ancien d'abord
  assert.equal(c1[1].id, "ex2");
  assert.equal((await getClassExamRecords("c2")).length, 1);
  assert.equal((await getClassExamRecords("inexistante")).length, 0);
});
