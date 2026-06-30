# Comptes formateur + Porte-monnaie — Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) — steps use `- [ ]` checkboxes.

**Goal:** Comptes formateur (email + mot de passe), solde en Ariary, connexion requise pour le mode Examen, vérification du solde au lancement avec popup de recharge, et débit réel en fin de session. **Paiement réel = stub** (bouton test « +5 000 Ar »).

**Architecture:** Première donnée **durable** dans Redis (comptes/sessions sans TTL côté compte). Hachage des mots de passe via **`node:crypto` scrypt** (aucune dépendance ajoutée). Sessions par **cookie httpOnly** → token Redis. La logique d'argent pure est isolée dans `src/lib/wallet.js` (testable). Les salles restent éphémères ; une salle Examen porte `hostAccountId`, débité au settle.

**Tech Stack:** Next.js route handlers (Node), Upstash Redis, `node:crypto`, `node:test`.

## Global Constraints

- Mots de passe : jamais en clair. Hash `scrypt` + sel aléatoire, format `"<saltHex>:<hashHex>"`.
- Cookie session : `valio_session`, httpOnly, SameSite=Lax, Path=/, ~30 j.
- Comptes & emails : clés Redis **sans TTL**. Sessions : TTL 30 j.
- Email normalisé en minuscules ; unicité via `accountEmail:<email>`.
- Le **Libre reste 100 % anonyme** (aucun compte). Seul l'**Examen** exige login.
- Recharge stub : `TOPUP_TEST_AR = 5000`, crédit immédiat (placeholder de paiement réel).
- Débit : au **settle** (fin de session), une seule fois, gardé par `settled.charged`.
- Tests : `node --test "src/**/*.test.js"`. Build : `npx next build`.

## File Structure

- **Create** `src/lib/wallet.js` (+ `wallet.test.js`) — pur : `canAfford`, `TOPUP_TEST_AR`.
- **Create** `src/lib/accounts.js` (+ `accounts.test.js`) — I/O Redis : création/auth comptes, sessions, topup, debit ; hachage scrypt.
- **Create** `src/lib/authServer.js` — `accountFromRequest(request)`, `sessionCookie(token)`, `clearCookie()`.
- **Create** routes : `src/app/api/auth/{signup,login,logout,me}/route.js`, `src/app/api/wallet/topup/route.js`.
- **Modify** `src/lib/rooms.js` — `createRoom(hostName, hostAccountId)` ; `startGame` (check solde Examen → 402) ; settle = débit réel du compte.
- **Modify** `src/app/api/host/create/route.js` — rattacher `hostAccountId` depuis la session ; exiger login si Examen (voir note) .
- **Modify** `src/app/api/host/[code]/start/route.js` — propager le 402 (solde insuffisant).
- **Create** `src/components/AuthModal.jsx`, `src/components/RechargeModal.jsx`.
- **Create** `src/lib/account-client.js` — `useAccount()` (fetch `/api/auth/me`), helpers login/logout côté client.
- **Modify** `src/app/host/page.jsx` — modale auth à la sélection Examen ; affichage solde.
- **Modify** `src/app/host/lobby/page.jsx` — popup recharge sur 402 au lancement ; affichage solde.

---

### Task 1: Logique pure `wallet.js`
**Files:** Create `src/lib/wallet.js`, `src/lib/wallet.test.js`
**Interfaces:** `TOPUP_TEST_AR = 5000` ; `canAfford(balanceAr, priceAr) -> boolean`.

