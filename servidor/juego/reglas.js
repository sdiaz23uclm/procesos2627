// Reglas de Alianzas (capa de lógica). Funciones puras sobre un objeto de estado:
// no conocen HTTP, MongoDB ni el reloj real. El tiempo y el azar se reciben como parámetros.

export const CONFIG = Object.freeze({
  TAM: 12,                     // mapa de 12 x 12 (D-16)
  DURACION_RONDA_MS: 10_000,   // rondas de 10 s (D-14)
  RONDAS_POR_RECARGA: 3,       // recarga cada 30 s (D-15)
  PUNTOS_INICIALES: 2,
  PUNTOS_RECARGA: 2,
  TOPE_PUNTOS: 6,
  VIDAS: 3,
  RADIO_INICIAL: 3,
  COSTE_ACCION: 1,
  MAX_EVENTOS: 30,
});

export const PAISES = Object.freeze([
  { id: 'es', nombre: 'España' },
  { id: 'fr', nombre: 'Francia' },
  { id: 'it', nombre: 'Italia' },
  { id: 'de', nombre: 'Alemania' },
  { id: 'pt', nombre: 'Portugal' },
  { id: 'nl', nombre: 'Países Bajos' },
  { id: 'be', nombre: 'Bélgica' },
  { id: 'ie', nombre: 'Irlanda' },
]);

export const PERSONALIDADES = Object.freeze(['agresiva', 'diplomatica', 'equilibrada']);

export function errorJuego(codigo, mensaje) {
  const err = new Error(mensaje);
  err.codigo = codigo;
  return err;
}

// Radio cuadrado (D-16): cuentan las diagonales
export function distancia(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function buscarJugador(estado, id) {
  return estado.jugadores.find(j => j.id === id) || null;
}

export function vivos(estado) {
  return estado.jugadores.filter(j => j.vivo);
}

// Una casilla está ocupada por cualquier país, vivo o eliminado (los eliminados se quedan en su sitio)
export function ocupada(estado, x, y) {
  return estado.jugadores.some(j => j.x === x && j.y === y);
}

export function dentroDelMapa(estado, x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < estado.tam && y < estado.tam;
}

// Países vivos (distintos de j) dentro de su radio de acción
export function alcanzables(estado, j) {
  return estado.jugadores.filter(o => o.id !== j.id && o.vivo && distancia(j, o) <= j.radio);
}

function barajar(lista, rng) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1));
    [copia[i], copia[k]] = [copia[k], copia[i]];
  }
  return copia;
}

function registrar(estado, texto) {
  estado.eventos.push({ ronda: estado.ronda, texto });
  if (estado.eventos.length > CONFIG.MAX_EVENTOS) estado.eventos.shift();
}

// Momento (en tiempo de juego) en que una IA actuará dentro de la ronda que empieza en inicioRondaMs
function planificarIA(inicioRondaMs, rng) {
  return inicioRondaMs + 2000 + Math.floor(rng() * 6000);
}

/**
 * Crea una partida nueva: el jugador humano con el país elegido y 3 IAs con países al azar (D-18)
 * y una personalidad distinta cada una (D-17). Empiezan cerca de las esquinas.
 */
export function crearEstado(paisHumano, rng = Math.random) {
  const humano = PAISES.find(p => p.id === paisHumano);
  if (!humano) {
    throw errorJuego('PAIS_INVALIDO', 'Elige un país de la lista.');
  }
  const rivales = barajar(PAISES.filter(p => p.id !== paisHumano), rng).slice(0, 3);
  const personalidades = barajar(PERSONALIDADES, rng);
  const t = CONFIG.TAM;
  const esquinas = barajar([[1, 1], [t - 2, 1], [1, t - 2], [t - 2, t - 2]], rng);

  const jugadores = [humano, ...rivales].map((pais, i) => ({
    id: pais.id,
    nombre: pais.nombre,
    humano: i === 0,
    personalidad: i === 0 ? null : personalidades[i - 1],
    x: esquinas[i][0],
    y: esquinas[i][1],
    vidas: CONFIG.VIDAS,
    puntos: CONFIG.PUNTOS_INICIALES,
    radio: CONFIG.RADIO_INICIAL,
    vivo: true,
    // Memoria para las IAs: quién me ha regalado puntos (pendientes de devolver) y quién me ha atacado
    regalosRecibidos: {},   // regalos pendientes de devolver (los usa la IA diplomática)
    aliados: {},            // países que me han regalado puntos alguna vez
    ataquesRecibidos: {},
    proximaAccionMs: i === 0 ? null : planificarIA(0, rng),
  }));

  const estado = {
    tam: t,
    ronda: 1,
    tiempoMs: 0,
    estado: 'en_curso',
    resultado: null,
    ganador: null,
    jugadores,
    eventos: [],
  };
  registrar(estado, `Comienza la partida. Juegas con ${humano.nombre}.`);
  return estado;
}

