import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { BaseDatosMongoDB } from './datos.js';
import { LogicaUsuarios, normalizarEmail } from './logica.js';
import { ServicioCorreoBrevo } from './correo.js';
import { ClienteOAuthGoogle } from './oauth.js';
import { GestorSesiones, DURACION_SESION_MS } from './sesiones.js';

// Cargar variables de entorno del archivo .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Composición: aquí se crean los servicios externos y se inyectan en la lógica
const dao = new BaseDatosMongoDB();
const servicioCorreo = new ServicioCorreoBrevo({
  apiKey: process.env.BREVO_API_KEY,
  remitente: process.env.MAIL_FROM,
  urlApp: process.env.APP_URL,
});
const logica = new LogicaUsuarios(dao, servicioCorreo);
const clienteOAuth = new ClienteOAuthGoogle({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  urlApp: process.env.APP_URL,
});
// En producción (https) las cookies llevan Secure; en localhost (http) no podrían enviarse
const COOKIE_SECURE = (process.env.APP_URL || '').startsWith('https://') ? '; Secure' : '';
const PORT = process.env.PORT || 8080;

// Sesiones persistidas en MongoDB (D-13): sobreviven a reinicios y a varias instancias
const sesiones = new GestorSesiones(dao);

function parsearCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  rc && rc.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

// Crea una sesión para el usuario y devuelve la cabecera Set-Cookie
async function crearSesion(email) {
  const sessionId = await sesiones.crear(email);
  const maxAge = Math.floor(DURACION_SESION_MS / 1000);
  return `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${COOKIE_SECURE}`;
}

// Código HTTP para cada error de negocio
const ESTADO_HTTP = {
  NO_AUTENTICADO: 401,
  SIN_PERMISOS: 403,
  USUARIO_NO_ENCONTRADO: 404,
  CORREO_NO_ENVIADO: 502,
};

function responderError(res, err, estadoPorDefecto = 400) {
  res.writeHead(ESTADO_HTTP[err.codigo] || estadoPorDefecto);
  res.end(JSON.stringify({ mensaje: mensajeError(err), codigo: err.codigo }));
}

// Traduce errores internos a mensajes comprensibles para el usuario
function mensajeError(err) {
  if (err instanceof SyntaxError) return 'La petición no tiene un formato válido.';
  if (err.message === 'EMAIL_INVALIDO') return 'El email no es válido.';
  return err.message;
}

// Función auxiliar para verificar si la petición tiene una sesión válida
async function verificarSesionValida(req) {
  const cookies = parsearCookies(req);
  const sessionId = cookies.sessionId;
  if (!sessionId) return null;
  
  const email = await sesiones.obtenerEmail(sessionId);
  if (!email) return null;

  return await dao.obtenerPorEmail(email);
}

