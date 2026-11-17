import assert from 'node:assert';
import { test, beforeEach } from 'node:test';
import { CONFIG, crearEstado, aplicarAccion, avanzarTiempo, relojes, distancia, alcanzables } from '../servidor/juego/reglas.js';
import { rngConSemilla, colocar, sinIA } from './ayudas.js';

let e;     // estado de la partida
let yo;    // país humano
let rivales;
beforeEach(() => {
  e = crearEstado('es', rngConSemilla(7));
  yo = e.jugadores[0];
  rivales = e.jugadores.slice(1);
  // Situación base: yo en (5,5), un rival a distancia 2, otro a 3 y otro lejos
  colocar(e, [['es', 5, 5], [rivales[0].id, 7, 5], [rivales[1].id, 5, 8], [rivales[2].id, 11, 11]]);
});

test('alianzas: la partida empieza con 4 países distintos, 3 vidas, 2 puntos, radio 3 y 3 personalidades', () => {
  const nueva = crearEstado('fr', rngConSemilla(3));
  assert.strictEqual(nueva.tam, 12);
  assert.strictEqual(nueva.jugadores.length, 4);
  assert.strictEqual(new Set(nueva.jugadores.map(j => j.id)).size, 4);
  assert.strictEqual(nueva.jugadores[0].id, 'fr');
  assert.ok(nueva.jugadores[0].humano);
  for (const j of nueva.jugadores) {
    assert.deepStrictEqual([j.vidas, j.puntos, j.radio, j.vivo], [3, 2, 3, true]);
  }
  assert.deepStrictEqual(nueva.jugadores.slice(1).map(j => j.personalidad).sort(), ['agresiva', 'diplomatica', 'equilibrada']);
  // Empiezan en esquinas distintas
  assert.strictEqual(new Set(nueva.jugadores.map(j => `${j.x},${j.y}`)).size, 4);
});

test('alianzas: error al crear una partida con un país que no existe', () => {
  assert.throws(() => crearEstado('xx'), { codigo: 'PAIS_INVALIDO' });
});

test('alianzas: el radio es cuadrado (las diagonales cuentan)', () => {
  assert.strictEqual(distancia({ x: 0, y: 0 }, { x: 3, y: 3 }), 3);
  assert.deepStrictEqual(alcanzables(e, yo).map(j => j.id).sort(), [rivales[0].id, rivales[1].id].sort());
});

test('alianzas: atacar quita una vida al objetivo y cuesta un punto', () => {
  aplicarAccion(e, 'es', { tipo: 'atacar', objetivo: rivales[0].id });
  assert.strictEqual(rivales[0].vidas, 2);
  assert.strictEqual(yo.puntos, 1);
});

test('alianzas: error al atacar fuera del radio de acción', () => {
  assert.throws(() => aplicarAccion(e, 'es', { tipo: 'atacar', objetivo: rivales[2].id }), { codigo: 'FUERA_DE_ALCANCE' });
  assert.strictEqual(yo.puntos, 2);
});

test('alianzas: error al actuar sin puntos', () => {
  yo.puntos = 0;
  assert.throws(() => aplicarAccion(e, 'es', { tipo: 'expandir' }), { codigo: 'SIN_PUNTOS' });
});

test('alianzas: con 0 vidas un país queda eliminado y su casilla sigue ocupada', () => {
  rivales[0].vidas = 1;
  aplicarAccion(e, 'es', { tipo: 'atacar', objetivo: rivales[0].id });
  assert.strictEqual(rivales[0].vivo, false);
  assert.throws(() => aplicarAccion(e, 'es', { tipo: 'atacar', objetivo: rivales[0].id }), /ya está eliminado/);
  colocar(e, [['es', 6, 5]]);
  assert.throws(() => aplicarAccion(e, 'es', { tipo: 'mover', x: 7, y: 5 }), { codigo: 'CASILLA_OCUPADA' });
});

