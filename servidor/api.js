import http from "node:http";
import { DatosEnMemoria } from "./datos.js";
import { LogicaUsuarios } from "./logica.js";

const dao = new DatosEnMemoria();
const logica = new LogicaUsuarios(dao);
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/api/usuarios" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(logica.listarUsuarios()));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ mensaje: "Ruta no encontrada" }));
  }
});

server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});