- [ ] **Step 1: Test** — `canAfford(5000,1000)===true`, `canAfford(500,1000)===false`, `canAfford(1000,1000)===true`, `canAfford(0,0)===true`.
- [ ] **Step 2: Run** `node --test src/lib/wallet.test.js` → FAIL.
- [ ] **Step 3: Implement**
```js
export const TOPUP_TEST_AR = 5000;
export function canAfford(balanceAr, priceAr) {
  return (Number(balanceAr) || 0) >= (Number(priceAr) || 0);
}
```
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat: wallet.js (canAfford, topup test)`.

---

### Task 2: Comptes + sessions `accounts.js` (Redis, scrypt)
**Files:** Create `src/lib/accounts.js`, `src/lib/accounts.test.js`
**Interfaces (Produces):**
- `createAccount({ email, password, name }) -> { ok, account } | { ok:false, status, error }`
- `authenticate({ email, password }) -> { ok, account } | { ok:false, status, error }`
- `getAccountById(id) -> account | null` (account = `{ id, email, name, balanceAr }`, sans hash)
- `createSession(accountId) -> token` ; `getAccountByToken(token) -> account|null` ; `deleteSession(token)`
- `topupTest(accountId, amountAr) -> { ok, balanceAr }`
- `debit(accountId, amountAr) -> { ok, balanceAr } | { ok:false, error }`

Keys: `account:<id>`, `accountEmail:<lcEmail> -> id`, `session:<token> -> id` (TTL 30 j). Hash scrypt :
```js
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(pw), salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}
function verifyPassword(pw, stored) {
  const [saltHex, hashHex] = String(stored).split(":");
  if (!saltHex || !hashHex) return false;
  const hash = scryptSync(String(pw), Buffer.from(saltHex, "hex"), 64);
  return timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}
