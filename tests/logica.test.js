import assert from 'node:assert';
import { test, beforeEach } from 'node:test';
import { LogicaUsuarios, normalizarEmail, VALIDEZ_TOKEN_MS } from '../servidor/logica.js';

// Creamos un DAO simulado en memoria para las pruebas unitarias (evita depender de MongoDB externo en los tests)
class DAOMock {
  constructor() {
    this.usuarios = [];
  }
  async guardar(usuario) {
    this.usuarios.push(usuario);
    return usuario;
  }
  async obtenerPorEmail(email) {
    return this.usuarios.find(u => u.email === email) || null;
  }
  async obtenerTodos() {
    return this.usuarios;
  }
  async obtenerPorTokenConfirmacion(tokenHash) {
    return this.usuarios.find(u => u.tokenConfirmacionHash === tokenHash) || null;
  }
  async actualizar(email, cambios) {
    const u = this.usuarios.find(x => x.email === email);
    if (!u) return false;
    Object.assign(u, cambios);
    return true;
  }
  async eliminar(email) {
    const index = this.usuarios.findIndex(u => u.email === email);
    if (index !== -1) {
      this.usuarios.splice(index, 1);
      return true;
    }
    return false;
  }
}

// Doble del servicio de correo: guarda los envíos en lugar de llamar a Brevo
class CorreoFalso {
  constructor() {
    this.enviados = [];
    this.fallar = false;
  }
  async enviarConfirmacion(email, token) {
    if (this.fallar) throw new Error('fallo simulado del proveedor');
    this.enviados.push({ email, token });
  }
  ultimoToken() {
    return this.enviados.at(-1).token;
  }
}

let logica;
let daoMock;
let correo;
let ahora;

beforeEach(() => {
  daoMock = new DAOMock();
  correo = new CorreoFalso();
  ahora = Date.parse('2026-11-17T12:00:00Z');
  logica = new LogicaUsuarios(daoMock, correo, { reloj: () => ahora });
});

test('variante2: normaliza espacios exteriores y mayúsculas del email', () => {
  assert.strictEqual(normalizarEmail(' Ana@X.com '), 'ana@x.com');
});

test('variante2: rechaza emails que no cumplen el formato', () => {
  for (const email of ['@x.com', 'a@@x.com', 'a@xcom', 'a@.x.com', 'a@x.com.', 'a b@x.com', null]) {
    assert.throws(() => normalizarEmail(email), { message: 'EMAIL_INVALIDO' });
  }
});

test('variante2: normaliza el email antes de registrar y buscar usuarios', async () => {
  const usuario = await logica.registrarUsuario(' Ana@X.com ', '123456');
  assert.strictEqual(usuario.email, 'ana@x.com');
  assert.strictEqual(await daoMock.obtenerPorEmail('ana@x.com'), usuario);
  assert.strictEqual(await logica.comprobarActivo(' ANA@X.COM '), false);
});

test('1. Registrar un usuario nuevo con éxito y contraseña hasheada', async () => {
  const u = await logica.registrarUsuario('user@test.com', '123456');
  assert.strictEqual(u.email, 'user@test.com');
  assert.strictEqual(u.estado, 'pendiente');
  assert.ok(u.passwordHash);
});

test('2. Error al registrar un email ya existente', async () => {
  await logica.registrarUsuario('duplicado@test.com', '123456');
  
  await assert.rejects(async () => {
    await logica.registrarUsuario('duplicado@test.com', '654321');
  }, /El usuario ya existe/);
});

test('3. Inicio de sesión exitoso con credenciales correctas', async () => {
  const email = 'login@test.com';
  const password = 'Password123*';
  
  // 1. Registrar el usuario (su estado inicial es 'pendiente')[cite: 1, 3]
  await logica.registrarUsuario(email, password);
  
  // 2. Simulamos la confirmación cambiando el estado directamente en el DAO Mock[cite: 1, 2]
  const usuarioEnDao = await daoMock.obtenerPorEmail(email);
  usuarioEnDao.estado = 'confirmado'; // O 'activo', según lo que espere tu lógica[cite: 1, 3]

  // 3. Ahora el login debe ser exitoso porque el estado ya no es 'pendiente'[cite: 1, 3]
  const resultadoLogin = await logica.loginUsuario(email, password);
  assert.ok(resultadoLogin);
  assert.strictEqual(resultadoLogin.email, email);
});

test('4. Administrador puede listar todos los usuarios', async () => {
  // Creamos un admin simulado en el DAO
  await daoMock.guardar({ email: 'admin@saas.com', rol: 'admin', estado: 'confirmado' });
  await logica.registrarUsuario('user1@test.com', '123456');
  
  const admin = await daoMock.obtenerPorEmail('admin@saas.com');
  const lista = await logica.listarUsuarios(admin);
  
  assert.strictEqual(lista.length, 2);
});

test('5. Usuario normal falla al intentar listar usuarios (Restricción de rol)', async () => {
  await logica.registrarUsuario('normal@test.com', '123456');
  const usuarioNormal = await daoMock.obtenerPorEmail('normal@test.com');

  await assert.rejects(async () => {
    await logica.listarUsuarios(usuarioNormal);
  }, /Se requiere rol de administrador/);
});

