# Mode Examen + Gating — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduire le choix de **mode** (Libre / Examen) à la création d'un quiz, avec plafonds de participants, déblocage de la réponse libre + export en mode Examen, un bouton « Terminer l'examen », et un calcul de prix/débit en fin de session (stub, sans paiement réel).

**Architecture:** On étend le modèle de salle existant (`src/lib/rooms.js`, état Redis éphémère) avec deux champs de quiz (`mode`, `capacity`) et un timestamp de fin manuelle (`endedAt`). Toute la logique tarifaire/plafond est isolée dans un module **pur et testable** `src/lib/exam.js` (comme `scoring.js`). Le débit réel est hors périmètre (phases 2-3) : la fin de session enregistre seulement une **intention de débit** (`meta.settled`, `charged:false`).

**Tech Stack:** Next.js App Router (route handlers serverless), Upstash Redis, tests purs via `node:test`. Pas de framework de test composant → les tâches UI se vérifient par `npx next build` + vérification manuelle.

## Global Constraints

- **Plafonds d'inscription** : Libre = **10**, Examen ≤ 20 = **20**, Examen illimité = **aucun**.
- **Prix (Ariary), débité en fin de session** : Libre = **0**, Examen ≤ 20 = **1000**, Examen illimité = **2000**.
- **Réponse libre + export PDF** : disponibles **uniquement en mode Examen**.
- **Débit réel** : hors périmètre. La fin de session enregistre `meta.settled = { amountAr, currency:"MGA", at, charged:false }`. Aucun encaissement.
- **Pas de comptes/auth** en phase 1 (le mode Examen est utilisable sans login ; le débit est neutre).
- Valeurs de `mode` : `"libre" | "examen"`. Valeurs de `capacity` : `"small" | "unlimited"`.
- Tests : `node --test "src/**/*.test.js"` (script `npm test`). Build : `npx next build`.
- Commits fréquents, un par tâche, messages en français préfixés `feat:`/`test:`.

## File Structure

- **Create** `src/lib/exam.js` — module pur : constantes, `normalizeMode`, `normalizeCapacity`, `maxParticipants`, `examPriceAr`.
- **Create** `src/lib/exam.test.js` — tests purs du module.
- **Modify** `src/lib/rooms.js` — `createRoom` (champs `endedAt`/`settled`), `sanitizeQuiz` (mode/capacity), `validateQuiz` (réponse libre ⇒ examen), `registerPlayer` (plafond), `deriveStatus` (fin manuelle), nouvelle `endSession`, `getLeaderboard` (prix + settlement).
- **Modify** `src/lib/rooms.test.js` — tests des nouvelles règles.
- **Create** `src/app/api/host/[code]/end/route.js` — route POST « Terminer l'examen ».
- **Modify** `src/app/api/room/[code]/state/route.js` — exposer `mode`/`capacity`.
- **Modify** `src/app/host/page.jsx` — sélecteur de mode + toggle capacité, transmis dans le quiz.
- **Modify** `src/components/QuestionBuilder.jsx` — masquer le type « Réponse libre » hors mode Examen (prop `mode`).
- **Modify** `src/app/host/results/page.jsx` — bouton « Terminer l'examen » + affichage du coût.
- **Modify** `src/app/join/page.jsx` — message « salle pleine » lisible.

---

### Task 1: Module pur `exam.js` (modes, plafonds, prix)

**Files:**
- Create: `src/lib/exam.js`
- Test: `src/lib/exam.test.js`

**Interfaces:**
- Produces:
  - `MODE_LIBRE = "libre"`, `MODE_EXAMEN = "examen"`, `CAP_SMALL = "small"`, `CAP_UNLIMITED = "unlimited"`
  - `LIBRE_MAX = 10`, `EXAMEN_SMALL_MAX = 20`, `PRICE_SMALL_AR = 1000`, `PRICE_UNLIMITED_AR = 2000`
  - `normalizeMode(mode) -> "libre"|"examen"` (défaut `"libre"`)
  - `normalizeCapacity(capacity) -> "small"|"unlimited"` (défaut `"small"`)
  - `maxParticipants(mode, capacity) -> number|null` (null = illimité)
  - `examPriceAr(mode, capacity) -> number` (Ariary)