```
- [ ] **Steps (TDD):** tests via `setRedisClient(createFakeRedis())` (réutiliser le faux Redis de `rooms.test.js`, ajouter `del`, `incrby` si besoin) : (1) createAccount ok + email dupliqué rejeté ; (2) authenticate bon/mauvais mdp ; (3) session create→getByToken→delete ; (4) topupTest crédite ; (5) debit décrémente, refuse si insuffisant. Implémenter, faire passer, **commit** `feat: comptes + sessions (scrypt) dans accounts.js`.

> Note fake Redis : `accounts.test.js` définit son propre faux client incluant `del` et `mget`. Le sel aléatoire rend `account:<id>` non déterministe — tester via les fonctions, pas l'égalité de hash.

---

### Task 3: Auth côté serveur `authServer.js` + cookie
**Files:** Create `src/lib/authServer.js`
**Interfaces:** `accountFromRequest(request) -> Promise<account|null>` (lit le cookie `valio_session`) ; `sessionSetCookie(token) -> string` (valeur d'en-tête Set-Cookie) ; `sessionClearCookie() -> string`.
```js
import { getAccountByToken } from "./accounts.js";
const COOKIE = "valio_session";
export async function accountFromRequest(request) {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)valio_session=([^;]+)/);
  if (!m) return null;
  return getAccountByToken(decodeURIComponent(m[1]));
}
export function sessionSetCookie(token) {
  const days = 30;
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${days * 86400}`;
}
export function sessionClearCookie() {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
```
- [ ] Pas de test unitaire dédié (couvert par les routes) ; vérifié au build. **Commit** avec Task 4.

---

### Task 4: Routes auth + wallet
**Files:** Create `src/app/api/auth/signup/route.js`, `login`, `logout`, `me`, `src/app/api/wallet/topup/route.js`
- `POST /api/auth/signup` `{email,password,name}` → createAccount → createSession → `Response.json({account})` avec header `Set-Cookie: sessionSetCookie(token)`.
- `POST /api/auth/login` `{email,password}` → authenticate → session + cookie.
- `POST /api/auth/logout` → deleteSession(token) + `sessionClearCookie()`.
- `GET /api/auth/me` → `accountFromRequest` → `{ account|null }`.
- `POST /api/wallet/topup` (auth requise) → `topupTest(account.id, TOPUP_TEST_AR)` → `{ balanceAr }`.

Chaque route : `export const dynamic = "force-dynamic"`. Pour poser le cookie, renvoyer `new Response(JSON.stringify(...), { status, headers: { "content-type":"application/json", "set-cookie": cookie } })` (ne pas utiliser le helper `json()` qui ne gère pas les headers).
- [ ] Build OK ; **commit** `feat: routes auth (signup/login/logout/me) + wallet topup`.

---

### Task 5: Rattacher le compte à la salle + débit réel
**Files:** Modify `src/lib/rooms.js`, `src/app/api/host/create/route.js`, `src/app/api/host/[code]/start/route.js`, `src/lib/rooms.test.js`
**Interfaces (consumes):** `getAccountById`, `debit` (accounts.js), `canAfford` (wallet.js).
- `createRoom(hostName, hostAccountId = null)` → stocke `meta.hostAccountId`.
- `startGame(code)` : si `meta.quiz.mode === "examen"` et `meta.hostAccountId`, charger le compte ; si `!canAfford(balanceAr, examPriceAr(...))` → `{ ok:false, status:402, error:"Solde insuffisant.", priceAr, balanceAr }`.
- Settle (dans `getLeaderboard`, branche ended/examen) : si `meta.hostAccountId` et `!meta.settled` → `await debit(hostAccountId, priceAr)` puis `meta.settled = { amountAr:priceAr, currency:"MGA", at:now(), charged:true }`.
- `host/create` route : `const account = await accountFromRequest(request); createRoom(hostName, account?.id)`.
- `host/[code]/start` route : propager `result.status` (402) et `{ priceAr, balanceAr }`.
- [ ] **Tests rooms.test.js :** (1) Examen avec compte au solde 0 → `startGame` renvoie 402 ; (2) après topup ≥ prix → `startGame` ok ; (3) à la clôture → `debit` appliqué, `settled.charged===true`, solde décrémenté. Implémenter, faire passer. **Commit** `feat: rattachement compte + check solde au lancement + débit au settle`.

---

### Task 6: Client compte + modale Auth (sélection Examen)
**Files:** Create `src/lib/account-client.js`, `src/components/AuthModal.jsx` ; Modify `src/app/host/page.jsx`
- `account-client.js` : `useAccount()` → `{ account, loading, refresh, logout }` (fetch `/api/auth/me`).
- `AuthModal` : onglets Connexion / Inscription (email, mot de passe, nom) → POST login/signup → `refresh()` → `onAuthed()`.
- `host/page.jsx` : à la sélection du mode **Examen**, si `!account` → ouvrir `AuthModal`. Si l'utilisateur annule, repasser en **Libre**. Quand connecté + Examen, afficher « Connecté : <email> · Solde : N Ar ». `createRoom` (identity submit) ne part qu'avec compte si Examen.
- [ ] Build + vérif manuelle (sélection Examen ouvre la modale, login crée le compte). **Commit** `feat: modale connexion/inscription à la sélection Examen`.

---

### Task 7: Popup de recharge au lancement
**Files:** Create `src/components/RechargeModal.jsx` ; Modify `src/app/host/lobby/page.jsx`
- `host/lobby` « Lancer le quiz » → si réponse `402` → ouvrir `RechargeModal` (affiche solde, prix, manque).
- `RechargeModal` : bouton **« Recharger +5 000 Ar (test) »** → `POST /api/wallet/topup` → refresh solde → bouton « Réessayer le lancement ».
- Afficher le solde dans l'en-tête du lobby pour un Examen.
- [ ] Build + vérif manuelle (solde 0 → popup → +5000 → lancement OK). **Commit** `feat: popup de recharge au lancement quand solde insuffisant`.

---

## Self-Review
- Auth (email+mdp, scrypt, cookie) → Tasks 2-4. ✅
- Login requis à la sélection Examen → Task 6. ✅
- Solde + check au lancement + 402 → Task 5. ✅
- Popup recharge + topup test +5000 → Task 7. ✅
- Débit réel en fin de session → Task 5 (settle). ✅
- Libre anonyme inchangé → aucune route auth sur le flux Libre. ✅
- **Hors périmètre** (phases suivantes) : paiement réel (mobile money/Stripe), persistance des examens/historique, salles de classe, analytics.
- **Risque connu** : double-débit si deux settles concurrents ; gardé par `settled.charged` (rare ; durcir avec un op atomique Redis plus tard).

## Verification
1. `node --test "src/**/*.test.js"` → vert (wallet, accounts, rooms).
2. `npx next build` → routes `/api/auth/*`, `/api/wallet/topup` présentes.
3. Manuel : créer un Examen → modale login → compte créé (solde 0) → lobby « Lancer » → popup recharge → +5 000 Ar → lancement → fin de session → solde débité (1 000 / 2 000 Ar).
