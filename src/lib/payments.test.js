import { test } from "node:test";
import assert from "node:assert/strict";
import { setRedisClient } from "./redis.js";
import { createAccount, getAccountById } from "./accounts.js";
import { initiateTopup, completeTransaction } from "./payments.js";

function createFakeRedis() {
  const store = new Map();
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  return {
    async set(key, value) {
      store.set(key, clone(value));
      return "OK";
    },
    async get(key) {
      return store.has(key) ? clone(store.get(key)) : null;
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
  };
}

test("initiateTopup (stub) : crédite immédiatement et marque completed", async () => {
  setRedisClient(createFakeRedis());
  const { account } = await createAccount({ email: "p@e.mg", password: "secret1" });
  const res = await initiateTopup(account.id, 5000, "stub");
  assert.equal(res.ok, true);
  assert.equal(res.transaction.status, "completed");
  assert.equal(res.balanceAr, 5000);
  assert.equal((await getAccountById(account.id)).balanceAr, 5000);
});

test("completeTransaction est idempotent (pas de double crédit)", async () => {
  setRedisClient(createFakeRedis());
  const { account } = await createAccount({ email: "p@e.mg", password: "secret1" });
  const res = await initiateTopup(account.id, 5000, "stub");
  const again = await completeTransaction(res.transaction.id);
  assert.equal(again.alreadyCompleted, true);
  assert.equal((await getAccountById(account.id)).balanceAr, 5000);
});

test("provider inconnu ou montant invalide refusés", async () => {
  setRedisClient(createFakeRedis());
  const { account } = await createAccount({ email: "p@e.mg", password: "secret1" });
  assert.equal((await initiateTopup(account.id, 5000, "inexistant")).ok, false);
  assert.equal((await initiateTopup(account.id, 0, "stub")).ok, false);
});
