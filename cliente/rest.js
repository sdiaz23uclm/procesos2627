const RestClient = {
  async registrar(email, password) {
    const respuesta = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'Error en el registro');
    }
    return datos;
  },

  async login(email, password) {
    const respuesta = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!respuesta.ok) {
      const error = await respuesta.json();
      const err = new Error(error.mensaje || 'Error en el inicio de sesión');
      err.codigo = error.codigo;
      throw err;
    }
    return await respuesta.json();
  },

  async reenviarConfirmacion(email) {
    const respuesta = await fetch('/api/reenviar-confirmacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'No se pudo reenviar el correo');
    }
    return datos;
  },

  // El login con Google es una navegación completa (no fetch): Google tiene que mostrar su página
  iniciarLoginGoogle() {
    window.location.href = '/api/auth/google';
  },

  async comprobarSesion() {
    const respuesta = await fetch('/api/sesion');
    if (!respuesta.ok) return null;
    return await respuesta.json();
  },

  // --- Administración (el servidor comprueba el rol; aquí solo se hace la petición) ---

  async listarUsuarios() {
    return await this._pedir('/api/usuarios', {}, 'No se pudo obtener el listado de usuarios');
  },

  async consultarActivo(email) {
    return await this._pedir(`/api/usuarios/activo?email=${encodeURIComponent(email)}`, {}, 'No se pudo consultar el usuario');
  },

  async eliminarUsuario(emailTarget) {
    return await this._pedir('/api/eliminar', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailTarget })
    }, 'No se pudo eliminar el usuario');
  },

  // Petición genérica: devuelve el JSON o lanza un Error con el mensaje del servidor
  async _pedir(url, opciones, mensajePorDefecto) {
    let respuesta;
    try {
      respuesta = await fetch(url, opciones);
    } catch {
      throw new Error('No hay conexión con el servidor. Comprueba tu conexión a internet.');
    }
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      const err = new Error(datos.mensaje || mensajePorDefecto);
      err.codigo = datos.codigo;
      err.estado = respuesta.status;
      throw err;
    }
    return datos;
  },

  async logout() {
    const respuesta = await fetch('/api/logout', { method: 'POST' });
    return respuesta.ok;
  }
};