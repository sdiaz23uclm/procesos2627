import bcrypt from 'bcryptjs';

export class LogicaUsuarios {
  constructor(dao) {
    this.dao = dao;
  }

  async registrarUsuario(email, password, rol = "usuario") {
    if (!email || !password) {
      throw new Error("Email y contraseña requeridos");
    }
    if (this.dao.obtenerPorEmail(email)) {
      throw new Error("El usuario ya existe");
    }

    // Hash seguro de la contraseña (exigencia del apartado 5)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const usuario = {
      email,
      passwordHash,
      rol,
      estado: "pendiente", // Pendiente de confirmar por correo (Hito 4)
    };

    return this.dao.guardar(usuario);
  }

  async loginUsuario(email, password) {
    const usuario = this.dao.obtenerPorEmail(email);
    if (!usuario) {
      throw new Error("Credenciales inválidas");
    }

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) {
      throw new Error("Credenciales inválidas");
    }

    // En el Hito 1/2 inicial, si es local permitimos entrar aunque esté pendiente 
    // (o puedes restringirlo si prefieres, pero Oauth/correo se afina en Hito 4).
    return usuario;
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