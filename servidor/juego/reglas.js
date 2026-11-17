// Reglas de Alianzas (capa de lógica). Funciones puras sobre un objeto de estado:
// no conocen HTTP, MongoDB ni el reloj real. El tiempo y el azar se reciben como parámetros.

export const CONFIG = Object.freeze({
  TAM: 12,                     // mapa de 12 x 12 (D-16)
  DURACION_CICLO_MS: 30_000,   // cada ronda dura 30 s y empieza con una recarga (D-22)
  DURACION_TURNO_MS: 10_000,   // solo se puede actuar en los primeros 10 s de cada ronda (D-22)
  PUNTOS_INICIALES: 2,
  PUNTOS_RECARGA: 2,
  TOPE_PUNTOS: 6,
  VIDAS: 3,
  RADIO_INICIAL: 3,
  ANCHO_BRAZOS: 3,             // el radio crece en cruz con brazos de 7 casillas de ancho (D-23)
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

// Distancia en casillas contando diagonales: se usa para el movimiento (8 direcciones)
export function distancia(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

// Zona de acción en cruz (D-23): cuadrado inicial de 7 x 7 cuyos brazos se alargan al ampliar el radio
export function enRadio(j, casilla) {
  const dx = Math.abs(j.x - casilla.x);
  const dy = Math.abs(j.y - casilla.y);
  return Math.max(dx, dy) <= j.radio && Math.min(dx, dy) <= CONFIG.ANCHO_BRAZOS;
}

// ¿Está abierto el turno de 10 s de la ronda actual? (D-22)
export function turnoAbierto(estado) {
  return estado.tiempoMs - inicioRonda(estado) < CONFIG.DURACION_TURNO_MS;
}

function inicioRonda(estado) {
  return (estado.ronda - 1) * CONFIG.DURACION_CICLO_MS;
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
  return estado.jugadores.filter(o => o.id !== j.id && o.vivo && enRadio(j, o));
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

// Momento (en tiempo de juego) en que una IA actuará dentro del turno de la ronda que empieza en inicioRondaMs
function planificarIA(inicioRondaMs, rng) {
  return inicioRondaMs + 1500 + Math.floor(rng() * 7000);
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
    actuoEnRonda: false,
    regalosRecibidos: {},   // regalos pendientes de devolver (los usa la IA diplomática)
    aliados: {},            // países que me han regalado puntos alguna vez
    ataquesRecibidos: {},
    proximaAccionMs: i === 0 ? null : planificarIA(0, rng),
  }));

  const estado = {
    tam: t,
    ronda: 1,
    tiempoMs: 0,
    turnoCerrado: false,
    estado: 'en_curso',
    resultado: null,
    ganador: null,
    jugadores,
    eventos: [],
  };
  registrar(estado, `Comienza la partida. Juegas con ${humano.nombre}. ¡Tu primer turno está abierto!`);
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
  if (!turnoAbierto(estado)) {
    throw errorJuego('FUERA_DE_TURNO', 'Tu turno ha terminado. Espera a la próxima recarga para volver a actuar.');
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
  j.actuoEnRonda = true;
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
  if (!enRadio(j, o)) {
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
 * Avanza el reloj de la partida msAvance milisegundos procesando en orden: las jugadas de las IAs
 * (dentro del turno), el cierre del turno a los 10 s y el comienzo de cada ronda con su recarga (D-22).
 * decidirIA(estado, jugador, rng) devuelve una acción o null.
 */
export function avanzarTiempo(estado, msAvance, decidirIA, rng = Math.random) {
  if (estado.estado !== 'en_curso' || msAvance <= 0) return estado;
  const objetivo = estado.tiempoMs + msAvance;

  while (estado.estado === 'en_curso') {
    const inicio = inicioRonda(estado);
    const finTurno = inicio + CONFIG.DURACION_TURNO_MS;
    const finRonda = inicio + CONFIG.DURACION_CICLO_MS;
    const proximaIA = estado.jugadores
      .filter(j => !j.humano && j.vivo && j.proximaAccionMs !== null)
      .sort((a, b) => a.proximaAccionMs - b.proximaAccionMs)[0];

    if (proximaIA && proximaIA.proximaAccionMs < finTurno && proximaIA.proximaAccionMs <= objetivo) {
      estado.tiempoMs = Math.max(estado.tiempoMs, proximaIA.proximaAccionMs);
      jugarIA(estado, proximaIA, decidirIA, rng);
      proximaIA.proximaAccionMs = planificarIA(finRonda, rng);
    } else if (!estado.turnoCerrado && finTurno <= objetivo) {
      estado.tiempoMs = finTurno;
      cerrarTurno(estado);
    } else if (finRonda <= objetivo) {
      estado.tiempoMs = finRonda;
      empezarRonda(estado);
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

function cerrarTurno(estado) {
  estado.turnoCerrado = true;
  const humano = estado.jugadores.find(j => j.humano);
  if (humano.vivo && !humano.actuoEnRonda) {
    registrar(estado, `${humano.nombre} no actuó a tiempo y pierde este turno.`);
  }
}

function empezarRonda(estado) {
  estado.ronda += 1;
  estado.turnoCerrado = false;
  for (const j of vivos(estado)) {
    j.puntos = Math.min(CONFIG.TOPE_PUNTOS, j.puntos + CONFIG.PUNTOS_RECARGA);
    j.actuoEnRonda = false;
  }
  registrar(estado, `Ronda ${estado.ronda}: +${CONFIG.PUNTOS_RECARGA} puntos para todos (máximo ${CONFIG.TOPE_PUNTOS}). Turno abierto 10 s.`);
}

// Información de tiempo para la interfaz
export function relojes(estado) {
  const transcurrido = estado.tiempoMs - inicioRonda(estado);
  const abierto = transcurrido < CONFIG.DURACION_TURNO_MS;
  return {
    fase: abierto ? 'turno' : 'espera',
    msRestantesTurno: abierto ? CONFIG.DURACION_TURNO_MS - transcurrido : 0,
    msHastaRecarga: CONFIG.DURACION_CICLO_MS - transcurrido,
  };
}
