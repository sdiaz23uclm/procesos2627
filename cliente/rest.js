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

  async comprobarSesion() {
    const respuesta = await fetch('/api/sesion');
    if (!respuesta.ok) return null;
    return await respuesta.json();
  },

  async logout() {
    const respuesta = await fetch('/api/logout', { method: 'POST' });
    return respuesta.ok;
  }
};