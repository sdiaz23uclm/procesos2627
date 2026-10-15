import bcrypt from 'bcryptjs';

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
  constructor(dao) {
    this.dao = dao;
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

    const usuario = {
      email: emailNormalizado,
      passwordHash,
      rol,
      estado: "pendiente", // Pendiente de confirmar por correo (Hito 4)
    };

    const guardado = await this.dao.guardar(usuario);
    console.log(`[LOG] Usuario registrado con éxito: ${emailNormalizado} con rol [${rol}]`);
    return guardado;
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
      throw new Error('La cuenta está pendiente de confirmación.');
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