test('6. Error al intentar iniciar sesión con una cuenta pendiente de confirmar', async () => {
  const email = 'pendiente@test.com';
  const password = 'Password123*';
  
  // 1. Registramos el usuario (por defecto su estado es 'pendiente')[cite: 1, 3]
  await logica.registrarUsuario(email, password);
  
  // 2. Comprobamos que al hacer login sin confirmar la cuenta, lanza el error esperado
  await assert.rejects(async () => {
    await logica.loginUsuario(email, password);
  }, /La cuenta está pendiente de confirmación/);
});

// --- RF-02: confirmación de cuenta por correo ---

test('7. El registro envía un correo de confirmación con un token al email del usuario', async () => {
  const u = await logica.registrarUsuario('nuevo@test.com', '123456');
  assert.strictEqual(correo.enviados.length, 1);
  assert.strictEqual(correo.enviados[0].email, 'nuevo@test.com');
  assert.ok(correo.ultimoToken().length >= 32);
  // En BD solo se guarda el hash del token, nunca el token en claro
  assert.notStrictEqual(u.tokenConfirmacionHash, correo.ultimoToken());
});

test('8. Un token válido confirma la cuenta y después se puede iniciar sesión', async () => {
  await logica.registrarUsuario('conf@test.com', 'Password123*');
  await logica.confirmarCuenta(correo.ultimoToken());

  const u = await daoMock.obtenerPorEmail('conf@test.com');
  assert.strictEqual(u.estado, 'confirmado');
  assert.strictEqual(await logica.comprobarActivo('conf@test.com'), true);
  const login = await logica.loginUsuario('conf@test.com', 'Password123*');
  assert.strictEqual(login.email, 'conf@test.com');
});

test('9. Error al confirmar con un token inexistente o vacío', async () => {
  await logica.registrarUsuario('x@test.com', '123456');
  await assert.rejects(() => logica.confirmarCuenta('token-inventado'), { codigo: 'TOKEN_INVALIDO' });
  await assert.rejects(() => logica.confirmarCuenta(''), { codigo: 'TOKEN_INVALIDO' });
  await assert.rejects(() => logica.confirmarCuenta(undefined), { codigo: 'TOKEN_INVALIDO' });
  assert.strictEqual((await daoMock.obtenerPorEmail('x@test.com')).estado, 'pendiente');
});

test('10. Error al confirmar con un token caducado', async () => {
  await logica.registrarUsuario('tarde@test.com', '123456');
  ahora += VALIDEZ_TOKEN_MS + 1;
  await assert.rejects(() => logica.confirmarCuenta(correo.ultimoToken()), { codigo: 'TOKEN_CADUCADO' });
  assert.strictEqual((await daoMock.obtenerPorEmail('tarde@test.com')).estado, 'pendiente');
});

test('11. Un token ya usado no se puede reutilizar', async () => {
  await logica.registrarUsuario('una@test.com', '123456');
  const token = correo.ultimoToken();
  await logica.confirmarCuenta(token);
  await assert.rejects(() => logica.confirmarCuenta(token), { codigo: 'TOKEN_INVALIDO' });
});

test('12. Si falla el envío del correo, el registro se deshace y se informa del error', async () => {
  correo.fallar = true;
  await assert.rejects(() => logica.registrarUsuario('sin@test.com', '123456'), { codigo: 'CORREO_NO_ENVIADO' });
  assert.strictEqual(await daoMock.obtenerPorEmail('sin@test.com'), null);
});

test('13. Reenviar confirmación genera un token nuevo e invalida el anterior', async () => {
  await logica.registrarUsuario('re@test.com', '123456');
  const tokenViejo = correo.ultimoToken();
  await logica.reenviarConfirmacion('re@test.com');
  const tokenNuevo = correo.ultimoToken();

  assert.strictEqual(correo.enviados.length, 2);
  assert.notStrictEqual(tokenNuevo, tokenViejo);
  await assert.rejects(() => logica.confirmarCuenta(tokenViejo), { codigo: 'TOKEN_INVALIDO' });
  await logica.confirmarCuenta(tokenNuevo);
  assert.strictEqual((await daoMock.obtenerPorEmail('re@test.com')).estado, 'confirmado');
});

test('14. Reenviar no envía nada si la cuenta no existe o ya está confirmada', async () => {
  await logica.reenviarConfirmacion('noexiste@test.com');
  await logica.registrarUsuario('ok@test.com', '123456');
  await logica.confirmarCuenta(correo.ultimoToken());
  await logica.reenviarConfirmacion('ok@test.com');
  assert.strictEqual(correo.enviados.length, 1);
});

test('15. El login de una cuenta pendiente devuelve el código CUENTA_PENDIENTE', async () => {
  await logica.registrarUsuario('pend@test.com', '123456');
  await assert.rejects(() => logica.loginUsuario('pend@test.com', '123456'), { codigo: 'CUENTA_PENDIENTE' });
});
