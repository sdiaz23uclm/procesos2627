---
type: Requisitos
title: Requisitos del Sprint 1
description: Estado de los requisitos de la especificación y evidencia observable.
timestamp: 2026-10-28
---

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| ARQ-01 | Separación cliente-servidor y mismo origen | hecho | `servidor/api.js` sirve `cliente/` y enruta `/api/`; `cliente/rest.js` usa rutas relativas. |
| ARQ-02 | Capas del backend: API, lógica y datos | hecho | `servidor/api.js`, `servidor/logica.js` y `servidor/datos.js` separan servidor/rutas, reglas y acceso MongoDB. |
| ARQ-03 | Capas del frontend: presentación y comunicación | hecho | `cliente/index.html` presenta la interfaz; `cliente/rest.js` implementa llamadas HTTP. |
| RF-01 | Registro de usuario local | hecho | `POST /api/registro` y `LogicaUsuarios.registrarUsuario`; prueba de alta en `tests/logica.test.js`. La cuenta queda pendiente. |
| RF-02 | Confirmación de cuenta por correo | pendiente | El usuario se guarda con estado `pendiente`; no hay envío de correo ni ruta de confirmación. |
| RF-03 | Inicio de sesión local | hecho | `POST /api/login`, `LogicaUsuarios.loginUsuario` y prueba de inicio de sesión en `tests/logica.test.js`. |
| RF-04 | Inicio de sesión con OAuth | pendiente | No se encontró una ruta ni integración OAuth en el código. |
| RF-05 | Cierre de sesión | hecho | `POST /api/logout` elimina la sesión de memoria y vence la cookie. |
| RF-06 | Mantenimiento de la sesión entre recargas | hecho | La cookie `sessionId` permite consultar `GET /api/sesion` al cargar la página; la sesión se guarda en memoria del servidor. |
| RF-07 | Listar usuarios (administrador) | hecho | `GET /api/usuarios` pasa por `LogicaUsuarios.listarUsuarios`; hay pruebas de listado y rechazo de usuario normal. |
| RF-08 | Comprobar si un usuario está activo (administrador) | parcial | `LogicaUsuarios.comprobarActivo` consulta el estado, pero no existe endpoint que permita esa consulta al administrador. |
| RF-09 | Eliminar usuario | hecho | `DELETE /api/eliminar`; la lógica permite al administrador eliminar a cualquiera y al usuario normal solo eliminarse a sí mismo. |
| RF-10 | Creación del primer administrador | parcial | `ADMIN_EMAIL` da rol `admin` al registrar una dirección coincidente. No se documenta un procedimiento para crear o confirmar la primera cuenta. |
| RNF-01 | Persistencia en una base de datos real | hecho | `servidor/datos.js` persiste usuarios en MongoDB. |
| RNF-02 | Secretos fuera del código y .env.example | hecho | `.env` está ignorado; `.env.example` contiene los nombres `MONGODB_URI`, `PORT` y `ADMIN_EMAIL`, sin valores reales. |
| RNF-03 | Hash seguro de contraseñas | hecho | `servidor/logica.js` usa `bcryptjs`; `tests/logica.test.js` comprueba que el alta incluye `passwordHash`. |
| RNF-04 | Rutas protegidas por sesión y rol | parcial | Las rutas de sesión, listado y eliminación comprueban sesión o rol; falta exponer y proteger la consulta de actividad requerida. |
| RNF-05 | Despliegue en cloud con URL pública | Por verificar | No hay configuración de despliegue ni URL pública en los archivos revisados. La configuración externa no se pudo comprobar. |
| RNF-06 | Pruebas unitarias de la lógica (5 o más) | hecho | `npm.cmd test` ejecutó las pruebas de `tests/logica.test.js`: resumen de Node.js, `# tests 9`, `# pass 9`, `# fail 0`. |
| RNF-07 | Manejo de errores con feedback al usuario | parcial | Registro e inicio de sesión muestran errores en `cliente/index.html`; la comprobación inicial de sesión captura errores y muestra el acceso como no autenticado. |
| RNF-08 | Registro de actividad (log) | hecho | `servidor/logica.js` usa `console.log` para registros, inicios de sesión, consultas y eliminaciones. |
| PRO-01 | Flujo de trabajo GitHub Flow | parcial | GitHub confirma PR #1–#11 integrados. `3652c8f` y `98cfa6f` preceden al primer PR; `5551fa0` aparece en `main` sin PR asociado en la lista consultada y con `web-flow` como committer. |
| PRO-02 | Integración continua | hecho | `.github/workflows/ci.yml` configura `npm test` para PR y push a `main`; GitHub Actions informó 13 ejecuciones, todas con conclusión `success`. |
| PRO-03 | Despliegue continuo | Por verificar | No se encontró un paso de despliegue en el workflow. Una posible integración externa del proveedor cloud queda **Por verificar**. |
