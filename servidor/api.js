import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { BaseDatosMongoDB } from './datos.js';
import { LogicaUsuarios } from './logica.js';

// Cargar variables de entorno del archivo .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dao = new BaseDatosMongoDB();
const logica = new LogicaUsuarios(dao);
const PORT = process.env.PORT || 8080;

// Almacenamiento simple de sesiones en memoria
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

// Función auxiliar para verificar si la petición tiene una sesión válida
async function verificarSesionValida(req) {
  const cookies = parsearCookies(req);
  const sessionId = cookies.sessionId;
  if (!sessionId) return null;
  
  const email = sesionesActivas.get(sessionId);
  if (!email) return null;

  return await dao.obtenerPorEmail(email);
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

    // LISTAR USUARIOS (Solo Admin - Requisito apartado 4.2)
    if (pathname === '/api/usuarios' && req.method === 'GET') {
      try {
        const usuarioActual = await verificarSesionValida(req);
        const lista = await logica.listarUsuarios(usuarioActual);
        // Ocultar passwordHash por seguridad al devolver el listado
        const listaPublica = lista.map(u => ({ email: u.email, rol: u.rol, estado: u.estado }));
        res.writeHead(200);
        res.end(JSON.stringify(listaPublica));
      } catch (err) {
        res.writeHead(403);
        res.end(JSON.stringify({ mensaje: err.message }));
      }
      return;
    }

    // ELIMINAR USUARIO (Admin borra a cualquiera, usuario normal a sí mismo)
    if (pathname === '/api/eliminar' && req.method === 'DELETE') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const usuarioActual = await verificarSesionValida(req);
          if (!usuarioActual) {
            res.writeHead(401);
            res.end(JSON.stringify({ mensaje: 'No autorizado' }));
            return;
          }
          const { emailTarget } = JSON.parse(body);
          await logica.eliminarUsuario(usuarioActual.email, emailTarget);
          res.writeHead(200);
          res.end(JSON.stringify({ mensaje: 'Usuario eliminado correctamente' }));
        } catch (err) {
          res.writeHead(403);
          res.end(JSON.stringify({ mensaje: err.message }));
        }
      });
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

    res.writeHead(404);
    res.end(JSON.stringify({ mensaje: 'Ruta API no encontrada' }));
    return;
  }

  // --- ARCHIVOS ESTÁTICOS DEL CLIENTE ---
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