/**
 * Aplica una acción de un país. Lanza un error con código si no es válida.
 * accion: { tipo: 'atacar'|'regalar', objetivo } | { tipo: 'mover', x, y } | { tipo: 'expandir' }
 */
export function aplicarAccion(estado, idJugador, accion) {
  if (estado.estado !== 'en_curso') {
    throw errorJuego('PARTIDA_TERMINADA', 'La partida ha terminado.');
  }
  const j = buscarJugador(estado, idJugador);
  if (!j || !j.vivo) {
    throw errorJuego('JUGADOR_ELIMINADO', 'Tu país está eliminado.');
  }
  if (!accion || typeof accion.tipo !== 'string') {
    throw errorJuego('ACCION_INVALIDA', 'Acción no reconocida.');
  }
  if (j.puntos < CONFIG.COSTE_ACCION) {
    throw errorJuego('SIN_PUNTOS', 'No te quedan puntos de acción. Espera a la próxima recarga.');
  }

  switch (accion.tipo) {
    case 'atacar': {
      const o = objetivoEnAlcance(estado, j, accion.objetivo);
      j.puntos -= CONFIG.COSTE_ACCION;
      o.vidas -= 1;
      o.ataquesRecibidos[j.id] = (o.ataquesRecibidos[j.id] || 0) + 1;
      registrar(estado, `${j.nombre} ataca a ${o.nombre} (le quedan ${o.vidas} ${o.vidas === 1 ? 'vida' : 'vidas'}).`);
      if (o.vidas <= 0) {
        o.vidas = 0;
        o.vivo = false;
        o.proximaAccionMs = null;
        registrar(estado, `${o.nombre} ha sido eliminado.`);
      }
      comprobarFin(estado);
      break;
    }
    case 'regalar': {
      const o = objetivoEnAlcance(estado, j, accion.objetivo);
      if (o.puntos >= CONFIG.TOPE_PUNTOS) {
        throw errorJuego('TOPE_PUNTOS', `${o.nombre} ya tiene el máximo de ${CONFIG.TOPE_PUNTOS} puntos.`);
      }
      j.puntos -= CONFIG.COSTE_ACCION;
      o.puntos += 1;
      o.regalosRecibidos[j.id] = (o.regalosRecibidos[j.id] || 0) + 1;
      o.aliados[j.id] = true;
      registrar(estado, `${j.nombre} regala un punto de acción a ${o.nombre}.`);
      break;
    }
    case 'mover': {
      const { x, y } = accion;
      if (!dentroDelMapa(estado, x, y)) {
        throw errorJuego('ACCION_INVALIDA', 'Esa casilla está fuera del mapa.');
      }
      if (distancia(j, { x, y }) !== 1) {
        throw errorJuego('ACCION_INVALIDA', 'Solo puedes moverte a una casilla contigua.');
      }
      if (ocupada(estado, x, y)) {
        throw errorJuego('CASILLA_OCUPADA', 'No puedes moverte a una casilla ocupada por otro país.');
      }
      j.puntos -= CONFIG.COSTE_ACCION;
      j.x = x;
      j.y = y;
      registrar(estado, `${j.nombre} se mueve.`);
      break;
    }
    case 'expandir': {
      j.puntos -= CONFIG.COSTE_ACCION;
      j.radio += 1;
      registrar(estado, `${j.nombre} amplía su radio de acción a ${j.radio}.`);
      break;
    }
    default:
      throw errorJuego('ACCION_INVALIDA', 'Acción no reconocida.');
  }
  return estado;
}

