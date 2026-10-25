// Configuración de integración con Google Drive / Sheets API

const CLIENT_ID = '3831312379-b1crs53ra49b4nqgo918fh9f14dldio3.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let gapiInited = false;
let gsisInited = false;

export function initGoogleAuth(onSuccess, onError) {
  // Cargar SDKs de Google si aún no están cargados
  if (window.google && window.google.accounts) {
    initGsi(onSuccess, onError);
  } else {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => initGsi(onSuccess, onError);
    script.onerror = () => onError && onError('Error al cargar Google SDK');
    document.body.appendChild(script);
  }
}

function initGsi(onSuccess, onError) {
  try {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error !== undefined) {
          if (onError) onError(response);
        } else {
          if (onSuccess) onSuccess(response.access_token);
        }
      },
    });
  } catch (err) {
    if (onError) onError(err);
  }
}

export function requestGoogleLogin() {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    console.error('El cliente de Google no está inicializado.');
  }
}