- [ ] **Step 1: Write the failing test**

Create `src/lib/exam.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMode,
  normalizeCapacity,
  maxParticipants,
  examPriceAr,
  LIBRE_MAX,
  EXAMEN_SMALL_MAX,
} from "./exam.js";

test("normalizeMode : défaut libre, examen reconnu", () => {
  assert.equal(normalizeMode("examen"), "examen");
  assert.equal(normalizeMode("libre"), "libre");
  assert.equal(normalizeMode(undefined), "libre");
  assert.equal(normalizeMode("n'importe"), "libre");
});

test("normalizeCapacity : défaut small, unlimited reconnu", () => {
  assert.equal(normalizeCapacity("unlimited"), "unlimited");
  assert.equal(normalizeCapacity("small"), "small");
  assert.equal(normalizeCapacity(undefined), "small");
});

test("maxParticipants : Libre=10, Examen small=20, Examen unlimited=null", () => {
  assert.equal(maxParticipants("libre", undefined), LIBRE_MAX);
  assert.equal(maxParticipants("libre", "unlimited"), LIBRE_MAX); // libre ignore capacity
  assert.equal(maxParticipants("examen", "small"), EXAMEN_SMALL_MAX);
  assert.equal(maxParticipants("examen", "unlimited"), null);
});

test("examPriceAr : Libre=0, Examen small=1000, Examen unlimited=2000", () => {
  assert.equal(examPriceAr("libre", "small"), 0);
  assert.equal(examPriceAr("examen", "small"), 1000);
  assert.equal(examPriceAr("examen", "unlimited"), 2000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/exam.test.js`
Expected: FAIL — `Cannot find module './exam.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/exam.js`:

```js
// Logique PURE des modes de quiz (sans I/O), testable avec `node --test`.
// Mode Libre = gratuit, plafonné. Mode Examen = payant (débit en fin de session).

export const MODE_LIBRE = "libre";
export const MODE_EXAMEN = "examen";
export const CAP_SMALL = "small";
export const CAP_UNLIMITED = "unlimited";

export const LIBRE_MAX = 10;
export const EXAMEN_SMALL_MAX = 20;
export const PRICE_SMALL_AR = 1000;
export const PRICE_UNLIMITED_AR = 2000;

export function normalizeMode(mode) {
  return mode === MODE_EXAMEN ? MODE_EXAMEN : MODE_LIBRE;
}

export function normalizeCapacity(capacity) {
  return capacity === CAP_UNLIMITED ? CAP_UNLIMITED : CAP_SMALL;
}

/** Plafond d'inscription dans la salle. `null` = illimité (Examen illimité). */
export function maxParticipants(mode, capacity) {
  if (normalizeMode(mode) === MODE_LIBRE) return LIBRE_MAX;
  return normalizeCapacity(capacity) === CAP_UNLIMITED ? null : EXAMEN_SMALL_MAX;
}

/** Prix en Ariary débité en fin de session (0 en mode Libre). */
export function examPriceAr(mode, capacity) {
  if (normalizeMode(mode) === MODE_LIBRE) return 0;
  return normalizeCapacity(capacity) === CAP_UNLIMITED
    ? PRICE_UNLIMITED_AR
    : PRICE_SMALL_AR;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/exam.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/exam.js src/lib/exam.test.js
git commit -m "feat: module pur exam.js (modes, plafonds, prix)"
```

---

### Task 2: Persister mode/capacity + gater la réponse libre à la validation du quiz

**Files:**
- Modify: `src/lib/rooms.js` (`createRoom`, `sanitizeQuiz`, `validateQuiz`)
- Test: `src/lib/rooms.test.js`

