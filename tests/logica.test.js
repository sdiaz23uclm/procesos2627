import assert from "node:assert";
import { test, beforeEach } from "node:test";
import { DatosEnMemoria } from "../servidor/datos.js";
import { LogicaUsuarios } from "../servidor/logica.js";

let logica;

beforeEach(() => {
  logica = new LogicaUsuarios(new DatosEnMemoria());
});

test("1. Registrar un usuario nuevo con éxito", () => {
  const u = logica.registrarUsuario("user@test.com", "123456");
  assert.strictEqual(u.email, "user@test.com");
  assert.strictEqual(u.estado, "pendiente");
});

test("2. Error al registrar un email ya existente", () => {
  logica.registrarUsuario("duplicado@test.com", "123456");
  assert.throws(() => {
    logica.registrarUsuario("duplicado@test.com", "654321");
  }, /El usuario ya existe/);
});

test("3. Listar usuarios devuelve los registrados", () => {
  logica.registrarUsuario("u1@test.com", "123456");
  logica.registrarUsuario("u2@test.com", "123456");
  assert.strictEqual(logica.listarUsuarios().length, 2);
});

test("4. Comprobar que usuario pendiente no está activo", () => {
  logica.registrarUsuario("pendiente@test.com", "123456");
  assert.strictEqual(logica.comprobarActivo("pendiente@test.com"), false);
});

test("5. Usuario normal falla al intentar eliminar a otro usuario", () => {
  logica.registrarUsuario("user1@test.com", "123456");
  logica.registrarUsuario("user2@test.com", "123456");

  assert.throws(() => {
    logica.eliminarUsuario("user1@test.com", "user2@test.com", false);
  }, /No tienes permisos/);
});