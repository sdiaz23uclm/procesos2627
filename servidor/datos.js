export class DatosEnMemoria {
  constructor() {
    this.usuarios = [];
  }

  guardar(usuario) {
    this.usuarios.push(usuario);
    return usuario;
  }

  obtenerPorEmail(email) {
    return this.usuarios.find((u) => u.email === email);
  }

  obtenerTodos() {
    return this.usuarios;
  }

  eliminar(email) {
    const index = this.usuarios.findIndex((u) => u.email === email);
    if (index !== -1) {
      this.usuarios.splice(index, 1);
      return true;
    }
    return false;
  }
}