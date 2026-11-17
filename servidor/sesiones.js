// Gestión de sesiones (D-13). Pertenece a la capa API: traduce la cookie sessionId en un email.
// El almacenamiento lo hace la capa de datos (crearSesion, obtenerSesion, eliminarSesion, eliminarSesionesDe).
import crypto from 'node:crypto';

export const DURACION_SESION_MS = 7 * 24 * 60 * 60 * 1000;

// En BD solo se guarda el hash del identificador: quien lea la BD no puede suplantar sesiones
function hashId(id) {
  return crypto.createHash('sha256').update(id).digest('hex');
}

export class GestorSesiones {
  constructor(almacen, { reloj = () => Date.now() } = {}) {
    this.almacen = almacen;
    this.reloj = reloj;
  }

  // Crea la sesión y devuelve el identificador que irá en la cookie
  async crear(email) {
    const id = crypto.randomBytes(32).toString('hex');
    await this.almacen.crearSesion(hashId(id), email, new Date(this.reloj() + DURACION_SESION_MS));
    return id;
  }

  async obtenerEmail(id) {
    if (!id) return null;
    const sesion = await this.almacen.obtenerSesion(hashId(id));
    return sesion ? sesion.email : null;
  }

  async cerrar(id) {
    if (id) await this.almacen.eliminarSesion(hashId(id));
  }

  // Al eliminar una cuenta se cierran todas sus sesiones abiertas
  async cerrarTodasDe(email) {
    await this.almacen.eliminarSesionesDe(email);
  }
}
