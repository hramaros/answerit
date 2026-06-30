import { test } from "node:test";
import assert from "node:assert/strict";
import { canAfford, TOPUP_TEST_AR } from "./wallet.js";

test("canAfford : suffisant / insuffisant / égalité / zéro", () => {
  assert.equal(canAfford(5000, 1000), true);
  assert.equal(canAfford(500, 1000), false);
  assert.equal(canAfford(1000, 1000), true);
  assert.equal(canAfford(0, 0), true);
});

test("TOPUP_TEST_AR vaut 5000", () => {
  assert.equal(TOPUP_TEST_AR, 5000);
});
