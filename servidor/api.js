import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatosEnMemoria } from './datos.js';
import { LogicaUsuarios } from './logica.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dao = new DatosEnMemoria();
const logica = new LogicaUsuarios(dao);
const PORT = process.env.PORT || 3000;

// Almacenamiento simple de sesiones en memoria (para Hito 2)
const sesionesActivas = new Map(); // sessionId -> emailUsuario

function parsearCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  rc && rc.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // --- API ROUTES ---
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');

    // REGISTRO
    if (pathname === '/api/registro' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { email, password } = JSON.parse(body);
          await logica.registrarUsuario(email, password);
          res.writeHead(201);
          res.end(JSON.stringify({ mensaje: 'Usuario registrado con éxito' }));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ mensaje: err.message }));
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
          
          // Crear sesión
          const sessionId = Math.random().toString(36).substring(2);
          sesionesActivas.set(sessionId, usuario.email);

          res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly`);
          res.writeHead(200);
          res.end(JSON.stringify({ email: usuario.email, rol: usuario.rol }));
        } catch (err) {
          res.writeHead(401);
          res.end(JSON.stringify({ mensaje: err.message }));
        }
      });
      return;
    }

    // COMPROBAR SESIÓN (Mantenimiento entre recargas)
    if (pathname === '/api/sesion' && req.method === 'GET') {
      const cookies = parsearCookies(req);
      const sessionId = cookies.sessionId;
      const email = sessionId ? sesionesActivas.get(sessionId) : null;

      if (email) {
        const usuario = dao.obtenerPorEmail(email);
        res.writeHead(200);
        res.end(JSON.stringify({ email: usuario.email, rol: usuario.rol }));
      } else {
        res.writeHead(401);
        res.end(JSON.stringify({ mensaje: 'No autorizado' }));
      }
      return;
    }

    // LOGOUT
    if (pathname === '/api/logout' && req.method === 'POST') {
      const cookies = parsearCookies(req);
      if (cookies.sessionId) {
        sesionesActivas.delete(cookies.sessionId);
      }
      res.setHeader('Set-Cookie', 'sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      res.writeHead(200);
      res.end(JSON.stringify({ mensaje: 'Sesión cerrada' }));
      return;
    }
    // Ejemplo de ruta protegida para usuarios autenticados
    if (pathname === '/api/recurso-protegido' && req.method === 'GET') {
      const usuarioActual = verificarSesionValida(req);
      
      if (!usuarioActual) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ mensaje: 'No autorizado: Se requiere sesión válida' }));
        return;
      }

      // Lógica si el usuario está autenticado...
    }

    res.writeHead(404);
    res.end(JSON.stringify({ mensaje: 'Ruta API no encontrada' }));
    return;
  }

  // --- ARCHIVOS ESTÁTICOS DEL CLIENTE (Mismo origen) ---
  let filePath = path.join(__dirname, '../cliente', pathname === '/' ? 'index.html' : pathname);
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css'
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
});

server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

// Función auxiliar para verificar si la petición tiene una sesión válida
function verificarSesionValida(req) {
  const cookies = parsearCookies(req);
  const sessionId = cookies.sessionId;
  if (!sessionId) return null;
  
  const email = sesionesActivas.get(sessionId);
  if (!email) return null;

  return dao.obtenerPorEmail(email);
}