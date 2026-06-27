import { normalizeCode } from "./code.js";

/** Réponse JSON courte. */
export function json(data, status = 200) {
  return Response.json(data, { status });
}

/** Lit et normalise le `code` depuis les params de route (Next 15 = async). */
export async function codeFromParams(params) {
  const p = await params;
  return normalizeCode(p.code);
}

/** Parse le body JSON sans planter sur un corps vide/invalide. */
export async function readBody(request) {
  try {
    return (await request.json()) || {};
  } catch {
    return {};
  }
}

/**
 * Enrobe un route handler : toute exception non gérée (ex. Redis indisponible)
 * renvoie un JSON d'erreur lisible plutôt qu'un 500 opaque sans corps.
 */
export function handler(fn) {
  return async (request, ctx) => {
    try {
      return await fn(request, ctx);
    } catch (err) {
      console.error("API error:", err);
      return json({ error: err?.message || "Erreur serveur." }, 500);
    }
  };
}
