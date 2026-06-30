import { test } from "node:test";
import assert from "node:assert/strict";
import { examAggregate, aggregateStats } from "./analytics.js";

test("examAggregate : moyennes et meilleur score", () => {
  const a = examAggregate([
    { note: 20, score: 900 },
    { note: 10, score: 300 },
  ]);
  assert.equal(a.avgNote, 15);
  assert.equal(a.avgScore, 600);
  assert.equal(a.topScore, 900);
});

test("examAggregate : classement vide = zéros", () => {
  assert.deepEqual(examAggregate([]), { avgNote: 0, avgScore: 0, topScore: 0 });
});

test("aggregateStats : compte, participants, dépense (débités), note pondérée", () => {
  const s = aggregateStats([
    { participantCount: 2, priceAr: 1000, charged: true, avgNote: 15 },
    { participantCount: 8, priceAr: 2000, charged: true, avgNote: 10 },
    { participantCount: 5, priceAr: 1000, charged: false, avgNote: 12 }, // non débité
  ]);
  assert.equal(s.examCount, 3);
  assert.equal(s.totalParticipants, 15);
  assert.equal(s.totalSpentAr, 3000); // le non-débité est exclu
  // (15*2 + 10*8 + 12*5) / 15 = 170/15 = 11.33 → 11.3
  assert.equal(s.avgNote, 11.3);
});

test("aggregateStats : aucun examen = zéros", () => {
  assert.deepEqual(aggregateStats([]), {
    examCount: 0,
    totalParticipants: 0,
    totalSpentAr: 0,
    avgNote: 0,
  });
});

test("aggregateStats : ignore les records sans avgNote pour la moyenne", () => {
  const s = aggregateStats([
    { participantCount: 3, priceAr: 1000, charged: true }, // ancien record sans avgNote
    { participantCount: 2, priceAr: 1000, charged: true, avgNote: 18 },
  ]);
  assert.equal(s.avgNote, 18); // seul celui avec avgNote compte
  assert.equal(s.examCount, 2);
});
