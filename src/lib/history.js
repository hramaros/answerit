import { getRedis } from "./redis.js";

// Historique durable des examens pro, rattaché au compte formateur (sans TTL).
const HISTORY_MAX = 200;
const recordKey = (id) => `examRecord:${id}`;
const listKey = (accountId) => `examHistory:${accountId}`;
const classListKey = (classId) => `classExams:${classId}`;

/** Résumé (liste) : on n'expose pas le classement complet. */
function summarize(r) {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    mode: r.mode,
    capacity: r.capacity,
    classId: r.classId,
    className: r.className,
    endedAt: r.endedAt,
    priceAr: r.priceAr,
    charged: r.charged,
    participantCount: r.participantCount,
    nbQuestions: r.nbQuestions,
    avgNote: r.avgNote,
    avgScore: r.avgScore,
  };
}

export async function saveExamRecord(record) {
  const redis = getRedis();
  await redis.set(recordKey(record.id), record);
  await redis.lpush(listKey(record.accountId), record.id);
  await redis.ltrim(listKey(record.accountId), 0, HISTORY_MAX - 1);
  // Index par classe (pour le carnet de notes).
  if (record.classId) {
    await redis.lpush(classListKey(record.classId), record.id);
    await redis.ltrim(classListKey(record.classId), 0, HISTORY_MAX - 1);
  }
  return record.id;
}

/** Examens complets (avec classement) rattachés à une classe — ordre chronologique. */
export async function getClassExamRecords(classId, limit = 200) {
  const redis = getRedis();
  const ids = await redis.lrange(classListKey(classId), 0, limit - 1);
  if (!ids || ids.length === 0) return [];
  const records = await redis.mget(...ids.map(recordKey));
  // lpush met le plus récent en tête ; on remet en ordre chronologique.
  return records.filter(Boolean).reverse();
}

export async function listExamRecords(accountId, limit = 50) {
  const redis = getRedis();
  const ids = await redis.lrange(listKey(accountId), 0, limit - 1);
  if (!ids || ids.length === 0) return [];
  const records = await redis.mget(...ids.map(recordKey));
  return records.filter(Boolean).map(summarize);
}

/** Détail d'un examen — null si inconnu ou n'appartenant pas au compte. */
export async function getExamRecord(accountId, recordId) {
  const redis = getRedis();
  const rec = await redis.get(recordKey(recordId));
  if (!rec || rec.accountId !== accountId) return null;
  return rec;
}
