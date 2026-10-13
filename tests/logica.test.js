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
  await logica.registrarUsuario('login@test.com', 'miPassword123');
  const usuarioLogueado = await logica.loginUsuario('login@test.com', 'miPassword123');
  
  assert.strictEqual(usuarioLogueado.email, 'login@test.com');
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