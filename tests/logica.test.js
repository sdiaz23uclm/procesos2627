import assert from 'node:assert';
import { test, beforeEach } from 'node:test';
import { LogicaUsuarios } from '../servidor/logica.js';

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
  async eliminar(email) {
    const index = this.usuarios.findIndex(u => u.email === email);
    if (index !== -1) {
      this.usuarios.splice(index, 1);
      return true;
    }
    return false;
  }
}

let logica;
let daoMock;

beforeEach(() => {
  daoMock = new DAOMock();
  logica = new LogicaUsuarios(daoMock);
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