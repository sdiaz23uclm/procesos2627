import assert from 'node:assert';
import { test, afterEach } from 'node:test';
import { ServicioCorreoBrevo } from '../servidor/correo.js';

// Se sustituye fetch por un doble: las pruebas nunca llaman a Brevo de verdad
const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

function crearServicio() {
  return new ServicioCorreoBrevo({ apiKey: 'clave-falsa', remitente: 'no-reply@test.com', urlApp: 'https://app.test/' });
}

test('correo: envía a Brevo un enlace de confirmación construido con APP_URL', async () => {
  let peticion;
  globalThis.fetch = async (url, opciones) => {
    peticion = { url, opciones, cuerpo: JSON.parse(opciones.body) };
    return { ok: true, status: 201 };
  };

  await crearServicio().enviarConfirmacion('ana@test.com', 'abc123');

  assert.strictEqual(peticion.url, 'https://api.brevo.com/v3/smtp/email');
  assert.strictEqual(peticion.opciones.headers['api-key'], 'clave-falsa');
  assert.deepStrictEqual(peticion.cuerpo.to, [{ email: 'ana@test.com' }]);
  assert.ok(peticion.cuerpo.htmlContent.includes('https://app.test/api/confirmar?token=abc123'));
});

test('correo: lanza un error si Brevo responde con un estado de error', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401 });
  await assert.rejects(() => crearServicio().enviarConfirmacion('ana@test.com', 'abc'), /estado 401/);
});

test('correo: exige las variables de configuración', () => {
  assert.throws(() => new ServicioCorreoBrevo({ apiKey: '', remitente: 'a@b.com', urlApp: 'x' }), /BREVO_API_KEY/);
});
