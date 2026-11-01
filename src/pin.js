// PIN propio de cada dispositivo. Se guarda solo un "hash" (nunca el PIN en claro).
const H = "exp_pin_hash", S = "exp_pin_salt", F = "exp_pin_fallos", L = "exp_pin_hasta";
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const poner = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hash(pin, salt) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin)));
}

export const hayPin = () => !!leer(H);

export async function crearPin(pin) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  poner(S, salt);
  poner(H, await hash(pin, salt));
  poner(F, "0");
  poner(L, "0");
}

export const segundosBloqueo = () => Math.max(0, Math.ceil((Number(leer(L) || 0) - Date.now()) / 1000));

// Cada 5 intentos fallidos seguidos, espera obligada (1 min, 2 min, 3 min...)
export async function verificarPin(pin) {
  if (segundosBloqueo() > 0) return false;
  if ((await hash(pin, leer(S) || "")) === leer(H)) { poner(F, "0"); return true; }
  const n = Number(leer(F) || 0) + 1;
  poner(F, String(n));
  if (n % 5 === 0) poner(L, String(Date.now() + 60000 * (n / 5)));
  return false;
}