**Interfaces:**
- Consumes: `normalizeMode`, `normalizeCapacity` from `src/lib/exam.js`
- Produces: `meta.quiz.mode` (`"libre"|"examen"`), `meta.quiz.capacity` (`"small"|"unlimited"`), `meta.endedAt` (`number|null`), `meta.settled` (`object|null`). `validateQuiz` rejette une question `free` si `quiz.mode !== "examen"`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/rooms.test.js`:

```js
test("setQuiz refuse une réponse libre en mode Libre", async () => {
  setRedisClient(createFakeRedis());
  const meta = await createRoom("Prof");
  const res = await setQuiz(meta.code, {
    title: "X",
    mode: "libre",
    totalDurationSec: 30,
    questions: [{ text: "Ouvrez", type: "free", basePoints: 500 }],
  });
  assert.equal(res.ok, false);
  assert.match(res.error, /mode Examen/i);
});

test("setQuiz : mode/capacity normalisés et persistés", async () => {
  setRedisClient(createFakeRedis());
  const meta = await createRoom("Prof");
  const res = await setQuiz(meta.code, {
    title: "Exam",
    mode: "examen",
    capacity: "unlimited",
    totalDurationSec: 60,
    questions: [{ text: "Ouvrez", type: "free", basePoints: 500 }],
  });
  assert.equal(res.ok, true);
  const full = await getMeta(meta.code);
  assert.equal(full.quiz.mode, "examen");
  assert.equal(full.quiz.capacity, "unlimited");
  assert.equal(full.endedAt, null);
  assert.equal(full.settled, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/rooms.test.js`
Expected: FAIL (mode non persisté / réponse libre acceptée en libre).

- [ ] **Step 3: Add import + createRoom fields**

In `src/lib/rooms.js`, add the import near the existing `scoring.js` import:

```js
import { normalizeMode, normalizeCapacity } from "./exam.js";
```

In `createRoom`, extend the `meta` object (add the two fields after `durationMs: 0,`):

```js
    durationMs: 0,
    finalizedAt: null,
    endedAt: null,
    settled: null,
    createdAt: now(),
```

- [ ] **Step 4: Persist mode/capacity in sanitizeQuiz**

Replace the `return {` opening of `sanitizeQuiz` (the object with `title`/`totalDurationSec`/`questions`) so it includes mode/capacity:

```js
function sanitizeQuiz(quiz) {
  return {
    title: String(quiz.title || "Quiz").slice(0, 120),
    mode: normalizeMode(quiz.mode),
    capacity: normalizeCapacity(quiz.capacity),
    totalDurationSec: Math.max(1, Math.round(Number(quiz.totalDurationSec) || 0)),
    questions: quiz.questions.map((q) => {
```

(Leave the rest of `sanitizeQuiz` unchanged.)

- [ ] **Step 5: Gate free questions in validateQuiz**

In `validateQuiz`, replace the line `if (q.type === "free") continue;` with a mode-aware guard:

```js
    // Réponse libre : réservée au mode Examen ; pas de réponses prédéfinies.
    if (q.type === "free") {
      if (normalizeMode(quiz.mode) !== "examen")
        return {
          ok: false,
          error: `Question ${i + 1} : la réponse libre nécessite le mode Examen.`,
        };
      continue;
    }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test "src/**/*.test.js"`
Expected: PASS (all, including the 2 new ones).

- [ ] **Step 7: Commit**

```bash
git add src/lib/rooms.js src/lib/rooms.test.js
git commit -m "feat: persiste mode/capacity et gate la réponse libre au mode Examen"
```

---

### Task 3: Plafonner les inscriptions selon le mode

**Files:**
- Modify: `src/lib/rooms.js` (`registerPlayer`)
- Test: `src/lib/rooms.test.js`

**Interfaces:**
- Consumes: `maxParticipants` from `src/lib/exam.js`
- Produces: `registerPlayer` renvoie `{ ok:false, status:409, error:"Salle pleine (max N participants)." }` quand le plafond est atteint.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/rooms.test.js`:

```js
test("registerPlayer : mode Libre plafonné à 10", async () => {
  setRedisClient(createFakeRedis());
  const meta = await createRoom("Prof");
  await setQuiz(meta.code, {
    title: "Libre",
    mode: "libre",
    totalDurationSec: 60,
    questions: [
      {
        text: "2+2 ?",
        type: "single",
        basePoints: 1000,
        answers: [
          { text: "4", color: "#fff", correct: true },
          { text: "5", color: "#fff", correct: false },
        ],
      },
    ],
  });
  for (let i = 0; i < 10; i++) {
    const r = await registerPlayer(meta.code, `J${i}`);
    assert.equal(r.ok, true, `inscription ${i} acceptée`);
  }
  const over = await registerPlayer(meta.code, "Onzième");
  assert.equal(over.ok, false);
  assert.equal(over.status, 409);
  assert.match(over.error, /pleine/i);
});

test("registerPlayer : Examen illimité n'a pas de plafond", async () => {
  setRedisClient(createFakeRedis());
  const meta = await createRoom("Prof");
  await setQuiz(meta.code, {
    title: "Exam",
    mode: "examen",
    capacity: "unlimited",
    totalDurationSec: 60,
    questions: [{ text: "Ouvrez", type: "free", basePoints: 500 }],
  });
  for (let i = 0; i < 25; i++) {
    const r = await registerPlayer(meta.code, `J${i}`);
    assert.equal(r.ok, true);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/rooms.test.js`
Expected: FAIL — la 11ᵉ inscription est acceptée (pas de plafond).

- [ ] **Step 3: Enforce the cap in registerPlayer**

In `src/lib/rooms.js`, extend the import from `./exam.js`:

```js
import { normalizeMode, normalizeCapacity, maxParticipants } from "./exam.js";
```

In `registerPlayer`, after the pseudo validation (`if (!clean) return { ... }`) and before `const id = generateId("p");`, insert:

```js
  const cap = maxParticipants(meta.quiz?.mode, meta.quiz?.capacity);
  if (cap !== null) {
    const current = (await redis.smembers(playerIdsKey(code))).length;
    if (current >= cap)
      return {
        ok: false,
        status: 409,
        error: `Salle pleine (max ${cap} participants).`,
      };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test "src/**/*.test.js"`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rooms.js src/lib/rooms.test.js
git commit -m "feat: plafonne les inscriptions (Libre 10, Examen 20, illimité sans plafond)"
```

---

### Task 4: Fin de session manuelle (« Terminer l'examen »)

**Files:**
- Modify: `src/lib/rooms.js` (`deriveStatus`, new `endSession`)
- Test: `src/lib/rooms.test.js`

**Interfaces:**
- Produces: `endSession(code) -> { ok, endedAt }`. `deriveStatus` clôt la session si `meta.endedAt` est passé, même avant la fin du chrono (→ `"review"` si réponse libre, sinon `"ended"`).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/rooms.test.js`:

```js
test("endSession : clôture immédiate avant la fin du chrono", async () => {
  setRedisClient(createFakeRedis());
  const meta = await createRoom("Prof");
  await setQuiz(meta.code, {
    title: "Exam",
    mode: "examen",
    capacity: "small",
    totalDurationSec: 600, // long chrono
    questions: [
      {
        text: "2+2 ?",
        type: "single",
        basePoints: 1000,
        answers: [
          { text: "4", color: "#fff", correct: true },
          { text: "5", color: "#fff", correct: false },
        ],
      },
    ],
  });
  await registerPlayer(meta.code, "Alice");
  await startGame(meta.code);

  // Avant fin manuelle : en cours
  assert.equal(deriveStatus(await getMeta(meta.code)), "running");

  const end = await endSession(meta.code);
  assert.equal(end.ok, true);
  assert.ok(end.endedAt > 0);

  // Pas de réponse libre → terminé directement
  assert.equal(deriveStatus(await getMeta(meta.code)), "ended");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/rooms.test.js`
Expected: FAIL — `endSession is not a function`.

- [ ] **Step 3: Update deriveStatus to honour endedAt**

In `src/lib/rooms.js`, replace the `deriveStatus` body's running branch:

```js
export function deriveStatus(meta, ts = now()) {
  if (!meta) return null;
  if (meta.finalizedAt) return "ended";
  if (meta.status === "running" && meta.startedAt) {
    const chronoEnd = meta.startedAt + meta.durationMs;
    const effectiveEnd = meta.endedAt ? Math.min(chronoEnd, meta.endedAt) : chronoEnd;
    if (ts <= effectiveEnd) return "running";
    return quizHasFree(meta.quiz) ? "review" : "ended";
  }
  return meta.status;
}
```

- [ ] **Step 4: Add endSession**

In `src/lib/rooms.js`, add after `startGame` (before the Joueurs section):

```js
/** Fin de session manuelle par le formateur (« Terminer l'examen »). */
export async function endSession(code) {
  const meta = await getMeta(code);
  if (!meta) return { ok: false, status: 404, error: "Salle introuvable." };
  if (meta.status !== "running" || !meta.startedAt)
    return { ok: false, status: 409, error: "Aucune session en cours." };
  if (!meta.endedAt) {
    meta.endedAt = now();
    await saveMeta(meta);
  }
  return { ok: true, endedAt: meta.endedAt };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test "src/**/*.test.js"`
Expected: PASS (all). Verify the existing free-response test (chrono-derived review) still passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rooms.js src/lib/rooms.test.js
git commit -m "feat: fin de session manuelle (endSession) prise en compte par deriveStatus"
```

---

### Task 5: Prix de l'examen + settlement stub (intention de débit)

**Files:**
- Modify: `src/lib/rooms.js` (`getLeaderboard`)
- Test: `src/lib/rooms.test.js`

**Interfaces:**
- Consumes: `examPriceAr` from `src/lib/exam.js`
- Produces: `getLeaderboard` renvoie `mode`, `capacity`, `priceAr`. Quand le statut dérivé est `"ended"` en mode Examen et `meta.settled` est vide, il enregistre `meta.settled = { amountAr, currency:"MGA", at, charged:false }` et le renvoie dans `board.settled`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/rooms.test.js`:

```js
test("getLeaderboard : prix exposé + settlement à la clôture (Examen)", async () => {
  setRedisClient(createFakeRedis());
  const meta = await createRoom("Prof");
  await setQuiz(meta.code, {
    title: "Exam",
    mode: "examen",
    capacity: "small",
    totalDurationSec: 600,
    questions: [
      {
        text: "2+2 ?",
        type: "single",
        basePoints: 1000,
        answers: [
          { text: "4", color: "#fff", correct: true },
          { text: "5", color: "#fff", correct: false },
        ],
      },
    ],
  });
  await registerPlayer(meta.code, "Alice");
  await startGame(meta.code);

  // En cours : prix exposé, pas encore réglé
  let board = await getLeaderboard(meta.code);
  assert.equal(board.priceAr, 1000);
  assert.equal(board.settled, null);

  // Clôture manuelle → settlement enregistré (intention, non débité)
  await endSession(meta.code);
  board = await getLeaderboard(meta.code);
  assert.equal(board.status, "ended");
  assert.ok(board.settled);
  assert.equal(board.settled.amountAr, 1000);
  assert.equal(board.settled.charged, false);

  // Persisté et idempotent
  const full = await getMeta(meta.code);
  assert.equal(full.settled.amountAr, 1000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/rooms.test.js`
Expected: FAIL — `board.priceAr` est `undefined`.

- [ ] **Step 3: Add import + settlement logic**

In `src/lib/rooms.js`, extend the `./exam.js` import:

```js
import {
  normalizeMode,
  normalizeCapacity,
  maxParticipants,
  examPriceAr,
} from "./exam.js";
```

In `getLeaderboard`, replace the block from `const nbQuestions = ...` through the `return { ... }` with:

```js
  const nbQuestions = meta.quiz?.questions.length || 0;
  const withNote = ranked.map((p) => ({
    ...p,
    note: computeNote(p.nbCorrect, nbQuestions),
  }));

  const status = deriveStatus(meta);
  const mode = meta.quiz?.mode || "libre";
  const capacity = meta.quiz?.capacity || "small";
  const priceAr = examPriceAr(mode, capacity);

  // Stub de débit : à la clôture d'un Examen, on enregistre l'intention
  // (le débit réel arrive avec le wallet en phase 3 ; charged reste false).
  if (status === "ended" && mode === "examen" && !meta.settled) {
    meta.settled = { amountAr: priceAr, currency: "MGA", at: now(), charged: false };
    await saveMeta(meta);
  }

  return {
    status,
    code: meta.code,
    title: meta.quiz?.title || "Quiz",
    mode,
    capacity,
    priceAr,
    settled: meta.settled || null,
    leaderboard: withNote,
    podium: getPodium(withNote),
    nbQuestions,
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test "src/**/*.test.js"`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rooms.js src/lib/rooms.test.js
git commit -m "feat: expose le prix de l'examen et enregistre l'intention de débit à la clôture"
```

---

### Task 6: Route API « Terminer l'examen » + exposer le mode dans /state

**Files:**
- Create: `src/app/api/host/[code]/end/route.js`
- Modify: `src/app/api/room/[code]/state/route.js`

**Interfaces:**
- Consumes: `endSession` (Task 4) from `src/lib/rooms.js`
- Produces: `POST /api/host/[code]/end -> { ok:true }`. `GET /api/room/[code]/state` renvoie en plus `mode` et `capacity`.

- [ ] **Step 1: Create the end route**

Create `src/app/api/host/[code]/end/route.js`:

```js
import { endSession } from "@/lib/rooms";
import { json, codeFromParams, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

// Le formateur termine la session avant la fin du chrono.
export const POST = handler(async (_request, { params }) => {
  const code = await codeFromParams(params);
  const result = await endSession(code);
  if (!result.ok) return json({ error: result.error }, result.status || 400);
  return json({ ok: true, endedAt: result.endedAt });
});
```

- [ ] **Step 2: Expose mode/capacity in /state**

In `src/app/api/room/[code]/state/route.js`, add two fields to the returned JSON (after `nbQuestions: ...`):

```js
    nbQuestions: meta.quiz?.questions.length || 0,
    mode: meta.quiz?.mode || null,
    capacity: meta.quiz?.capacity || null,
```

- [ ] **Step 3: Verify the build**

Run: `npx next build`
Expected: success; route list includes `ƒ /api/host/[code]/end`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/host/[code]/end/route.js src/app/api/room/[code]/state/route.js
git commit -m "feat: route POST end (terminer l'examen) + mode/capacity dans /state"
```

---

### Task 7: Sélecteur de mode + toggle capacité dans le créateur

**Files:**
- Modify: `src/app/host/page.jsx`

**Interfaces:**
- Consumes: `POST /api/host/[code]/quiz` (déjà existant) — on ajoute `mode` et `capacity` dans `quiz`.
- Produces: l'état `mode`/`capacity` est choisi à l'étape identité et inclus dans le payload `saveAndLaunch`. Le composant passe `mode` à `QuestionBuilder` (consommé en Task 8).

- [ ] **Step 1: Add mode/capacity state**

In `src/app/host/page.jsx`, add two state hooks next to the existing ones (after `const [duration, setDuration] = useState(120);`):

```js
  const [mode, setMode] = useState("libre");
  const [capacity, setCapacity] = useState("small");
```

- [ ] **Step 2: Include mode/capacity in the saved quiz**

In `saveAndLaunch`, extend the `quiz` object:

```js
    const quiz = {
      title: title.trim() || "Quiz",
      mode,
      capacity,
      totalDurationSec: Number(duration),
      questions,
    };
```

- [ ] **Step 3: Add the mode selector to the identity step**

In the identity-step form (the `step === "identity"` return), insert this block immediately before the `{error && ...}` line:

```jsx
            <div>
              <label className="label">Mode</label>
              <div className="seg" role="group" aria-label="Mode du quiz">
                <button
                  type="button"
                  aria-pressed={mode === "libre"}
                  onClick={() => setMode("libre")}
                >
                  Libre (gratuit)
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "examen"}
                  onClick={() => setMode("examen")}
                >
                  Examen
                </button>
              </div>
              {mode === "libre" ? (
                <p className="tiny muted" style={{ marginTop: 6 }}>
                  Gratuit, sans compte — jusqu'à 10 participants. QCM uniquement.
                </p>
              ) : (
                <div className="stack gap-8" style={{ marginTop: 10 }}>
                  <div className="seg" role="group" aria-label="Capacité de l'examen">
                    <button
                      type="button"
                      aria-pressed={capacity === "small"}
                      onClick={() => setCapacity("small")}
                    >
                      ≤ 20 participants · 1 000 Ar
                    </button>
                    <button
                      type="button"
                      aria-pressed={capacity === "unlimited"}
                      onClick={() => setCapacity("unlimited")}
                    >
                      Illimité · 2 000 Ar
                    </button>
                  </div>
                  <p className="tiny muted">
                    Débloque la réponse libre et l'export. Débité en fin de session
                    (paiement à venir).
                  </p>
                </div>
              )}
            </div>
```

- [ ] **Step 4: Pass mode to QuestionBuilder**

In the build-step return, add the `mode` prop to `<QuestionBuilder ... />`:

```jsx
          <QuestionBuilder
            key={q.id}
            question={q}
            index={i}
            mode={mode}
            onChange={(nq) => updateQuestion(i, nq)}
            onRemove={() => removeQuestion(i)}
            canRemove={questions.length > 1}
          />
```

- [ ] **Step 5: Verify the build**

Run: `npx next build`
Expected: success.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open `/host`, create a room. Confirm: Libre vs Examen toggle appears; choosing Examen reveals the ≤20 / Illimité capacity toggle with prices. (Réponse libre gating is verified in Task 8.)

- [ ] **Step 7: Commit**

```bash
git add src/app/host/page.jsx
git commit -m "feat: choix du mode (Libre/Examen) + toggle capacité au créateur"
```

---

### Task 8: Réserver le type « Réponse libre » au mode Examen

**Files:**
- Modify: `src/components/QuestionBuilder.jsx`

**Interfaces:**
- Consumes: prop `mode` (Task 7).
- Produces: le bouton de type « Réponse libre » n'apparaît que si `mode === "examen"`.

- [ ] **Step 1: Accept the mode prop**

In `src/components/QuestionBuilder.jsx`, add `mode` to the destructured props:

```jsx
export default function QuestionBuilder({
  question,
  index,
  mode = "libre",
  onChange,
  onRemove,
  canRemove,
}) {
```

- [ ] **Step 2: Gate the "Réponse libre" type button**

Wrap the « Réponse libre » seg button so it only renders in Examen mode:

```jsx
          {mode === "examen" && (
            <button
              type="button"
              aria-pressed={question.type === "free"}
              onClick={() => setType("free")}
            >
              Réponse libre
            </button>
          )}
```

- [ ] **Step 3: Verify the build**

Run: `npx next build`
Expected: success.

- [ ] **Step 4: Manual verification**

`npm run dev` → `/host`: in **Libre** mode, the question type bar shows only « Choix unique » / « Choix multiple ». In **Examen** mode, « Réponse libre » appears. Saving a Libre quiz that somehow contains a free question is also rejected server-side (Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/components/QuestionBuilder.jsx
git commit -m "feat: type Réponse libre réservé au mode Examen dans le builder"
```

---

### Task 9: Bouton « Terminer l'examen » + coût sur le suivi formateur

**Files:**
- Modify: `src/app/host/results/page.jsx`

**Interfaces:**
- Consumes: `POST /api/host/[code]/end` (Task 6) ; `board.priceAr`, `board.settled`, `state.mode` (Tasks 5-6).
- Produces: pendant `running`, un bouton « Terminer l'examen » ; en `ended` pour un Examen, l'affichage du coût.

- [ ] **Step 1: Add the end action**

In `src/app/host/results/page.jsx`, inside `HostResultsInner`, add next to the existing handlers (`grade`, `finalize`):

```js
  async function endExam() {
    await apiPost(`/api/host/${code}/end`, {});
  }
```

- [ ] **Step 2: Show "Terminer l'examen" while running**

In the running banner (the `else` block with the live `<Countdown>`), add a button under the countdown. Replace the `<Countdown ... />` inside that card with:

```jsx
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
```

- [ ] **Step 3: Show the cost when ended (Examen only)**

In the `ended` block (inside the final `return`, before the PDF export buttons), add:

```jsx
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
```

- [ ] **Step 4: Verify the build**

Run: `npx next build`
Expected: success.

- [ ] **Step 5: Manual verification**

`npm run dev`: create an Examen (≤20), launch, open `/host/results`. While running, « Terminer l'examen » appears; clicking it ends the session (→ correction if réponse libre, sinon classement). Once ended, the cost « 1 000 Ar » is shown.

- [ ] **Step 6: Commit**

```bash
git add src/app/host/results/page.jsx
git commit -m "feat: bouton Terminer l'examen + affichage du coût en fin de session"
```

---

### Task 10: Message « salle pleine » lisible pour le participant

**Files:**
- Modify: `src/app/join/page.jsx`

**Interfaces:**
- Consumes: l'erreur 409 « Salle pleine (max N participants). » renvoyée par `registerPlayer` (Task 3) via la route register.

- [ ] **Step 1: Inspect the register call**

Open `src/app/join/page.jsx` and locate the call to `/api/player/[code]/register` (the registration submit). Confirm it reads `{ ok, data }` and sets an error from `data?.error`.

- [ ] **Step 2: Surface the full-room error**

Ensure the registration handler displays `data.error` verbatim when `!ok` (the server already returns « Salle pleine (max N participants). »). If the handler currently swallows the message or shows a generic one, set the displayed error to `data?.error || "Inscription impossible."`. Example shape:

```js
    const { ok, data } = await apiPost(`/api/player/${code}/register`, { pseudo });
    if (!ok) {
      setError(data?.error || "Inscription impossible.");
      return;
    }
```

- [ ] **Step 3: Verify the build**

Run: `npx next build`
Expected: success.

- [ ] **Step 4: Manual verification**

Create a Libre room, register 10 participants (e.g. via multiple private windows), then attempt an 11ᵗʰ. The join screen shows « Salle pleine (max 10 participants). »

- [ ] **Step 5: Commit**

```bash
git add src/app/join/page.jsx
git commit -m "feat: message clair quand la salle est pleine"
```

---

## Self-Review

**Spec coverage (vs plan business model, phase 1) :**
- Choix mode Libre/Examen → Task 7. ✅
- Toggle capacité ≤20/illimité → Task 7 (UI) + Task 2 (persistance). ✅
- Réponse libre réservée à l'Examen → Task 2 (serveur) + Task 8 (builder). ✅
- Export PDF réservé à l'Examen → **partiellement** : Task 9 garde l'export visible côté résultats. Voir note ci-dessous.
- Plafonds (Libre 10 / Examen 20 / illimité) → Task 3 + Task 10 (message). ✅
- Bouton « Terminer l'examen » → Task 4/6 (serveur) + Task 9 (UI). ✅
- Débit en fin de session (stub) → Task 5. ✅

**Note export PDF :** le plan gate la réponse libre partout, mais l'export PDF (`host/results`, `result`) reste techniquement accessible. Comme l'export n'existe que sur les écrans de résultats et que, en mode Libre, il n'apporte pas de valeur « pro », le gating de l'export est **mineur** ; si on veut le fermer en phase 1, ajouter une condition `state.mode === "examen"` autour des boutons d'export dans `src/app/host/results/page.jsx` et `src/app/result/page.jsx`. À confirmer avec l'utilisateur — laissé hors des tâches pour ne pas retirer une fonction sans validation.

**Placeholders :** aucun TODO/TBD ; tout le code lib est fourni. Les tâches UI fournissent le JSX exact ; la Task 10 est la seule « adaptative » (dépend du code existant de `join`) — l'étape 1 demande de localiser le call avant d'éditer.

**Type consistency :** `mode`/`capacity` (chaînes) cohérents entre `exam.js`, `sanitizeQuiz`, `getLeaderboard`, `/state`, `host/page.jsx`. `maxParticipants` renvoie `number|null` (null = illimité) et est testé en Task 1 et utilisé en Task 3. `examPriceAr` renvoie un nombre, exposé en `priceAr` et `settled.amountAr`. `endSession` renvoie `{ ok, endedAt }`, consommé en Task 6.

## Verification (end-to-end)

1. `node --test "src/**/*.test.js"` → tous verts (logique pure + règles rooms).
2. `npx next build` → compile, routes `…/end` présentes.
3. Manuel : créer un **Libre** (cap 10 vérifiable), puis un **Examen ≤20** avec une réponse libre → lancer → « Terminer l'examen » → corriger → classement + coût 1 000 Ar affiché (non débité).
