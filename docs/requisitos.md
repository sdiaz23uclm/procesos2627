---
type: Requisitos
title: Requisitos del Sprint 1
description: Estado de los requisitos de la especificación y evidencia observable.
timestamp: 2026-11-17
---

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| ARQ-01 | Separación cliente-servidor y mismo origen | hecho | `servidor/api.js` sirve `cliente/` y enruta `/api/`; `cliente/rest.js` usa rutas relativas. |
| ARQ-02 | Capas del backend: API, lógica y datos | hecho | `servidor/api.js`, `servidor/logica.js` y `servidor/datos.js` separan servidor/rutas, reglas y acceso MongoDB. |
| ARQ-03 | Capas del frontend: presentación y comunicación | hecho | `cliente/index.html` presenta la interfaz; `cliente/rest.js` implementa todas las llamadas HTTP (incluido el listado, que antes se hacía desde la página). |
| RF-01 | Registro de usuario local | hecho | `POST /api/registro` y `LogicaUsuarios.registrarUsuario`; prueba de alta en `tests/logica.test.js`. La cuenta queda pendiente. |
| RF-02 | Confirmación de cuenta por correo | hecho | `LogicaUsuarios.registrarUsuario` genera un token (se guarda solo su hash, caduca a las 24 h) y lo envía con `servidor/correo.js` (Brevo, D-09); `GET /api/confirmar` llama a `LogicaUsuarios.confirmarCuenta` y la cuenta pasa a `confirmado`; `POST /api/reenviar-confirmacion` envía un enlace nuevo. Pruebas 7–15 en `tests/logica.test.js` y `tests/correo.test.js` con dobles del correo. Por verificar: envío real en la URL pública. |
| RF-03 | Inicio de sesión local | hecho | `POST /api/login`, `LogicaUsuarios.loginUsuario` y prueba de inicio de sesión en `tests/logica.test.js`. |
| RF-04 | Inicio de sesión con OAuth | hecho | `servidor/oauth.js` (`ClienteOAuthGoogle`, D-10) implementa el flujo de código de autorización con `state` en cookie contra CSRF; `GET /api/auth/google` y `GET /api/auth/google/callback` en `servidor/api.js`; `LogicaUsuarios.loginOAuth` crea la cuenta con estado `oauth` o vincula y confirma una cuenta pendiente (D-11). Pruebas 16–21 en `tests/logica.test.js` y `tests/oauth.test.js` con dobles de Google. Por verificar: login real en la URL pública. |
| RF-05 | Cierre de sesión | hecho | `POST /api/logout` elimina la sesión de memoria y vence la cookie. |
| RF-06 | Mantenimiento de la sesión entre recargas | hecho | La cookie `sessionId` permite consultar `GET /api/sesion` al cargar la página; la sesión se guarda en memoria del servidor. |
| RF-07 | Listar usuarios (administrador) | hecho | `GET /api/usuarios` pasa por `LogicaUsuarios.listarUsuarios`; hay pruebas de listado y rechazo de usuario normal. |
| RF-08 | Comprobar si un usuario está activo (administrador) | hecho | `GET /api/usuarios/activo?email=…` llama a `LogicaUsuarios.consultarActivo`, que exige rol `admin`; activo = `confirmado` u `oauth` y no eliminado. El listado también incluye la columna «Activo». Pruebas 22–24 en `tests/logica.test.js`. |
| RF-09 | Eliminar usuario | hecho | `DELETE /api/eliminar`; la lógica permite al administrador eliminar a cualquiera y al usuario normal solo a sí mismo. Borrado lógico (D-12): estado `eliminado`, no puede iniciar sesión y se cierran sus sesiones; el email puede registrarse de nuevo como cuenta nueva. Botones «Eliminar mi cuenta» y «Eliminar» en el listado del administrador. Pruebas 25–30. |
| RF-10 | Creación del primer administrador | hecho | La cuenta registrada (o creada con Google) con el email de `ADMIN_EMAIL` recibe rol `admin` (D-05) y se activa confirmando el correo o entrando con Google. Procedimiento en el [README](../README.md). Prueba 19. |
| RNF-01 | Persistencia en una base de datos real | hecho | `servidor/datos.js` persiste usuarios en MongoDB. |
| RNF-02 | Secretos fuera del código y .env.example | hecho | `.env` está ignorado; `.env.example` contiene solo nombres: `MONGODB_URI`, `PORT`, `ADMIN_EMAIL`, `APP_URL`, `BREVO_API_KEY`, `MAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. En Cloud Run los secretos se referencian desde Secret Manager. |
| RNF-03 | Hash seguro de contraseñas | hecho | `servidor/logica.js` usa `bcryptjs`; `tests/logica.test.js` comprueba que el alta incluye `passwordHash`. |
| RNF-04 | Rutas protegidas por sesión y rol | hecho | `verificarSesionValida` en `servidor/api.js` resuelve la sesión desde MongoDB; listado y consulta de actividad exigen `admin` en la lógica (`exigirAdmin`) y responden `403`; eliminar exige sesión (`401`) y permisos (`403`). Pruebas 5, 24 y 26. |
| RNF-05 | Despliegue en cloud con URL pública | hecho | Google Cloud Run (región `europe-southwest1`): https://procesos26-27-1061448815388.europe-southwest1.run.app. |
| RNF-06 | Pruebas unitarias de la lógica (5 o más) | hecho | `node --test` (lo que ejecuta `npm test`) sobre `tests/logica.test.js`, `tests/correo.test.js`, `tests/oauth.test.js` y `tests/sesiones.test.js`: `# tests 47`, `# pass 47`, `# fail 0`. |
| RNF-07 | Manejo de errores con feedback al usuario | hecho | Errores de negocio con código (`errorNegocio` en `servidor/logica.js`) traducidos a HTTP en `responderError` (`servidor/api.js`); cualquier excepción inesperada devuelve `500` con mensaje en lugar de tumbar el servidor; `cliente/rest.js` convierte fallos de red y del servidor en mensajes, y `cliente/index.html` los muestra junto a cada formulario y devuelve al login si la sesión caduca. |
| RNF-08 | Registro de actividad (log) | hecho | `servidor/logica.js` usa `console.log` para registros, inicios de sesión, consultas y eliminaciones. |
| PRO-01 | Flujo de trabajo GitHub Flow | parcial | GitHub confirma PR #1–#11 integrados. `3652c8f` y `98cfa6f` preceden al primer PR; `5551fa0` aparece en `main` sin PR asociado en la lista consultada y con `web-flow` como committer. |
| PRO-02 | Integración continua | hecho | `.github/workflows/ci.yml` configura `npm test` para PR y push a `main`; GitHub Actions informó 13 ejecuciones, todas con conclusión `success`. |
| PRO-03 | Despliegue continuo | hecho | Cloud Run despliega cada cambio que llega a `main` mediante su integración con el repositorio de GitHub; las compilaciones aparecen en «Historial de compilaciones» del servicio. La configuración está en Google Cloud, no en el repositorio. |
