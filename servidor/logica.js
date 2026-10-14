import bcrypt from 'bcryptjs';

export class LogicaUsuarios {
  constructor(dao) {
    this.dao = dao;
  }

  async registrarUsuario(email, password, rolParam = "usuario") {
    if (!email || !password) {
      throw new Error("Email y contraseña requeridos");
    }

    const existente = await this.dao.obtenerPorEmail(email);
    if (existente) {
      throw new Error("El usuario ya existe");
    }

    // Hash seguro de la contraseña (exigencia del apartado 5)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Si coincide con el email de administración configurado por variable de entorno, es admin
    const adminEmailConfig = process.env.ADMIN_EMAIL;
    const rol = (adminEmailConfig && email === adminEmailConfig) ? "admin" : rolParam;

    const usuario = {
      email,
      passwordHash,
      rol,
      estado: "pendiente", // Pendiente de confirmar por correo (Hito 4)
    };

    const guardado = await this.dao.guardar(usuario);
    console.log(`[LOG] Usuario registrado con éxito: ${email} con rol [${rol}]`);
    return guardado;
  }

  async loginUsuario(email, password) {
    const usuario = await this.dao.obtenerPorEmail(email);
    
    if (!usuario) {
      console.log(`[LOG] Intento de login fallido - Usuario no encontrado: ${email}`);
      throw new Error("Credenciales inválidas");
    }
    if (usuario.estado === 'pendiente') {
      console.log(`[LOG] Intento de login fallido - email no verificado: ${email}`);
      throw new Error('La cuenta está pendiente de confirmación.');
    }
    
    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) {
      console.log(`[LOG] Intento de login fallido - Contraseña incorrecta para: ${email}`);
      throw new Error("Credenciales inválidas");
    }

    console.log(`[LOG] Login exitoso: ${email}`);
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
    const u = await this.dao.obtenerPorEmail(email);
    if (!u) return false;
    return u.estado === "confirmado" || u.estado === "oauth";
  }

  async eliminarUsuario(emailSolicitante, emailTarget) {
    const solicitante = await this.dao.obtenerPorEmail(emailSolicitante);
    if (!solicitante) {
      throw new Error("Usuario solicitante no válido");
    }

    const esAdmin = solicitante.rol === 'admin';

    if (!esAdmin && emailSolicitante !== emailTarget) {
      console.log(`[LOG] El usuario ${emailSolicitante} intentó eliminar a ${emailTarget} sin permisos.`);
      throw new Error("No tienes permisos para eliminar este usuario");
    }

    const eliminado = await this.dao.eliminar(emailTarget);
    if (eliminado) {
      console.log(`[LOG] Usuario eliminado: ${emailTarget} (por acción de ${emailSolicitante})`);
    }
    return eliminado;
  }
}