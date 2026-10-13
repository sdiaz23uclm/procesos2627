const RestClient = {
  async registrar(email, password) {
    const respuesta = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!respuesta.ok) {
      const error = await respuesta.json();
      throw new Error(error.mensaje || 'Error en el registro');
    }
    return await respuesta.json();
  },

  async login(email, password) {
    const respuesta = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!respuesta.ok) {
      const error = await respuesta.json();
      throw new Error(error.mensaje || 'Error en el inicio de sesión');
    }
    return await respuesta.json();
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