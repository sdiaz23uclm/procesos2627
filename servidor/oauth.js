// Servicio externo de autenticación: OAuth 2.0 de Google (RF-04, decisión D-10).
// Flujo de código de autorización. Lo crea api.js (composición); la lógica solo recibe el email verificado.

const URL_AUTORIZACION = 'https://accounts.google.com/o/oauth2/v2/auth';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const URL_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';

export class ClienteOAuthGoogle {
  constructor({ clientId, clientSecret, urlApp }) {
    if (!clientId || !clientSecret || !urlApp) {
      throw new Error('Faltan variables de entorno de OAuth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y APP_URL');
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    // Debe coincidir EXACTAMENTE con una URI registrada en Google Cloud
    this.redirectUri = `${urlApp.replace(/\/+$/, '')}/api/auth/google/callback`;
  }

  // URL a la que se redirige al usuario para que elija su cuenta de Google
  urlAutorizacion(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state,
      prompt: 'select_account',
    });
    return `${URL_AUTORIZACION}?${params}`;
  }

  // Cambia el código de autorización por un token y devuelve el email verificado del usuario
  async obtenerEmail(code) {
    if (!code) {
      throw new Error('Google no devolvió código de autorización');
    }

    const respuestaToken = await fetch(URL_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!respuestaToken.ok) {
      throw new Error(`Google rechazó el código de autorización (estado ${respuestaToken.status})`);
    }
    const { access_token: accessToken } = await respuestaToken.json();

    const respuestaPerfil = await fetch(URL_USERINFO, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!respuestaPerfil.ok) {
      throw new Error(`No se pudo obtener el perfil de Google (estado ${respuestaPerfil.status})`);
    }
    const perfil = await respuestaPerfil.json();
    if (!perfil.email || perfil.email_verified !== true) {
      throw new Error('La cuenta de Google no tiene un email verificado');
    }
    return perfil.email;
  }
}
