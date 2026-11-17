// Inteligencias artificiales de Alianzas (capa de lógica, D-17).
// decidir() solo propone una acción; la valida y aplica reglas.aplicarAccion. Una jugada por ronda.
import { CONFIG, alcanzables, distancia, dentroDelMapa, ocupada, vivos } from './reglas.js';

const elegir = (lista, rng) => lista[Math.floor(rng() * lista.length)];

// De los candidatos, los que tienen el valor mínimo según f (desempate al azar)
function minimos(lista, f) {
  const min = Math.min(...lista.map(f));
  return lista.filter(x => f(x) === min);
}

// Aliados: países que me han regalado puntos alguna vez
function esAliado(ia, otro) {
  return !!ia.aliados[otro.id];
}

// Una casilla contigua y libre que me acerque al país más cercano; null si no hay
function pasoHaciaElMasCercano(estado, ia, rng) {
  const otros = vivos(estado).filter(o => o.id !== ia.id);
  if (otros.length === 0) return null;
  const destino = elegir(minimos(otros, o => distancia(ia, o)), rng);
  const actual = distancia(ia, destino);

  const pasos = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const x = ia.x + dx;
      const y = ia.y + dy;
      if ((dx || dy) && dentroDelMapa(estado, x, y) && !ocupada(estado, x, y) && distancia({ x, y }, destino) < actual) {
        pasos.push({ x, y });
      }
    }
  }
  if (pasos.length === 0) return null;
  const paso = elegir(pasos, rng);
  return { tipo: 'mover', x: paso.x, y: paso.y };
}

// Acercarse a alguien; si no se puede, ampliar el radio
function buscarContacto(estado, ia, rng) {
  return pasoHaciaElMasCercano(estado, ia, rng) || { tipo: 'expandir' };
}

const estrategias = {
  // Ataca al más débil a su alcance; si no hay nadie, va a buscarlo
  agresiva(estado, ia, rng) {
    const objetivos = alcanzables(estado, ia);
    if (objetivos.length > 0) {
      const objetivo = elegir(minimos(objetivos, o => o.vidas), rng);
      return { tipo: 'atacar', objetivo: objetivo.id };
    }
    return buscarContacto(estado, ia, rng);
  },

  // Devuelve los regalos, responde a los ataques y si no, ahorra o crece
  diplomatica(estado, ia) {
    const cerca = alcanzables(estado, ia);
    const deudor = cerca.find(o => (ia.regalosRecibidos[o.id] || 0) > 0 && o.puntos < CONFIG.TOPE_PUNTOS);
    if (deudor && ia.puntos >= 2) {
      ia.regalosRecibidos[deudor.id] -= 1; // la deuda se da por saldada
      return { tipo: 'regalar', objetivo: deudor.id };
    }
    const agresor = cerca.find(o => (ia.ataquesRecibidos[o.id] || 0) > 0 && !esAliado(ia, o));
    if (agresor) {
      return { tipo: 'atacar', objetivo: agresor.id };
    }
    // Crece si le sobran puntos (o si está al máximo y no tiene a nadie cerca, para no desperdiciar la recarga)
    if ((ia.puntos >= 4 && ia.radio < 6) || (ia.puntos >= CONFIG.TOPE_PUNTOS && cerca.length === 0)) {
      return { tipo: 'expandir' };
    }
    return null; // ahorra puntos
  },

  // Remata a quien tenga 1 vida; ataca si va sobrado de puntos; si no hay nadie cerca, se acerca o crece
  equilibrada(estado, ia, rng) {
    const objetivos = alcanzables(estado, ia).filter(o => !esAliado(ia, o));
    const rematable = objetivos.find(o => o.vidas === 1);
    if (rematable) {
      return { tipo: 'atacar', objetivo: rematable.id };
    }
    if (objetivos.length > 0 && ia.puntos >= 3) {
      return { tipo: 'atacar', objetivo: elegir(minimos(objetivos, o => o.vidas), rng).id };
    }
    if (alcanzables(estado, ia).length === 0 && ia.puntos >= 2) {
      return rng() < 0.5 ? buscarContacto(estado, ia, rng) : { tipo: 'expandir' };
    }
    return null;
  },
};

export function decidir(estado, ia, rng = Math.random) {
  if (!ia.vivo || ia.puntos < CONFIG.COSTE_ACCION) return null;
  const estrategia = estrategias[ia.personalidad] || estrategias.equilibrada;
  return estrategia(estado, ia, rng);
}
