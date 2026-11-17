import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

// Validez del enlace de confirmación de cuenta (RF-02)
export const VALIDEZ_TOKEN_MS = 24 * 60 * 60 * 1000;

// Error de negocio con un código estable que la capa API puede traducir a HTTP
function errorNegocio(codigo, mensaje) {
  const err = new Error(mensaje);
  err.codigo = codigo;
  return err;
}

// Solo se guarda el hash del token: si alguien lee la BD no puede confirmar cuentas ajenas
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function normalizarEmail(email) {
  if (typeof email !== 'string') {
    throw new Error('EMAIL_INVALIDO');
  }

  const emailNormalizado = email.trim().toLowerCase();
  const partes = emailNormalizado.split('@');
  if (
    partes.length !== 2 ||
    partes[0].length === 0 ||
    /\s/.test(emailNormalizado) ||
    !partes[1].includes('.') ||
    partes[1].startsWith('.') ||
    partes[1].endsWith('.')
  ) {
    throw new Error('EMAIL_INVALIDO');
  }

  return emailNormalizado;
}

export class LogicaUsuarios {
  /**
   * @param dao            capa de acceso a datos
   * @param servicioCorreo objeto con enviarConfirmacion(email, token); se inyecta desde api.js
   * @param opciones.reloj función que devuelve la hora actual en ms (inyectable para pruebas)
   */
  constructor(dao, servicioCorreo, { reloj = () => Date.now() } = {}) {
    if (!servicioCorreo) {
      throw new Error('LogicaUsuarios necesita un servicio de correo');
    }
    this.dao = dao;
    this.correo = servicioCorreo;
    this.reloj = reloj;
  }

  // Genera un token nuevo y devuelve { token, campos } con lo que hay que guardar en BD
  generarTokenConfirmacion() {
    const token = crypto.randomBytes(32).toString('hex');
    return {
      token,
      campos: {
        tokenConfirmacionHash: hashToken(token),
        tokenConfirmacionExpira: this.reloj() + VALIDEZ_TOKEN_MS,
      },
    };
  }

  async registrarUsuario(email, password, rolParam = "usuario") {
    const emailNormalizado = normalizarEmail(email);
    if (!password) {
      throw new Error("Email y contraseña requeridos");
    }

    const existente = await this.dao.obtenerPorEmail(emailNormalizado);
    if (existente) {
      throw new Error("El usuario ya existe");
    }

    // Hash seguro de la contraseña (exigencia del apartado 5)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Si coincide con el email de administración configurado por variable de entorno, es admin
    const adminEmailConfig = process.env.ADMIN_EMAIL;
    const rol = (adminEmailConfig && emailNormalizado === adminEmailConfig.trim().toLowerCase()) ? "admin" : rolParam;

    const { token, campos } = this.generarTokenConfirmacion();
    const usuario = {
      email: emailNormalizado,
      passwordHash,
      rol,
      estado: "pendiente", // Pendiente hasta que abra el enlace del correo (RF-02)
      ...campos,
    };

    const guardado = await this.dao.guardar(usuario);

    try {
      await this.correo.enviarConfirmacion(emailNormalizado, token);
    } catch (err) {
      // Si no se puede enviar el correo, la cuenta no podría confirmarse nunca: se deshace el alta
      await this.dao.eliminar(emailNormalizado);
      console.log(`[LOG] Registro deshecho, fallo al enviar el correo a ${emailNormalizado}: ${err.message}`);
      throw errorNegocio('CORREO_NO_ENVIADO', 'No se pudo enviar el correo de confirmación. Inténtalo de nuevo más tarde.');
    }

    console.log(`[LOG] Usuario registrado con éxito: ${emailNormalizado} con rol [${rol}], correo de confirmación enviado`);
    return guardado;
  }

