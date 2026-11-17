import assert from 'node:assert';
import { test, beforeEach } from 'node:test';
import { crearEstado, aplicarAccion, distancia } from '../servidor/juego/reglas.js';
import { decidir } from '../servidor/juego/ia.js';
import { rngConSemilla, colocar } from './ayudas.js';

let e, yo, rng;
const ia = personalidad => e.jugadores.find(j => j.personalidad === personalidad);

beforeEach(() => {
  rng = rngConSemilla(11);
  e = crearEstado('es', rng);
  yo = e.jugadores[0];
});

test('ia agresiva: ataca al país con menos vidas a su alcance', () => {
  const a = ia('agresiva');
  const otra = ia('equilibrada');
  colocar(e, [[a.id, 5, 5], ['es', 6, 5], [otra.id, 4, 4], [ia('diplomatica').id, 11, 11]]);
  otra.vidas = 1;
  assert.deepStrictEqual(decidir(e, a, rng), { tipo: 'atacar', objetivo: otra.id });
});

test('ia agresiva: si no tiene a nadie a su alcance se acerca al más cercano', () => {
  const a = ia('agresiva');
  colocar(e, [[a.id, 0, 0], ['es', 11, 11], [ia('equilibrada').id, 11, 0], [ia('diplomatica').id, 0, 11]]);
  const accion = decidir(e, a, rng);
  assert.strictEqual(accion.tipo, 'mover');
  assert.strictEqual(distancia({ x: accion.x, y: accion.y }, { x: 0, y: 0 }), 1);
  aplicarAccion(e, a.id, accion); // la acción propuesta es válida
});

test('ia diplomática: devuelve los puntos que le regalan', () => {
  const d = ia('diplomatica');
  colocar(e, [['es', 5, 5], [d.id, 6, 6], [ia('agresiva').id, 0, 11], [ia('equilibrada').id, 11, 0]]);
  aplicarAccion(e, 'es', { tipo: 'regalar', objetivo: d.id });
  assert.deepStrictEqual(decidir(e, d, rng), { tipo: 'regalar', objetivo: 'es' });
});

test('ia diplomática: responde a quien la ataca, salvo que sea su aliado', () => {
  const d = ia('diplomatica');
  colocar(e, [['es', 5, 5], [d.id, 6, 6], [ia('agresiva').id, 0, 11], [ia('equilibrada').id, 11, 0]]);
  aplicarAccion(e, 'es', { tipo: 'atacar', objetivo: d.id });
  assert.deepStrictEqual(decidir(e, d, rng), { tipo: 'atacar', objetivo: 'es' });
  d.aliados.es = true;
  assert.strictEqual(decidir(e, d, rng), null);
});

test('ia equilibrada: remata a un país con una sola vida aunque tenga pocos puntos', () => {
  const q = ia('equilibrada');
  colocar(e, [[q.id, 5, 5], ['es', 7, 7], [ia('agresiva').id, 0, 11], [ia('diplomatica').id, 11, 0]]);
  yo.vidas = 1;
  assert.deepStrictEqual(decidir(e, q, rng), { tipo: 'atacar', objetivo: 'es' });
});

test('ia: sin puntos no hace nada', () => {
  const a = ia('agresiva');
  colocar(e, [[a.id, 5, 5], ['es', 6, 5]]);
  a.puntos = 0;
  assert.strictEqual(decidir(e, a, rng), null);
});

test('ia: en 20 partidas simuladas de 1 hora las reglas siempre se cumplen', async () => {
  const { avanzarTiempo, CONFIG } = await import('../servidor/juego/reglas.js');
  let terminadas = 0;
  for (let semilla = 1; semilla <= 20; semilla++) {
    const r = rngConSemilla(semilla);
    const p = crearEstado('es', r);
    for (let minuto = 0; minuto < 60 && p.estado === 'en_curso'; minuto++) {
      avanzarTiempo(p, 60_000, decidir, r);
      const posiciones = new Set(p.jugadores.map(j => `${j.x},${j.y}`));
      assert.strictEqual(posiciones.size, 4, 'dos países en la misma casilla');
      for (const j of p.jugadores) {
        assert.ok(j.x >= 0 && j.y >= 0 && j.x < 12 && j.y < 12, 'fuera del mapa');
        assert.ok(j.puntos >= 0 && j.puntos <= CONFIG.TOPE_PUNTOS, 'puntos fuera de rango');
        assert.ok(j.vidas >= 0 && j.vidas <= 3, 'vidas fuera de rango');
        assert.strictEqual(j.vivo, j.vidas > 0);
      }
    }
    if (p.estado === 'terminada') {
      terminadas++;
    } else {
      // El humano no juega: la partida solo puede seguir abierta si queda a solas con la IA
      // diplomática, que nunca ataca primero (D-17)
      const enPie = p.jugadores.filter(j => j.vivo).map(j => j.personalidad ?? 'humano').sort();
      assert.deepStrictEqual(enPie, ['diplomatica', 'humano'], `semilla ${semilla}`);
    }
  }
  assert.ok(terminadas > 0);
});
