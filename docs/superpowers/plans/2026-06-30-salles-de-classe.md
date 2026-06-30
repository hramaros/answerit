# Salles de classe + carnet de notes — Implementation Plan (Phase 5)

**Goal:** Classes possédées par un formateur, avec un roster d'élèves ; examens lançables « pour une classe » (participants nominatifs) ; carnet de notes par élève à travers les examens de la classe.

**Décomposition (3 sous-phases, checkpoint entre chaque) :**
1. **Gestion des classes + roster** — CRUD classes, ajout/retrait d'élèves, UI `/host/classes`.
2. **Examen nominatif** — lier un examen à une classe ; le participant choisit son nom dans le roster ; `studentId` sur le résultat ; `classId` sur le record.
3. **Carnet de notes** — agrégation des notes par élève sur les examens d'une classe + UI.

**Hypothèses :** élèves sans compte (roster géré par le formateur, l'élève choisit son nom). Classe optionnelle sur un examen.

## Données (Redis durable)
- `class:<id>` = `{ id, accountId, name, students: [{ id, name }], createdAt }`
- `classList:<accountId>` = liste d'ids de classes
- `examRecord` (existant) gagne `classId` (sous-phase 2) ; chaque ligne de classement gagne `studentId`.

## Sous-phase 1 (cette itération)
**Files :**
- `src/lib/classrooms.js` (+ `classrooms.test.js`) : `createClass`, `listClasses`, `getClass`, `renameClass`, `deleteClass`, `addStudent`, `removeStudent` (contrôle d'appartenance au compte).
- Routes : `GET|POST /api/host/classes`, `GET|PATCH|DELETE /api/host/classes/[id]`, `POST|DELETE /api/host/classes/[id]/students`.
- UI `/host/classes` : liste + créer une classe + gérer le roster (ajouter/retirer un élève). Lien depuis `/host`.

**Tests (TDD, fake Redis avec listes) :** create→list→get (appartenance), add/remove student, delete.

## Sous-phase 2 (après checkpoint)
- `host/page.jsx` : sélecteur de classe (optionnel) en mode Examen → `classId` transmis ; `createRoom`/`setQuiz` stockent `classId` + roster figé.
- `state` expose le roster quand `classId`. `join` : si roster présent, choisir son nom (au lieu d'un pseudo libre) → `registerPlayer(code, name, studentId)`.
- Snapshot : `classId` + `studentId` par ligne.

## Sous-phase 3 (après checkpoint)
- `src/lib/gradebook.js` (pur) : matrice élèves × examens, moyenne par élève.
- Route `GET /api/host/classes/[id]/gradebook`. UI carnet de notes dans la page classe.

## Verification
- `node --test` vert ; `npx next build` (routes classes présentes) ; manuel : créer une classe, ajouter des élèves.
