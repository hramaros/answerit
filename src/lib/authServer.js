import { getAccountByToken } from "./accounts.js";

// Cookie de session du formateur (côté serveur).
const COOKIE = "valio_session";

export function sessionTokenFromRequest(request) {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)valio_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function accountFromRequest(request) {
  return getAccountByToken(sessionTokenFromRequest(request));
}

export function sessionSetCookie(token) {
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}`;
}

export function sessionClearCookie() {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