test('alianzas: regalar pasa un punto al otro país, sin superar el tope', () => {
  aplicarAccion(e, 'es', { tipo: 'regalar', objetivo: rivales[0].id });
  assert.strictEqual(yo.puntos, 1);
  assert.strictEqual(rivales[0].puntos, 3);
  assert.strictEqual(rivales[0].aliados.es, true);
  rivales[0].puntos = CONFIG.TOPE_PUNTOS;
  assert.throws(() => aplicarAccion(e, 'es', { tipo: 'regalar', objetivo: rivales[0].id }), { codigo: 'TOPE_PUNTOS' });
});

test('alianzas: moverse solo a una casilla contigua (también en diagonal), libre y dentro del mapa', () => {
  aplicarAccion(e, 'es', { tipo: 'mover', x: 4, y: 4 });
  assert.deepStrictEqual([yo.x, yo.y], [4, 4]);
  assert.throws(() => aplicarAccion(e, 'es', { tipo: 'mover', x: 6, y: 6 }), /contigua/);
  colocar(e, [['es', 0, 0]]);
  assert.throws(() => aplicarAccion(e, 'es', { tipo: 'mover', x: -1, y: 0 }), /fuera del mapa/);
});

test('alianzas: expandir aumenta el radio en una casilla', () => {
  aplicarAccion(e, 'es', { tipo: 'expandir' });
  assert.strictEqual(yo.radio, 4);
});

test('alianzas: acción desconocida da error', () => {
  assert.throws(() => aplicarAccion(e, 'es', { tipo: 'teletransportar' }), { codigo: 'ACCION_INVALIDA' });
  assert.throws(() => aplicarAccion(e, 'es', null), { codigo: 'ACCION_INVALIDA' });
});

test('alianzas: las rondas duran 10 s y cada 30 s se recargan +2 puntos hasta un máximo de 6', () => {
  avanzarTiempo(e, 9_999, sinIA);
  assert.strictEqual(e.ronda, 1);
  avanzarTiempo(e, 1, sinIA);
  assert.strictEqual(e.ronda, 2);
  assert.strictEqual(yo.puntos, 2);

  avanzarTiempo(e, 20_000, sinIA); // t = 30 s
  assert.strictEqual(e.ronda, 4);
  assert.strictEqual(yo.puntos, 4);
  avanzarTiempo(e, 60_000, sinIA); // t = 90 s: dos recargas más, con tope
  assert.strictEqual(yo.puntos, 6);
  assert.deepStrictEqual(relojes(e), { msRestantesRonda: 10_000, msHastaRecarga: 30_000 });
});

test('alianzas: los eliminados no reciben recarga', () => {
  rivales[0].vivo = false;
  rivales[0].puntos = 0;
  avanzarTiempo(e, 30_000, sinIA);
  assert.strictEqual(rivales[0].puntos, 0);
});

test('alianzas: cada IA juega una vez por ronda', () => {
  let jugadas = 0;
  avanzarTiempo(e, 30_000, () => { jugadas++; return null; }, rngConSemilla(2));
  assert.strictEqual(jugadas, 3 * 3); // 3 IAs x 3 rondas
});

test('alianzas: gana el último país en pie', () => {
  rivales[1].vivo = false;
  rivales[2].vivo = false;
  rivales[0].vidas = 1;
  aplicarAccion(e, 'es', { tipo: 'atacar', objetivo: rivales[0].id });
  assert.strictEqual(e.estado, 'terminada');
  assert.strictEqual(e.resultado, 'victoria');
  assert.strictEqual(e.ganador, 'es');
  assert.throws(() => aplicarAccion(e, 'es', { tipo: 'expandir' }), { codigo: 'PARTIDA_TERMINADA' });
});

test('alianzas: si el jugador es eliminado la partida termina en derrota y el reloj se detiene', () => {
  yo.vidas = 1;
  aplicarAccion(e, rivales[0].id, { tipo: 'atacar', objetivo: 'es' });
  assert.strictEqual(e.estado, 'terminada');
  assert.strictEqual(e.resultado, 'derrota');
  const t = e.tiempoMs;
  avanzarTiempo(e, 50_000, sinIA);
  assert.strictEqual(e.tiempoMs, t);
});
