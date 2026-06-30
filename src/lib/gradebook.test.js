import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGradebook } from "./gradebook.js";

test("buildGradebook : notes par élève + moyenne, absents = null", () => {
  const students = [
    { id: "s1", name: "Alice" },
    { id: "s2", name: "Bob" },
  ];
  const records = [
    {
      id: "e1",
      title: "Exam 1",
      endedAt: 1,
      leaderboard: [
        { studentId: "s1", note: 20 },
        { studentId: "s2", note: 10 },
      ],
    },
    {
      id: "e2",
      title: "Exam 2",
      endedAt: 2,
      leaderboard: [{ studentId: "s1", note: 16 }], // Bob absent
    },
  ];
  const gb = buildGradebook(students, records);
  assert.equal(gb.exams.length, 2);

  const alice = gb.rows.find((r) => r.studentId === "s1");
  assert.equal(alice.notes.e1, 20);
  assert.equal(alice.notes.e2, 16);
  assert.equal(alice.avgNote, 18);

  const bob = gb.rows.find((r) => r.studentId === "s2");
  assert.equal(bob.notes.e1, 10);
  assert.equal(bob.notes.e2, null);
  assert.equal(bob.avgNote, 10);
});

test("buildGradebook : élève sans aucune note → moyenne null", () => {
  const gb = buildGradebook(
    [{ id: "s3", name: "Cara" }],
    [{ id: "e1", title: "X", endedAt: 1, leaderboard: [] }],
  );
  assert.equal(gb.rows[0].avgNote, null);
});
