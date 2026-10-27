// Conexión con Google: login (Google Identity Services) + Drive + Sheets.
// El Client ID es público por diseño. NUNCA poner acá un Client Secret.
const CLIENT_ID = "3831312379-b1crs53ra49b4nqgo918fh9f14dldio3.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive";
const NOMBRE_INDICE = "Expedientes - Indice (App)";
const DRIVE = "https://www.googleapis.com/drive/v3";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

export const COLS_EXP = ["id","caratula","cuij","fuero","cliente","contraparte","tipo","estado","responsable","telefono","email","vencimiento","vencimientoLabel","resultado","actualizado","carpetaUrl","notas","historial","quitado"];
export const COLS_EV = ["id","titulo","tipo","fecha","hora","expedienteId","sonido"];

let token = null, vence = 0, cliente = null, espera = null;

function cargarGIS() {
  return new Promise((ok, no) => {
    if (window.google?.accounts?.oauth2) return ok();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = ok;
    s.onerror = () => no(new Error("No se pudo cargar el login de Google. Revisá la conexión."));
    document.head.appendChild(s);
  });
}

async function pedirToken(prompt) {
  await cargarGIS();
  return new Promise((ok, no) => {
    espera = { ok, no };
    if (!cliente) {
      cliente = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (r) => {
          if (r.error) return espera.no(new Error(r.error));
          token = r.access_token;
          vence = Date.now() + (r.expires_in - 60) * 1000;
          espera.ok();
        },
        error_callback: (e) => espera.no(new Error(e?.type || "login_cancelado")),
      });
    }
    cliente.requestAccessToken({ prompt });
  });
}

export const iniciarSesion = () => pedirToken("select_account");

export function cerrarSesion() {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token, () => {});
  token = null;
}

async function api(url, opc = {}) {
  if (!token || Date.now() > vence) {
    try { await pedirToken(""); } catch { throw new Error("SESION_VENCIDA"); }
  }
  const r = await fetch(url, {
    ...opc,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opc.headers || {}) },
  });
  if (r.status === 401) { token = null; throw new Error("SESION_VENCIDA"); }
  if (!r.ok) throw new Error(`Google respondió ${r.status}`);
  return r.status === 204 ? null : r.json();
}

export async function usuario() {
  return (await api(`${DRIVE}/about?fields=user(emailAddress,displayName)`)).user;
}

const aFila = (cols, o) => cols.map((c) =>
  c === "historial" ? JSON.stringify(o.historial || []) : c === "sonido" ? String(o.sonido !== false) : c === "quitado" ? String(!!o.quitado) : (o[c] ?? ""));

function deFila(cols, f) {
  const o = {};
  cols.forEach((c, i) => { o[c] = f[i] ?? ""; });
  return o;
}

const aExp = (f) => {
  const o = deFila(COLS_EXP, f);
  let h = [];
  try { h = JSON.parse(o.historial || "[]"); } catch { h = []; }
  return { ...o, vencimiento: o.vencimiento || null, resultado: o.resultado || null, historial: h, quitado: o.quitado === "true" };
};
const aEv = (f) => {
  const o = deFila(COLS_EV, f);
  return { ...o, expedienteId: o.expedienteId || null, sonido: o.sonido !== "false" };
};

async function escribir(id, hoja, cols, lista) {
  const filas = [cols, ...lista.map((o) => aFila(cols, o))];
  await api(`${SHEETS}/${id}/values/${hoja}!A:Z:clear`, { method: "POST", body: "{}" });
  await api(`${SHEETS}/${id}/values/${hoja}!A1?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: filas }),
  });
}

async function leer(id, hoja, convertir) {
  const r = await api(`${SHEETS}/${id}/values/${hoja}!A:Z?valueRenderOption=FORMATTED_VALUE`);
  return (r.values || []).slice(1).filter((f) => f[0]).map(convertir);
}

async function buscarOCrearIndice() {
  const q = encodeURIComponent(`name='${NOMBRE_INDICE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  const r = await api(`${DRIVE}/files?q=${q}&fields=files(id)`);
  if (r.files.length) return r.files[0].id;
  const c = await api(SHEETS, {
    method: "POST",
    body: JSON.stringify({ properties: { title: NOMBRE_INDICE }, sheets: [{ properties: { title: "Expedientes" } }, { properties: { title: "Eventos" } }] }),
  });
  await escribir(c.spreadsheetId, "Expedientes", COLS_EXP, []);
  await escribir(c.spreadsheetId, "Eventos", COLS_EV, []);
  return c.spreadsheetId;
}

export async function cargarTodo() {
  const indiceId = await buscarOCrearIndice();
  const expedientes = await leer(indiceId, "Expedientes", aExp);
  const eventos = await leer(indiceId, "Eventos", aEv);
  return { indiceId, expedientes, eventos };
}

export const guardarExpedientes = (id, lista) => escribir(id, "Expedientes", COLS_EXP, lista);
export const guardarEventos = (id, lista) => escribir(id, "Eventos", COLS_EV, lista);
