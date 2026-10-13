import assert from 'node:assert';
import { test, beforeEach } from 'node:test';
import { DatosEnMemoria } from '../servidor/datos.js';
import { LogicaUsuarios } from '../servidor/logica.js';

let logica;

beforeEach(() => {
  logica = new LogicaUsuarios(new DatosEnMemoria());
});

test('1. Registrar un usuario nuevo con éxito y contraseña hasheada', async () => {
  const u = await logica.registrarUsuario('user@test.com', '123456');
  assert.strictEqual(u.email, 'user@test.com');
  assert.strictEqual(u.estado, 'pendiente');
  assert.ok(u.passwordHash, 'Debe contener un hash de la contraseña');
  assert.notStrictEqual(u.passwordHash, '123456');
});

test('2. Error al registrar un email ya existente', async () => {
  await logica.registrarUsuario('duplicado@test.com', '123456');
  
  await assert.rejects(async () => {
    await logica.registrarUsuario('duplicado@test.com', '654321');
  }, /El usuario ya existe/);
});

test('3. Inicio de sesión exitoso con credenciales correctas', async () => {
  await logica.registrarUsuario('login@test.com', 'miPassword123');
  const usuarioLogueado = await logica.loginUsuario('login@test.com', 'miPassword123');
  
  assert.strictEqual(usuarioLogueado.email, 'login@test.com');
});

test('4. Error al iniciar sesión con contraseña incorrecta', async () => {
  await logica.registrarUsuario('login2@test.com', 'miPassword123');
  
  await assert.rejects(async () => {
    await logica.loginUsuario('login2@test.com', 'passwordFalsa');
  }, /Credenciales inválidas/);
});

test('5. Usuario normal falla al intentar eliminar a otro usuario', async () => {
  await logica.registrarUsuario('user1@test.com', '123456');
  await logica.registrarUsuario('user2@test.com', '123456');

  await assert.rejects(async () => {
    await logica.eliminarUsuario('user1@test.com', 'user2@test.com', false);
  }, /No tienes permisos/);
});