import assert from 'node:assert';
import { test, afterEach } from 'node:test';
import { ClienteOAuthGoogle } from '../servidor/oauth.js';

// fetch se sustituye por un doble: las pruebas nunca llaman a Google de verdad
const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

function crearCliente() {
  return new ClienteOAuthGoogle({ clientId: 'id-falso', clientSecret: 'secreto-falso', urlApp: 'https://app.test/' });
}

// Simula las dos respuestas de Google: intercambio de código y perfil
function googleFalso({ tokenOk = true, perfil = { email: 'ana@gmail.com', email_verified: true } } = {}) {
  const llamadas = [];
  globalThis.fetch = async (url, opciones = {}) => {
    llamadas.push({ url, opciones });
    if (url.includes('/token')) {
      return tokenOk
        ? { ok: true, status: 200, json: async () => ({ access_token: 'token-falso' }) }
        : { ok: false, status: 400 };
    }
    return { ok: true, status: 200, json: async () => perfil };
  };
  return llamadas;
}

test('oauth: la URL de autorización lleva client_id, redirect_uri exacta, scope y state', () => {
  const url = new URL(crearCliente().urlAutorizacion('estado123'));
  assert.strictEqual(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.strictEqual(url.searchParams.get('client_id'), 'id-falso');
  assert.strictEqual(url.searchParams.get('redirect_uri'), 'https://app.test/api/auth/google/callback');
  assert.strictEqual(url.searchParams.get('response_type'), 'code');
  assert.strictEqual(url.searchParams.get('scope'), 'openid email');
  assert.strictEqual(url.searchParams.get('state'), 'estado123');
});

test('oauth: cambia el código por un token y devuelve el email verificado', async () => {
  const llamadas = googleFalso();
  const email = await crearCliente().obtenerEmail('codigo-abc');

  assert.strictEqual(email, 'ana@gmail.com');
  const cuerpoToken = new URLSearchParams(llamadas[0].opciones.body);
  assert.strictEqual(cuerpoToken.get('code'), 'codigo-abc');
  assert.strictEqual(cuerpoToken.get('grant_type'), 'authorization_code');
  assert.strictEqual(llamadas[1].opciones.headers.authorization, 'Bearer token-falso');
});

test('oauth: error si Google rechaza el código', async () => {
  googleFalso({ tokenOk: false });
  await assert.rejects(() => crearCliente().obtenerEmail('codigo-malo'), /rechazó el código/);
});

test('oauth: error si el email de Google no está verificado', async () => {
  googleFalso({ perfil: { email: 'ana@gmail.com', email_verified: false } });
  await assert.rejects(() => crearCliente().obtenerEmail('codigo'), /email verificado/);
});

test('oauth: error si no llega código', async () => {
  await assert.rejects(() => crearCliente().obtenerEmail(null), /código de autorización/);
});

test('oauth: exige las variables de configuración', () => {
  assert.throws(() => new ClienteOAuthGoogle({ clientId: 'x', clientSecret: '', urlApp: 'y' }), /GOOGLE_CLIENT_SECRET/);
});