function objetivoEnAlcance(estado, j, idObjetivo) {
  const o = buscarJugador(estado, idObjetivo);
  if (!o || o.id === j.id) {
    throw errorJuego('ACCION_INVALIDA', 'Elige otro país como objetivo.');
  }
  if (!o.vivo) {
    throw errorJuego('ACCION_INVALIDA', `${o.nombre} ya está eliminado.`);
  }
  if (distancia(j, o) > j.radio) {
    throw errorJuego('FUERA_DE_ALCANCE', `${o.nombre} está fuera de tu radio de acción.`);
  }
  return o;
}

// Termina la partida si el humano ha caído o solo queda un país en pie
export function comprobarFin(estado) {
  const enPie = vivos(estado);
  const humano = estado.jugadores.find(j => j.humano);
  if (enPie.length <= 1 || !humano.vivo) {
    estado.estado = 'terminada';
    estado.ganador = enPie.length === 1 ? enPie[0].id : null;
    estado.resultado = humano.vivo ? 'victoria' : 'derrota';
    const ganador = estado.ganador ? buscarJugador(estado, estado.ganador).nombre : null;
    registrar(estado, humano.vivo
      ? `¡${humano.nombre} gana la partida!`
      : `${humano.nombre} ha caído. ${ganador ? `Gana ${ganador}.` : 'La partida ha terminado.'}`);
  }
}

/**
 * Avanza el reloj de la partida msAvance milisegundos, procesando en orden los finales de ronda,
 * las recargas de puntos y las jugadas de las IAs. decidirIA(estado, jugador, rng) devuelve una acción o null.
 */
export function avanzarTiempo(estado, msAvance, decidirIA, rng = Math.random) {
  if (estado.estado !== 'en_curso' || msAvance <= 0) return estado;
  const objetivo = estado.tiempoMs + msAvance;

  while (estado.estado === 'en_curso') {
    const finRonda = estado.ronda * CONFIG.DURACION_RONDA_MS;
    const proximaIA = estado.jugadores
      .filter(j => !j.humano && j.vivo && j.proximaAccionMs !== null)
      .sort((a, b) => a.proximaAccionMs - b.proximaAccionMs)[0];

    if (proximaIA && proximaIA.proximaAccionMs < finRonda && proximaIA.proximaAccionMs <= objetivo) {
      estado.tiempoMs = proximaIA.proximaAccionMs;
      jugarIA(estado, proximaIA, decidirIA, rng);
      proximaIA.proximaAccionMs = planificarIA(finRonda, rng);
    } else if (finRonda <= objetivo) {
      estado.tiempoMs = finRonda;
      terminarRonda(estado);
    } else {
      estado.tiempoMs = objetivo;
      break;
    }
  }
  return estado;
}

function jugarIA(estado, ia, decidirIA, rng) {
  const accion = decidirIA(estado, ia, rng);
  if (!accion) return;
  try {
    aplicarAccion(estado, ia.id, accion);
  } catch {
    // Una IA que propone algo no válido simplemente pierde su jugada
  }
}

function terminarRonda(estado) {
  estado.ronda += 1;
  if ((estado.ronda - 1) % CONFIG.RONDAS_POR_RECARGA === 0) {
    for (const j of vivos(estado)) {
      j.puntos = Math.min(CONFIG.TOPE_PUNTOS, j.puntos + CONFIG.PUNTOS_RECARGA);
    }
    registrar(estado, `Recarga: todos los países reciben +${CONFIG.PUNTOS_RECARGA} puntos (máximo ${CONFIG.TOPE_PUNTOS}).`);
  }
}

// Información de tiempo para la interfaz
export function relojes(estado) {
  const ronda = CONFIG.DURACION_RONDA_MS;
  const recarga = ronda * CONFIG.RONDAS_POR_RECARGA;
  return {
    msRestantesRonda: estado.ronda * ronda - estado.tiempoMs,
    msHastaRecarga: (Math.floor(estado.tiempoMs / recarga) + 1) * recarga - estado.tiempoMs,
  };
}
