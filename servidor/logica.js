export class LogicaUsuarios {
  constructor(dao) {
    this.dao = dao;
  }

  registrarUsuario(email, password, rol = "usuario") {
    if (!email || !password) {
      throw new Error("Email y contraseña requeridos");
    }
    if (this.dao.obtenerPorEmail(email)) {
      throw new Error("El usuario ya existe");
    }

    const usuario = {
      email,
      password, // En el Hito 2 aplicaremos hash
      rol,
      estado: "pendiente", // Confirmación por correo pendiente
    };

    return this.dao.guardar(usuario);
  }

  listarUsuarios() {
    return this.dao.obtenerTodos();
  }

  comprobarActivo(email) {
    const u = this.dao.obtenerPorEmail(email);
    if (!u) return false;
    return u.estado === "confirmado" || u.estado === "oauth";
  }

  eliminarUsuario(emailSolicitante, emailTarget, esAdmin = false) {
    if (!esAdmin && emailSolicitante !== emailTarget) {
      throw new Error("No tienes permisos para eliminar este usuario");
    }
    return this.dao.eliminar(emailTarget);
  }
}