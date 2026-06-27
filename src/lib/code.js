// Alphabet sans caractères ambigus (pas de 0/O, 1/I, etc.) pour des codes lisibles.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Génère un code de salle de `len` caractères (défaut 6). */
export function generateCode(len = 6) {
  let code = "";
  for (let i = 0; i < len; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/** Normalise un code saisi par l'utilisateur (majuscules, sans espaces). */
export function normalizeCode(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

/** Génère un identifiant opaque (jeton joueur, id de question/réponse). */
export function generateId(prefix = "") {
  const rand =
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6);
  return prefix ? `${prefix}_${rand}` : rand;
}
