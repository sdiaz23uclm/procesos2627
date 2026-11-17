// Servicio externo de correo (RF-02, decisión D-09).
// Lo crea api.js (composición) y se inyecta en la lógica, que solo conoce enviarConfirmacion().

const URL_API_BREVO = 'https://api.brevo.com/v3/smtp/email';

export class ServicioCorreoBrevo {
  constructor({ apiKey, remitente, urlApp }) {
    if (!apiKey || !remitente || !urlApp) {
      throw new Error('Faltan variables de entorno de correo: BREVO_API_KEY, MAIL_FROM y APP_URL');
    }
    this.apiKey = apiKey;
    this.remitente = remitente;
    this.urlApp = urlApp.replace(/\/+$/, '');
  }

  enlaceConfirmacion(token) {
    return `${this.urlApp}/api/confirmar?token=${encodeURIComponent(token)}`;
  }

  async enviarConfirmacion(email, token) {
    const enlace = this.enlaceConfirmacion(token);
    const respuesta = await fetch(URL_API_BREVO, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.remitente, name: 'CloudSaaS Platform' },
        to: [{ email }],
        subject: 'Confirma tu cuenta',
        htmlContent: `
          <p>Hola,</p>
          <p>Para activar tu cuenta pulsa en el siguiente enlace (válido durante 24 horas):</p>
          <p><a href="${enlace}">Confirmar mi cuenta</a></p>
          <p>Si no te has registrado, ignora este correo.</p>`,
        textContent: `Para activar tu cuenta abre este enlace (válido 24 horas): ${enlace}`,
      }),
    });

    if (!respuesta.ok) {
      // No se incluye el cuerpo de la respuesta para no volcar datos del proveedor en los logs
      throw new Error(`Brevo respondió con estado ${respuesta.status}`);
    }
  }
}
