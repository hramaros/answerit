"use client";
// Persistance légère côté client (pas d'auth) : on garde l'identité du joueur
// et le rôle d'hôte pour survivre aux navigations / rechargements.

const PLAYER_KEY = "answerit:player";
const HOST_KEY = "answerit:host";

function read(key) {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
function write(key, value) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function savePlayerSession(s) {
  write(PLAYER_KEY, s);
}
export function getPlayerSession() {
  return read(PLAYER_KEY);
}
export function saveHostSession(s) {
  write(HOST_KEY, s);
}
export function getHostSession() {
  return read(HOST_KEY);
}