  async confirmarCuenta(token) {
    if (typeof token !== 'string' || token.length === 0) {
      throw errorNegocio('TOKEN_INVALIDO', 'El enlace de confirmación no es válido.');
    }

    const usuario = await this.dao.obtenerPorTokenConfirmacion(hashToken(token));
    if (!usuario) {
      console.log('[LOG] Intento de confirmación con un token inexistente');
      throw errorNegocio('TOKEN_INVALIDO', 'El enlace de confirmación no es válido.');
    }
    if (usuario.tokenConfirmacionExpira < this.reloj()) {
      console.log(`[LOG] Enlace de confirmación caducado para: ${usuario.email}`);
      throw errorNegocio('TOKEN_CADUCADO', 'El enlace de confirmación ha caducado. Solicita uno nuevo.');
    }

    await this.dao.actualizar(usuario.email, {
      estado: 'confirmado',
      tokenConfirmacionHash: null,
      tokenConfirmacionExpira: null,
    });
    console.log(`[LOG] Cuenta confirmada: ${usuario.email}`);
    return { email: usuario.email };
  }

  // Envía un enlace nuevo si la cuenta existe y sigue pendiente. No revela si el email existe.
  async reenviarConfirmacion(email) {
    const emailNormalizado = normalizarEmail(email);
    const usuario = await this.dao.obtenerPorEmail(emailNormalizado);
    if (!usuario || usuario.estado !== 'pendiente') {
      console.log(`[LOG] Reenvío de confirmación ignorado para: ${emailNormalizado}`);
      return;
    }

    const { token, campos } = this.generarTokenConfirmacion();
    await this.dao.actualizar(emailNormalizado, campos);
    try {
      await this.correo.enviarConfirmacion(emailNormalizado, token);
    } catch (err) {
      console.log(`[LOG] Fallo al reenviar el correo a ${emailNormalizado}: ${err.message}`);
      throw errorNegocio('CORREO_NO_ENVIADO', 'No se pudo enviar el correo de confirmación. Inténtalo de nuevo más tarde.');
    }
    console.log(`[LOG] Correo de confirmación reenviado a: ${emailNormalizado}`);
  }

  async loginUsuario(email, password) {
    const emailNormalizado = normalizarEmail(email);
    const usuario = await this.dao.obtenerPorEmail(emailNormalizado);
    
    if (!usuario) {
      console.log(`[LOG] Intento de login fallido - Usuario no encontrado: ${emailNormalizado}`);
      throw new Error("Credenciales inválidas");
    }
    if (usuario.estado === 'pendiente') {
      console.log(`[LOG] Intento de login fallido - email no verificado: ${emailNormalizado}`);
      throw errorNegocio('CUENTA_PENDIENTE', 'La cuenta está pendiente de confirmación. Revisa tu correo.');
    }
    
    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) {
      console.log(`[LOG] Intento de login fallido - Contraseña incorrecta para: ${emailNormalizado}`);
      throw new Error("Credenciales inválidas");
    }

    console.log(`[LOG] Login exitoso: ${emailNormalizado}`);
    return usuario;
  }

  async listarUsuarios(usuarioActual) {
    if (!usuarioActual || usuarioActual.rol !== 'admin') {
      console.log(`[LOG] Acceso denegado a listado de usuarios para: ${usuarioActual?.email || 'anónimo'}`);
      throw new Error("Acceso denegado: Se requiere rol de administrador");
    }
    console.log(`[LOG] El administrador ${usuarioActual.email} ha listado los usuarios.`);
    return await this.dao.obtenerTodos();
  }

  async comprobarActivo(email) {
    const emailNormalizado = normalizarEmail(email);
    const u = await this.dao.obtenerPorEmail(emailNormalizado);
    if (!u) return false;
    return u.estado === "confirmado" || u.estado === "oauth";
  }

  async eliminarUsuario(emailSolicitante, emailTarget) {
    const solicitanteNormalizado = normalizarEmail(emailSolicitante);
    const emailTargetNormalizado = normalizarEmail(emailTarget);
    const solicitante = await this.dao.obtenerPorEmail(solicitanteNormalizado);
    if (!solicitante) {
      throw new Error("Usuario solicitante no válido");
    }

    const esAdmin = solicitante.rol === 'admin';

    if (!esAdmin && solicitanteNormalizado !== emailTargetNormalizado) {
      console.log(`[LOG] El usuario ${solicitanteNormalizado} intentó eliminar a ${emailTargetNormalizado} sin permisos.`);
      throw new Error("No tienes permisos para eliminar este usuario");
    }

    const eliminado = await this.dao.eliminar(emailTargetNormalizado);
    if (eliminado) {
      console.log(`[LOG] Usuario eliminado: ${emailTargetNormalizado} (por acción de ${solicitanteNormalizado})`);
    }
    return eliminado;
  }
}