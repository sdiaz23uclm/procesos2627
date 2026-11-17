import assert from 'node:assert';
import { test, beforeEach } from 'node:test';
import { LogicaPartidas, MAX_AVANCE_MS } from '../servidor/logicaPartidas.js';
import { rngConSemilla } from './ayudas.js';

// Doble de la colección de partidas, con el mismo control de versión que MongoDB
class DAOPartidasFalso {
  constructor() { this.partidas = new Map(); this.conflictosPendientes = 0; }
  copia(d) { return structuredClone(d); }
  async obtenerPartida(email) { const d = this.partidas.get(email); return d ? this.copia(d) : null; }
  async crearPartida(doc) { this.partidas.set(doc.email, this.copia(doc)); }
  async actualizarPartida(doc, versionAnterior) {
    if (this.conflictosPendientes > 0) {
      // Simula que otra petición guardó antes
      this.conflictosPendientes--;
      this.partidas.get(doc.email).version++;
      return false;
    }
    const actual = this.partidas.get(doc.email);
    if (!actual || actual.version !== versionAnterior) return false;
    this.partidas.set(doc.email, this.copia(doc));
    return true;
  }
  async eliminarPartida(email) { this.partidas.delete(email); }
}

let dao, logica, ahora;
const EMAIL = 'jugador@test.com';
beforeEach(() => {
  dao = new DAOPartidasFalso();
  ahora = 1_000_000;
  logica = new LogicaPartidas(dao, { reloj: () => ahora, rng: rngConSemilla(5) });
});

test('partidas: se crea una partida con el país elegido y se puede consultar', async () => {
  const vista = await logica.nuevaPartida(EMAIL, 'it');
  assert.strictEqual(vista.tuPais, 'it');
  assert.strictEqual(vista.ronda, 1);
  assert.strictEqual(vista.estado, 'en_curso');
  assert.strictEqual(vista.jugadores.length, 4);
  assert.strictEqual((await logica.consultar(EMAIL)).tuPais, 'it');
});

test('partidas: error al actuar durante los 20 s de espera', async () => {
  await logica.nuevaPartida(EMAIL, 'it');
  for (let i = 0; i < 5; i++) { ahora += 2_500; await logica.consultar(EMAIL); }
  await assert.rejects(() => logica.actuar(EMAIL, { tipo: 'expandir' }), { codigo: 'FUERA_DE_TURNO' });
});

test('partidas: la vista no expone la memoria interna de las IAs', async () => {
  const vista = await logica.nuevaPartida(EMAIL, 'it');
  for (const j of vista.jugadores) {
    assert.strictEqual(j.regalosRecibidos, undefined);
    assert.strictEqual(j.proximaAccionMs, undefined);
  }
});

test('partidas: consultar sin partida devuelve null y actuar da error', async () => {
  assert.strictEqual(await logica.consultar(EMAIL), null);
  await assert.rejects(() => logica.actuar(EMAIL, { tipo: 'expandir' }), { codigo: 'PARTIDA_NO_ENCONTRADA' });
});

test('partidas: el reloj avanza con el tiempo real entre consultas', async () => {
  await logica.nuevaPartida(EMAIL, 'it');
  for (let i = 0; i < 25; i++) {   // 25 consultas cada 500 ms = 12,5 s
    ahora += 500;
    await logica.consultar(EMAIL);
  }
  const vista = await logica.consultar(EMAIL);
  assert.strictEqual(vista.ronda, 1);
  assert.strictEqual(vista.fase, 'espera');
  assert.strictEqual(vista.msHastaRecarga, 17_500);
});

test('partidas: si nadie consulta durante mucho tiempo, solo avanza como mucho 3 s (pausa implícita)', async () => {
  await logica.nuevaPartida(EMAIL, 'it');
  ahora += 60 * 60 * 1000; // una hora sin consultar
  const vista = await logica.consultar(EMAIL);
  assert.strictEqual(vista.ronda, 1);
  assert.strictEqual(vista.msRestantesTurno, 10_000 - MAX_AVANCE_MS);
});

test('partidas: el jugador actúa y se guarda el resultado', async () => {
  await logica.nuevaPartida(EMAIL, 'it');
  const vista = await logica.actuar(EMAIL, { tipo: 'expandir' });
  const yo = vista.jugadores.find(j => j.id === 'it');
  assert.deepStrictEqual([yo.radio, yo.puntos], [4, 1]);
  assert.strictEqual((await logica.consultar(EMAIL)).jugadores.find(j => j.id === 'it').radio, 4);
});

test('partidas: error de reglas al actuar (fuera de alcance) y la partida no cambia', async () => {
  const vista = await logica.nuevaPartida(EMAIL, 'it');
  const lejano = vista.jugadores.find(j => !j.humano && Math.max(
    Math.abs(j.x - vista.jugadores[0].x), Math.abs(j.y - vista.jugadores[0].y)) > 3);
  await assert.rejects(() => logica.actuar(EMAIL, { tipo: 'atacar', objetivo: lejano.id }), { codigo: 'FUERA_DE_ALCANCE' });
  assert.strictEqual((await logica.consultar(EMAIL)).jugadores[0].puntos, 2);
});

test('partidas: «Guardar» pausa la partida; en pausa no avanza ni se puede actuar; «Reanudar» la sigue', async () => {
  await logica.nuevaPartida(EMAIL, 'it');
  ahora += 1000;
  const guardada = await logica.guardar(EMAIL);
  assert.strictEqual(guardada.pausada, true);
  assert.ok(guardada.guardadaEn instanceof Date);
  const tiempo = guardada.msRestantesTurno;

  ahora += 2000;
  assert.strictEqual((await logica.consultar(EMAIL)).msRestantesTurno, tiempo);
  await assert.rejects(() => logica.actuar(EMAIL, { tipo: 'expandir' }), { codigo: 'PARTIDA_PAUSADA' });

  ahora += 2000;
  await logica.reanudar(EMAIL);
  ahora += 1000;
  assert.strictEqual((await logica.consultar(EMAIL)).msRestantesTurno, tiempo - 1000);
});

test('partidas: autoguardado al final de cada ronda', async () => {
  await logica.nuevaPartida(EMAIL, 'it');
  for (let i = 0; i < 11; i++) { ahora += 2_800; await logica.consultar(EMAIL); }
  const vista = await logica.consultar(EMAIL);
  assert.strictEqual(vista.ronda, 2);
  assert.strictEqual(vista.autoguardadoRonda, 2);
});

test('partidas: si otra petición guarda a la vez, se reintenta sin perder la acción', async () => {
  await logica.nuevaPartida(EMAIL, 'it');
  dao.conflictosPendientes = 2;
  const vista = await logica.actuar(EMAIL, { tipo: 'expandir' });
  assert.strictEqual(vista.jugadores.find(j => j.id === 'it').radio, 4);
});

test('partidas: una partida nueva sustituye a la anterior', async () => {
  await logica.nuevaPartida(EMAIL, 'it');
  await logica.nuevaPartida(EMAIL, 'fr');
  assert.strictEqual((await logica.consultar(EMAIL)).tuPais, 'fr');
  assert.strictEqual(dao.partidas.size, 1);
});

test('partidas: error al crear una partida con un país inválido', async () => {
  await assert.rejects(() => logica.nuevaPartida(EMAIL, 'zz'), { codigo: 'PAIS_INVALIDO' });
});