const server = http.createServer(async (req, res) => {
  try {
    await atenderPeticion(req, res);
  } catch (err) {
    // Cualquier fallo inesperado (p. ej. la BD no responde) devuelve 500 en lugar de tumbar el servidor
    console.error(`[ERROR] ${req.method} ${req.url}: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ mensaje: 'Error interno del servidor. Inténtalo de nuevo en unos minutos.' }));
  }
});

async function atenderPeticion(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // --- API ROUTES ---
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');

    // NORMALIZAR Y VALIDAR EMAIL
    if (pathname === '/api/prueba/email' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let datos;
        try {
          datos = JSON.parse(body);
        } catch (err) {
          if (!(err instanceof SyntaxError)) throw err;
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'EMAIL_INVALIDO' }));
          return;
        }

        let emailNormalizado;
        try {
          emailNormalizado = normalizarEmail(datos?.email);
        } catch (err) {
          if (!(err instanceof Error) || err.message !== 'EMAIL_INVALIDO') throw err;
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'EMAIL_INVALIDO' }));
          return;
        }

        res.writeHead(200);
        res.end(JSON.stringify({ email: emailNormalizado }));
      });
      return;
    }

    // REGISTRO
    if (pathname === '/api/registro' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { email, password } = JSON.parse(body);
          await logica.registrarUsuario(email, password);
          res.writeHead(201);
          res.end(JSON.stringify({ mensaje: 'Registro completado. Te hemos enviado un correo para confirmar la cuenta (revisa también la carpeta de spam).' }));
        } catch (err) {
          res.writeHead(err.codigo === 'CORREO_NO_ENVIADO' ? 502 : 400);
          res.end(JSON.stringify({ mensaje: mensajeError(err), codigo: err.codigo }));
        }
      });
      return;
    }

    // LOGIN
    if (pathname === '/api/login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { email, password } = JSON.parse(body);
          const usuario = await logica.loginUsuario(email, password);
          
          res.setHeader('Set-Cookie', await crearSesion(usuario.email));
          res.writeHead(200);
          res.end(JSON.stringify({ email: usuario.email, rol: usuario.rol }));
        } catch (err) {
          res.writeHead(401);
          res.end(JSON.stringify({ mensaje: mensajeError(err), codigo: err.codigo }));
        }
      });
      return;
    }

    // OAUTH GOOGLE: paso 1, redirigir a Google (RF-04)
    if (pathname === '/api/auth/google' && req.method === 'GET') {
      // state aleatorio guardado en cookie: protege el callback frente a CSRF
      const state = crypto.randomBytes(16).toString('hex');
      res.writeHead(302, {
        'Set-Cookie': `oauthState=${state}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=600${COOKIE_SECURE}`,
        Location: clienteOAuth.urlAutorizacion(state),
      });
      res.end();
      return;
    }

    // OAUTH GOOGLE: paso 2, Google vuelve aquí con ?code=...&state=...
    if (pathname === '/api/auth/google/callback' && req.method === 'GET') {
      const borrarState = `oauthState=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0${COOKIE_SECURE}`;
      const params = urlObj.searchParams;
      let destino;
      const cookies = [borrarState];
      try {
        if (params.get('error')) {
          console.log(`[LOG] Login con Google cancelado o rechazado por el usuario`);
          destino = '/?oauth=cancelado';
        } else {
          const stateCookie = parsearCookies(req).oauthState;
          if (!stateCookie || stateCookie !== params.get('state')) {
            throw new Error('Parámetro state de OAuth inválido');
          }
          const email = await clienteOAuth.obtenerEmail(params.get('code'));
          const usuario = await logica.loginOAuth(email);
          cookies.push(await crearSesion(usuario.email));
          destino = '/';
        }
      } catch (err) {
        console.log(`[LOG] Error en el login con Google: ${err.message}`);
        destino = '/?oauth=error';
      }
      res.writeHead(302, { 'Set-Cookie': cookies, Location: destino });
      res.end();
      return;
    }

    // CONFIRMAR CUENTA (enlace del correo, RF-02)
    if (pathname === '/api/confirmar' && req.method === 'GET') {
      let destino;
      try {
        await logica.confirmarCuenta(urlObj.searchParams.get('token'));
        destino = '/?confirmacion=ok';
      } catch (err) {
        const motivo = err.codigo === 'TOKEN_CADUCADO' ? 'caducado' : 'invalido';
        destino = `/?confirmacion=${motivo}`;
      }
      res.writeHead(302, { Location: destino });
      res.end();
      return;
    }

    // REENVIAR CORREO DE CONFIRMACIÓN
    if (pathname === '/api/reenviar-confirmacion' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { email } = JSON.parse(body);
          await logica.reenviarConfirmacion(email);
          res.writeHead(200);
          res.end(JSON.stringify({ mensaje: 'Si la cuenta existe y está pendiente, te hemos enviado un nuevo correo de confirmación.' }));
        } catch (err) {
          res.writeHead(err.codigo === 'CORREO_NO_ENVIADO' ? 502 : 400);
          res.end(JSON.stringify({ mensaje: mensajeError(err), codigo: err.codigo }));
        }
      });
      return;
    }

    // COMPROBAR SESIÓN
    if (pathname === '/api/sesion' && req.method === 'GET') {
      const usuario = await verificarSesionValida(req);
      if (usuario) {
        res.writeHead(200);
        res.end(JSON.stringify({ email: usuario.email, rol: usuario.rol }));
      } else {
        res.writeHead(401);
        res.end(JSON.stringify({ mensaje: 'No autorizado' }));
      }
      return;
    }

    // LISTAR USUARIOS (solo admin, RF-07). La lógica devuelve solo datos públicos.
    if (pathname === '/api/usuarios' && req.method === 'GET') {
      try {
        const usuarioActual = await verificarSesionValida(req);
        const lista = await logica.listarUsuarios(usuarioActual);
        res.writeHead(200);
        res.end(JSON.stringify(lista));
      } catch (err) {
        responderError(res, err, 403);
      }
      return;
    }

    // COMPROBAR SI UN USUARIO ESTÁ ACTIVO (solo admin, RF-08)
    if (pathname === '/api/usuarios/activo' && req.method === 'GET') {
      try {
        const usuarioActual = await verificarSesionValida(req);
        const resultado = await logica.consultarActivo(usuarioActual, urlObj.searchParams.get('email'));
        res.writeHead(200);
        res.end(JSON.stringify(resultado));
      } catch (err) {
        responderError(res, err);
      }
      return;
    }

    // ELIMINAR USUARIO (admin a cualquiera, usuario normal a sí mismo, RF-09; borrado lógico D-12)
    if (pathname === '/api/eliminar' && req.method === 'DELETE') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const usuarioActual = await verificarSesionValida(req);
          if (!usuarioActual) {
            res.writeHead(401);
            res.end(JSON.stringify({ mensaje: 'Tu sesión ha caducado. Inicia sesión de nuevo.' }));
            return;
          }
          const { emailTarget } = JSON.parse(body);
          await logica.eliminarUsuario(usuarioActual.email, emailTarget);
          const emailEliminado = normalizarEmail(emailTarget);
          await sesiones.cerrarTodasDe(emailEliminado);
          if (emailEliminado === usuarioActual.email) {
            res.setHeader('Set-Cookie', `sessionId=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${COOKIE_SECURE}`);
          }
          res.writeHead(200);
          res.end(JSON.stringify({ mensaje: 'Usuario eliminado correctamente' }));
        } catch (err) {
          responderError(res, err);
        }
      });
      return;
    }

    // LOGOUT
    if (pathname === '/api/logout' && req.method === 'POST') {
      const cookies = parsearCookies(req);
      await sesiones.cerrar(cookies.sessionId);
      res.setHeader('Set-Cookie', `sessionId=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${COOKIE_SECURE}`);
      res.writeHead(200);
      res.end(JSON.stringify({ mensaje: 'Sesión cerrada' }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ mensaje: 'Ruta API no encontrada' }));
    return;
  }

  // --- ARCHIVOS ESTÁTICOS DEL CLIENTE ---
  const dirCliente = path.join(__dirname, '../cliente');
  const filePath = path.join(dirCliente, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(dirCliente + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 Prohibido</h1>');
    return;
  }
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 No encontrado</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Error del servidor: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

server.listen(PORT,'0.0.0.0', () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});