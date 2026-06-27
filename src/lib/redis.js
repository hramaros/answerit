import { Redis } from "@upstash/redis";

/**
 * Client Redis (Upstash) partagé.
 *
 * Les variables d'environnement sont injectées automatiquement par l'intégration
 * Vercel > Storage. Selon le mode d'ajout, Vercel expose soit les noms
 * `UPSTASH_REDIS_REST_*`, soit les alias `KV_REST_API_*` : on accepte les deux.
 */
function resolveCreds() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return { url, token };
}

let client = null;

/** Injection d'un client (utilisé par les tests avec un faux Redis en mémoire). */
export function setRedisClient(c) {
  client = c;
}

export function getRedis() {
  if (client) return client;
  const { url, token } = resolveCreds();
  if (!url || !token) {
    throw new Error(
      "Redis non configuré : définissez UPSTASH_REDIS_REST_URL et " +
        "UPSTASH_REDIS_REST_TOKEN (voir .env.local.example).",
    );
  }
  client = new Redis({ url, token });
  return client;
}
