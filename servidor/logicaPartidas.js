// Lógica de partidas de Alianzas: une las reglas del juego con la persistencia (D-20, D-21).
// No conoce HTTP: recibe el email del usuario autenticado y devuelve una vista de la partida.
import { CONFIG, PAISES, crearEstado, aplicarAccion, avanzarTiempo, relojes, buscarJugador, errorJuego } from './juego/reglas.js';
import { decidir } from './juego/ia.js';

// Máximo de tiempo de juego que avanza una sola petición: si nadie consulta, la partida se queda en pausa
export const MAX_AVANCE_MS = 3000;
const MAX_REINTENTOS = 5;

export class LogicaPartidas {
  /**
   * @param dao  objeto con obtenerPartida(email), crearPartida(doc), actualizarPartida(doc, versionAnterior), eliminarPartida(email)
   * @param opciones.reloj  hora actual en ms (inyectable para pruebas)
   * @param opciones.rng    generador de azar en [0, 1) (inyectable para pruebas)
   */
  constructor(dao, { reloj = () => Date.now(), rng = Math.random } = {}) {
    this.dao = dao;
    this.reloj = reloj;
    this.rng = rng;
  }

  listarPaises() {
    return PAISES.map(p => ({ ...p }));
  }

  async nuevaPartida(email, paisId) {
    const estado = crearEstado(paisId, this.rng);
    const ahora = this.reloj();
    const doc = {
      email,
      version: 1,
      estado,
      pausada: false,
      ultimaActualizacion: ahora,
      guardadaEn: null,
      autoguardadoRonda: estado.ronda,
      creadaEn: new Date(ahora),
    };
    await this.dao.crearPartida(doc);
    console.log(`[LOG] Nueva partida de Alianzas para ${email} con ${estado.jugadores[0].nombre}`);
    return this.vista(doc);
  }

  // Devuelve la partida del usuario tras avanzar su reloj; null si no tiene ninguna
  async consultar(email) {
    const doc = await this.dao.obtenerPartida(email);
    if (!doc) return null;
    return this.vista(await this.modificar(email, () => {}));
  }

  async actuar(email, accion) {
    const doc = await this.modificar(email, d => {
      if (d.pausada) {
        throw errorJuego('PARTIDA_PAUSADA', 'La partida está en pausa. Pulsa «Reanudar» para seguir.');
      }
      const humano = d.estado.jugadores.find(j => j.humano);
      aplicarAccion(d.estado, humano.id, limpiarAccion(accion));
    });
    return this.vista(doc);
  }

  // Botón «Guardar» (D-19): guarda y deja la partida en pausa
  async guardar(email) {
    const doc = await this.modificar(email, d => {
      d.pausada = true;
      d.guardadaEn = new Date(this.reloj());
    });
    console.log(`[LOG] ${email} guardó su partida de Alianzas (ronda ${doc.estado.ronda})`);
    return this.vista(doc);
  }

  async reanudar(email) {
    const doc = await this.modificar(email, d => {
      d.pausada = false;
    });
    return this.vista(doc);
  }

  async eliminarPartidaDe(email) {
    await this.dao.eliminarPartida(email);
  }

  /**
   * Carga la partida, avanza su reloj, aplica el cambio y la guarda solo si nadie la modificó
   * entretanto (control optimista por versión). Si hubo conflicto, vuelve a intentarlo.
   */
  async modificar(email, cambio) {
    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
      const doc = await this.dao.obtenerPartida(email);
      if (!doc) {
        throw errorJuego('PARTIDA_NO_ENCONTRADA', 'No tienes ninguna partida. Empieza una nueva.');
      }
      const versionAnterior = doc.version;
      const estabaEnCurso = doc.estado.estado === 'en_curso';
      this.avanzar(doc);
      cambio(doc);
      if (estabaEnCurso && doc.estado.estado === 'terminada') {
        console.log(`[LOG] Partida de ${email} terminada: ${doc.estado.resultado}`);
      }
      doc.version = versionAnterior + 1;
      if (await this.dao.actualizarPartida(doc, versionAnterior)) {
        return doc;
      }
    }
    throw new Error('La partida está muy ocupada; vuelve a intentarlo.');
  }

  avanzar(doc) {
    const ahora = this.reloj();
    const transcurrido = Math.max(0, ahora - doc.ultimaActualizacion);
    doc.ultimaActualizacion = ahora;
    if (doc.pausada || doc.estado.estado !== 'en_curso') return;

    const rondaAntes = doc.estado.ronda;
    avanzarTiempo(doc.estado, Math.min(transcurrido, MAX_AVANCE_MS), decidir, this.rng);
    if (doc.estado.ronda !== rondaAntes) {
      doc.autoguardadoRonda = doc.estado.ronda; // autoguardado al final de cada ronda (D-19)
    }
  }

  // Lo que ve el cliente: sin la memoria interna de las IAs ni datos de otros usuarios
  vista(doc) {
    const e = doc.estado;
    const humano = e.jugadores.find(j => j.humano);
    return {
      tam: e.tam,
      ronda: e.ronda,
      estado: e.estado,
      resultado: e.resultado,
      ganador: e.ganador ? buscarJugador(e, e.ganador).nombre : null,
      pausada: doc.pausada,
      guardadaEn: doc.guardadaEn,
      autoguardadoRonda: doc.autoguardadoRonda,
      tuPais: humano.id,
      ...relojes(e),
      duracionRondaMs: CONFIG.DURACION_RONDA_MS,
      topePuntos: CONFIG.TOPE_PUNTOS,
      jugadores: e.jugadores.map(j => ({
        id: j.id,
        nombre: j.nombre,
        humano: j.humano,
        personalidad: j.personalidad,
        x: j.x,
        y: j.y,
        vidas: j.vidas,
        puntos: j.puntos,
        radio: j.radio,
        vivo: j.vivo,
      })),
      eventos: [...e.eventos].reverse(),
    };
  }
}

// Solo se aceptan los campos conocidos de una acción
function limpiarAccion(accion) {
  if (!accion || typeof accion !== 'object') return null;
  const { tipo, objetivo, x, y } = accion;
  return { tipo, objetivo, x, y };
}
