import assert from 'node:assert';
import { test, beforeEach } from 'node:test';
import { GestorSesiones, DURACION_SESION_MS } from '../servidor/sesiones.js';

// Doble del almacén de sesiones (en la app real es MongoDB, en servidor/datos.js)
class AlmacenFalso {
  constructor(reloj) { this.sesiones = new Map(); this.reloj = reloj; }
  async crearSesion(id, email, expira) { this.sesiones.set(id, { _id: id, email, expira }); }
  async obtenerSesion(id) {
    const s = this.sesiones.get(id);
    return s && s.expira.getTime() >= this.reloj() ? s : null;
  }
  async eliminarSesion(id) { this.sesiones.delete(id); }
  async eliminarSesionesDe(email) {
    for (const [id, s] of this.sesiones) if (s.email === email) this.sesiones.delete(id);
  }
}

let ahora, almacen, gestor;
beforeEach(() => {
  ahora = Date.parse('2026-11-17T12:00:00Z');
  almacen = new AlmacenFalso(() => ahora);
  gestor = new GestorSesiones(almacen, { reloj: () => ahora });
});

test('sesiones: crear y recuperar el email; en el almacén no se guarda el id en claro', async () => {
  const id = await gestor.crear('ana@test.com');
  assert.strictEqual(await gestor.obtenerEmail(id), 'ana@test.com');
  assert.ok(!almacen.sesiones.has(id));
});

test('sesiones: un id inventado o vacío no da acceso', async () => {
  await gestor.crear('ana@test.com');
  assert.strictEqual(await gestor.obtenerEmail('inventado'), null);
  assert.strictEqual(await gestor.obtenerEmail(undefined), null);
});

test('sesiones: caducan pasado su tiempo de vida', async () => {
  const id = await gestor.crear('ana@test.com');
  ahora += DURACION_SESION_MS + 1;
  assert.strictEqual(await gestor.obtenerEmail(id), null);
});

test('sesiones: cerrar invalida solo esa sesión', async () => {
  const id1 = await gestor.crear('ana@test.com');
  const id2 = await gestor.crear('ana@test.com');
  await gestor.cerrar(id1);
  assert.strictEqual(await gestor.obtenerEmail(id1), null);
  assert.strictEqual(await gestor.obtenerEmail(id2), 'ana@test.com');
});

test('sesiones: al eliminar una cuenta se cierran todas sus sesiones', async () => {
  const id1 = await gestor.crear('ana@test.com');
  const id2 = await gestor.crear('ana@test.com');
  const otra = await gestor.crear('luis@test.com');
  await gestor.cerrarTodasDe('ana@test.com');
  assert.strictEqual(await gestor.obtenerEmail(id1), null);
  assert.strictEqual(await gestor.obtenerEmail(id2), null);
  assert.strictEqual(await gestor.obtenerEmail(otra), 'luis@test.com');
});
