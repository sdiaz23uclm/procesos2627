import assert from 'node:assert';
import { test, beforeEach } from 'node:test';
import { LogicaUsuarios, normalizarEmail, VALIDEZ_TOKEN_MS } from '../servidor/logica.js';

// Creamos un DAO simulado en memoria para las pruebas unitarias (evita depender de MongoDB externo en los tests)
class DAOMock {
  constructor() {
    this.usuarios = [];
  }
  // Igual que la BD real: las cuentas eliminadas (borrado lógico) no se encuentran por email ni token
  vigente(u) {
    return u.estado !== 'eliminado';
  }
  async guardar(usuario) {
    this.usuarios.push(usuario);
    return usuario;
  }
  async obtenerPorEmail(email) {
    return this.usuarios.find(u => u.email === email && this.vigente(u)) || null;
  }
  async obtenerPorTokenConfirmacion(tokenHash) {
    return this.usuarios.find(u => u.tokenConfirmacionHash === tokenHash && this.vigente(u)) || null;
  }
  async obtenerTodos() {
    return this.usuarios;
  }
  async actualizar(email, cambios) {
    const u = this.usuarios.find(x => x.email === email && this.vigente(x));
    if (!u) return false;
    Object.assign(u, cambios);
    return true;
  }
  async eliminar(email) {
    const index = this.usuarios.findIndex(u => u.email === email && this.vigente(u));
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

// --- RF-04: inicio de sesión con OAuth (la lógica recibe un email ya verificado por el proveedor) ---

test('16. OAuth con un email nuevo crea un usuario activo sin contraseña y sin enviar correo', async () => {
  const u = await logica.loginOAuth('Google@Test.com');
  assert.strictEqual(u.email, 'google@test.com');
  assert.strictEqual(u.estado, 'oauth');
  assert.strictEqual(u.rol, 'usuario');
  assert.strictEqual(u.passwordHash, null);
  assert.strictEqual(await logica.comprobarActivo('google@test.com'), true);
  assert.strictEqual(correo.enviados.length, 0);
});

test('17. OAuth sobre una cuenta local pendiente la vincula y la confirma (D-11)', async () => {
  const local = await logica.registrarUsuario('mixto@test.com', 'Password123*');
  const hashOriginal = local.passwordHash;
  const tokenPendiente = correo.ultimoToken();

  const u = await logica.loginOAuth('mixto@test.com');
  assert.strictEqual(u.estado, 'confirmado');
  assert.strictEqual(daoMock.usuarios.length, 1);
  // Conserva su contraseña: puede seguir entrando también en local
  assert.strictEqual(u.passwordHash, hashOriginal);
  await logica.loginUsuario('mixto@test.com', 'Password123*');
  // El enlace de confirmación pendiente deja de valer
  await assert.rejects(() => logica.confirmarCuenta(tokenPendiente), { codigo: 'TOKEN_INVALIDO' });
});

test('18. OAuth repetido con el mismo email no duplica el usuario', async () => {
  await logica.loginOAuth('repe@test.com');
  await logica.loginOAuth('repe@test.com');
  assert.strictEqual(daoMock.usuarios.length, 1);
});

test('19. OAuth con el email de ADMIN_EMAIL crea la cuenta con rol admin', async () => {
  const anterior = process.env.ADMIN_EMAIL;
  process.env.ADMIN_EMAIL = 'jefe@test.com';
  try {
    const u = await logica.loginOAuth('jefe@test.com');
    assert.strictEqual(u.rol, 'admin');
  } finally {
    if (anterior === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = anterior;
  }
});

test('20. Error al hacer login local en una cuenta creada con Google', async () => {
  await logica.loginOAuth('solo-google@test.com');
  await assert.rejects(() => logica.loginUsuario('solo-google@test.com', 'loquesea'), { codigo: 'CUENTA_OAUTH' });
});

test('21. Error si OAuth entrega un email no válido', async () => {
  await assert.rejects(() => logica.loginOAuth(undefined), /EMAIL_INVALIDO/);
});

// --- RF-08 / RF-09: consulta de actividad y borrado lógico (D-12) ---

// Crea un usuario ya confirmado y lo devuelve
async function crearConfirmado(email, password = 'Password123*', rol = 'usuario') {
  await logica.registrarUsuario(email, password, rol);
  await logica.confirmarCuenta(correo.ultimoToken());
  return await daoMock.obtenerPorEmail(email);
}

test('22. El listado del administrador no expone hashes e indica si cada usuario está activo', async () => {
  const admin = await crearConfirmado('admin@test.com', 'x', 'admin');
  await logica.registrarUsuario('pend@test.com', '123456');
  const lista = await logica.listarUsuarios(admin);
  assert.deepStrictEqual(lista, [
    { email: 'admin@test.com', rol: 'admin', estado: 'confirmado', activo: true },
    { email: 'pend@test.com', rol: 'usuario', estado: 'pendiente', activo: false },
  ]);
});

test('23. El administrador consulta si un usuario está activo', async () => {
  const admin = await crearConfirmado('admin@test.com', 'x', 'admin');
  await crearConfirmado('ana@test.com');
  assert.deepStrictEqual(await logica.consultarActivo(admin, ' ANA@test.com '), { email: 'ana@test.com', activo: true });
  assert.deepStrictEqual(await logica.consultarActivo(admin, 'nadie@test.com'), { email: 'nadie@test.com', activo: false });
});

test('24. Error: un usuario normal no puede consultar si otro está activo', async () => {
  const normal = await crearConfirmado('normal@test.com');
  await assert.rejects(() => logica.consultarActivo(normal, 'normal@test.com'), { codigo: 'SIN_PERMISOS' });
  await assert.rejects(() => logica.consultarActivo(null, 'normal@test.com'), { codigo: 'SIN_PERMISOS' });
});

test('25. Un usuario se elimina a sí mismo: queda marcado y no puede volver a iniciar sesión', async () => {
  await crearConfirmado('yo@test.com', 'Password123*');
  await logica.eliminarUsuario('yo@test.com', 'yo@test.com');

  const registro = daoMock.usuarios.find(u => u.email === 'yo@test.com');
  assert.strictEqual(registro.estado, 'eliminado');
  assert.ok(registro.eliminadoEn instanceof Date);
  assert.strictEqual(await logica.comprobarActivo('yo@test.com'), false);
  await assert.rejects(() => logica.loginUsuario('yo@test.com', 'Password123*'), /Credenciales inválidas/);
});

test('26. Error: un usuario normal no puede eliminar a otro', async () => {
  await crearConfirmado('a@test.com');
  await crearConfirmado('b@test.com');
  await assert.rejects(() => logica.eliminarUsuario('a@test.com', 'b@test.com'), { codigo: 'SIN_PERMISOS' });
  assert.strictEqual((await daoMock.obtenerPorEmail('b@test.com')).estado, 'confirmado');
});

test('27. El administrador puede eliminar a cualquier usuario', async () => {
  await crearConfirmado('admin@test.com', 'x', 'admin');
  await crearConfirmado('victima@test.com');
  await logica.eliminarUsuario('admin@test.com', 'victima@test.com');
  assert.strictEqual(await daoMock.obtenerPorEmail('victima@test.com'), null);
});

test('28. Error al eliminar un usuario inexistente o ya eliminado', async () => {
  await crearConfirmado('admin@test.com', 'x', 'admin');
  await assert.rejects(() => logica.eliminarUsuario('admin@test.com', 'fantasma@test.com'), { codigo: 'USUARIO_NO_ENCONTRADO' });
});

test('29. Tras eliminarse, el mismo email puede registrarse de nuevo y obtiene una cuenta nueva', async () => {
  await crearConfirmado('vuelve@test.com', 'Vieja123*');
  await logica.eliminarUsuario('vuelve@test.com', 'vuelve@test.com');

  const nueva = await logica.registrarUsuario('vuelve@test.com', 'Nueva123*');
  assert.strictEqual(nueva.estado, 'pendiente');
  assert.strictEqual(daoMock.usuarios.filter(u => u.email === 'vuelve@test.com').length, 2);
  await logica.confirmarCuenta(correo.ultimoToken());
  // La contraseña vieja ya no vale: es otra cuenta
  await assert.rejects(() => logica.loginUsuario('vuelve@test.com', 'Vieja123*'), /Credenciales inválidas/);
  await logica.loginUsuario('vuelve@test.com', 'Nueva123*');
});

test('30. Una cuenta eliminada no se reactiva con Google: se crea una cuenta nueva', async () => {
  await crearConfirmado('g@test.com');
  await logica.eliminarUsuario('g@test.com', 'g@test.com');
  const u = await logica.loginOAuth('g@test.com');
  assert.strictEqual(u.estado, 'oauth');
  assert.strictEqual(daoMock.usuarios.filter(x => x.email === 'g@test.com').length, 2);
});
