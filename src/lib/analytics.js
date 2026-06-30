// Agrégations PURES pour le tableau de bord (sans I/O), testables avec node --test.

/** Moyennes d'un examen à partir de son classement. */
export function examAggregate(leaderboard) {
  const lb = Array.isArray(leaderboard) ? leaderboard : [];
  const n = lb.length;
  if (n === 0) return { avgNote: 0, avgScore: 0, topScore: 0 };
  const sumNote = lb.reduce((s, p) => s + (Number(p.note) || 0), 0);
  const sumScore = lb.reduce((s, p) => s + (Number(p.score) || 0), 0);
  const topScore = lb.reduce((m, p) => Math.max(m, Number(p.score) || 0), 0);
  return {
    avgNote: Math.round((sumNote / n) * 10) / 10,
    avgScore: Math.round(sumScore / n),
    topScore,
  };
}

/** Statistiques cumulées sur l'ensemble des examens d'un formateur. */
export function aggregateStats(records) {
  const recs = Array.isArray(records) ? records : [];
  const examCount = recs.length;
  const totalParticipants = recs.reduce(
    (s, r) => s + (Number(r.participantCount) || 0),
    0,
  );
  // On ne compte la dépense que pour les examens réellement débités.
  const totalSpentAr = recs.reduce(
    (s, r) => s + (r.charged ? Number(r.priceAr) || 0 : 0),
    0,
  );
  // Note moyenne globale pondérée par le nombre de participants.
  const withNote = recs.filter(
    (r) => typeof r.avgNote === "number" && (Number(r.participantCount) || 0) > 0,
  );
  let avgNote = 0;
  if (withNote.length) {
    const totalP = withNote.reduce((s, r) => s + r.participantCount, 0);
    const weighted = withNote.reduce((s, r) => s + r.avgNote * r.participantCount, 0);
    avgNote = totalP ? Math.round((weighted / totalP) * 10) / 10 : 0;
  }
  return { examCount, totalParticipants, totalSpentAr, avgNote };
}
