---
type: Arquitectura
title: Arquitectura del Sprint 1
description: Capas, fronteras y rutas HTTP comprobadas en el código actual.
timestamp: 2026-10-28
---

## Backend

| Capa | Archivos | Responsabilidad comprobada |
|---|---|---|
| API y servidor HTTP | `servidor/api.js` | Crea el servidor, enruta solicitudes `/api/`, gestiona cookies/sesiones y sirve los ficheros del cliente. |
| Lógica de negocio | `servidor/logica.js` | Normaliza email, registra e inicia sesión, consulta estado activo, lista usuarios y aplica reglas de eliminación. |
| Acceso a datos | `servidor/datos.js` | Conecta a MongoDB y ofrece operaciones de guardar, consultar y eliminar usuarios. |

**Frontera:** `api.js` construye `BaseDatosMongoDB` y `LogicaUsuarios`; las rutas llaman a métodos de la lógica. La lógica recibe el DAO por constructor y llama a sus operaciones. `datos.js` concentra las operaciones de persistencia.

## Frontend

| Capa | Archivo | Responsabilidad comprobada |
|---|---|---|
| Presentación | `cliente/index.html` | Contiene el marcado, estilos y código de interfaz para registro, inicio de sesión, panel y listado de usuarios. |
| Comunicación | `cliente/rest.js` | Define llamadas `fetch` para registro, inicio de sesión, sesión y cierre de sesión. |

**Frontera:** la interfaz invoca `RestClient`; este intercambia JSON con rutas relativas `/api/...`. El listado de usuarios llama directamente a `fetch('/api/usuarios')` desde el código de la página. El navegador no se conecta a MongoDB. El servidor sirve los archivos estáticos desde `cliente/` y la API bajo el mismo origen.

## Rutas API

| Método | Ruta | Quién puede |
|---|---|---|
| `POST` | `/api/prueba/email` | Cualquiera; valida y normaliza el email. |
| `POST` | `/api/registro` | Cualquiera. |
| `POST` | `/api/login` | Cualquiera; crea una sesión si las credenciales se aceptan. |
| `GET` | `/api/sesion` | Cualquiera puede consultar; requiere sesión válida para devolver el usuario y, si no, responde `401`. |
| `GET` | `/api/usuarios` | Administrador con sesión válida; el rechazo de acceso termina en `403`. |
| `DELETE` | `/api/eliminar` | Usuario con sesión válida; la lógica limita al usuario normal a su propia cuenta. |
| `POST` | `/api/logout` | Cualquiera; invalida la sesión si recibe su cookie. |

La comprobación de usuario activo existe como método de lógica, pero no está expuesta como ruta. No se encontraron rutas de confirmación de cuenta u OAuth.
