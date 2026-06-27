# answerit — quiz en direct (style Kahoot)

Application web permettant à un formateur de lancer des quiz en direct. Les
participants rejoignent une salle avec un **code**, choisissent un **pseudo**,
et jouent — **sans aucune authentification**.

- **Stack** : Next.js (App Router) — 100 % serverless (route handlers), **déployable sur Vercel en l'état**.
- **État partagé** : Redis (Upstash) via l'intégration Vercel. Les salles ont un **TTL** (auto-expiration → éphémère).
- **Temps réel** : polling léger (~1 s), pas de WebSocket.
- **Scoring** : style Kahoot (justesse **et** rapidité, mesurée par question côté serveur) + une **note /20**.
- **Chrono** : un seul compte à rebours global ; chaque participant répond à son rythme.

## Démarrage en local

1. **Installer les dépendances**
   ```bash
   npm install
   ```

2. **Configurer Redis (Upstash)**
   Créez une base Redis gratuite sur [upstash.com](https://upstash.com) (ou via
   le dashboard Vercel → **Storage**), puis copiez les identifiants REST :
   ```bash
   cp .env.local.example .env.local
   # puis renseignez UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN
   ```
   Si le projet est déjà lié à Vercel : `vercel env pull .env.local`.

3. **Lancer le serveur de dev**
   ```bash
   npm run dev
   ```
   → http://localhost:3000

4. **Tests unitaires** (logique de scoring, pure)
   ```bash
   npm test
   ```

## Déploiement sur Vercel

1. Poussez le repo et importez-le dans Vercel.
2. Dans le projet Vercel → **Storage** → ajoutez **Redis (Upstash)**. Les
   variables `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (ou les alias
   `KV_REST_API_*`) sont injectées automatiquement.
3. Déployez. Aucune autre configuration requise.

## Parcours

| Rôle | Écran | Action |
|------|-------|--------|
| Participant | `/` | Saisir le code de la salle |
| Participant | `/join` | Choisir un pseudo, attendre dans le lobby |
| Participant | `/play` | Répondre aux questions à son rythme |
| Participant | `/result` | Points, note /20, classement |
| Formateur | `/host` | Nom + builder (questions, réponses, couleurs, type, temps) |
| Formateur | `/host/lobby` | Voir les participants, **Lancer le quiz** |
| Formateur | `/host/results` | Suivi en direct puis classement + podium top 3 |

## Architecture

- `src/lib/scoring.js` — logique pure (points, note, classement) — testée.
- `src/lib/rooms.js` — seule couche qui parle à Redis (données shardées par joueur, TTL, statut **dérivé** des timestamps : pas de cron nécessaire).
- `src/app/api/**` — route handlers serverless.
- `src/app/**` + `src/components/**` — interface (polling client via `usePolling`).

> La fin de partie est calculée à la volée (`now > startedAt + durationMs`),
> ce qui évite toute tâche planifiée — idéal pour le serverless Vercel.
