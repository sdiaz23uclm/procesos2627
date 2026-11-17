---
type: Arquitectura
title: Arquitectura del Sprint 1
description: Capas, fronteras y rutas HTTP comprobadas en el código actual.
timestamp: 2026-11-17
---

## Backend

| Capa | Archivos | Responsabilidad comprobada |
|---|---|---|
| API y servidor HTTP | `servidor/api.js` | Crea el servidor, enruta solicitudes `/api/`, gestiona cookies/sesiones y sirve los ficheros del cliente. |
| Lógica de negocio | `servidor/logica.js` | Normaliza email, registra e inicia sesión, consulta estado activo, lista usuarios y aplica reglas de eliminación. |
| Acceso a datos | `servidor/datos.js` | Conecta a MongoDB. Usuarios: guardar, consultar (por email o por hash de token, ignorando cuentas `eliminado`), actualizar y borrado físico para deshacer un alta. Sesiones: crear, obtener, eliminar (colección `sesiones` con índice TTL). |
| Gestión de sesiones (capa API) | `servidor/sesiones.js` | `GestorSesiones` genera el identificador de la cookie, guarda solo su hash con caducidad de 7 días y cierra las sesiones de una cuenta eliminada. |
| Servicio externo de OAuth | `servidor/oauth.js` | `ClienteOAuthGoogle` construye la URL de autorización de Google y cambia el código por el email verificado. |
| Servicio externo de correo | `servidor/correo.js` | `ServicioCorreoBrevo` envía el enlace de confirmación por la API HTTP de Brevo. |

**Frontera:** `api.js` es la composición: construye `BaseDatosMongoDB`, `ServicioCorreoBrevo`, `ClienteOAuthGoogle` y `LogicaUsuarios`, e inyecta el DAO y el servicio de correo en la lógica, que no conoce HTTP ni Brevo (solo llama a `enviarConfirmacion(email, token)`). El cliente OAuth lo usa la capa API; la lógica solo recibe el email ya verificado en `loginOAuth(email)`; las rutas llaman a métodos de la lógica. La lógica recibe el DAO por constructor y llama a sus operaciones. `datos.js` concentra las operaciones de persistencia.

## Frontend

| Capa | Archivo | Responsabilidad comprobada |
|---|---|---|
| Presentación | `cliente/index.html` | Contiene el marcado, estilos y código de interfaz para registro, inicio de sesión, panel y listado de usuarios. |
| Comunicación | `cliente/rest.js` | Contiene todas las llamadas `fetch` (registro, inicio y cierre de sesión, reenvío de confirmación, listado, consulta de actividad y eliminación) y la navegación al login con Google. |

**Frontera:** la interfaz invoca `RestClient`; este intercambia JSON con rutas relativas `/api/...`. La página no hace ningún `fetch` directamente. El navegador no se conecta a MongoDB. El servidor sirve los archivos estáticos desde `cliente/` y la API bajo el mismo origen.

## Rutas API

| Método | Ruta | Quién puede |
|---|---|---|
| `POST` | `/api/prueba/email` | Cualquiera; valida y normaliza el email. |
| `POST` | `/api/registro` | Cualquiera. |
| `POST` | `/api/login` | Cualquiera; crea una sesión si las credenciales se aceptan. |
| `GET` | `/api/auth/google` | Cualquiera; guarda un `state` aleatorio en cookie y redirige a Google. |
| `GET` | `/api/auth/google/callback` | Google; comprueba `state`, obtiene el email verificado, crea la sesión y redirige a `/` (o a `/?oauth=cancelado|error`). |
| `GET` | `/api/confirmar?token=…` | Cualquiera con el enlace del correo; redirige a `/?confirmacion=ok|caducado|invalido`. |
| `POST` | `/api/reenviar-confirmacion` | Cualquiera; responde igual exista o no la cuenta, para no revelar emails registrados. |
| `GET` | `/api/sesion` | Cualquiera puede consultar; requiere sesión válida para devolver el usuario y, si no, responde `401`. |
| `GET` | `/api/usuarios` | Administrador con sesión válida; el rechazo de acceso termina en `403`. Devuelve email, rol, estado y activo. |
| `GET` | `/api/usuarios/activo?email=…` | Administrador con sesión válida (`403` si no). |
| `DELETE` | `/api/eliminar` | Usuario con sesión válida (`401` si no); la lógica limita al usuario normal a su propia cuenta (`403`). Borrado lógico y cierre de sesiones de la cuenta. |
| `POST` | `/api/logout` | Cualquiera; invalida la sesión si recibe su cookie. |

Las cookies de sesión se generan con `crypto.randomBytes` y llevan `HttpOnly`, `SameSite=Lax` y, si `APP_URL` es https, `Secure`.

## Manejo de errores

La lógica lanza errores con un `codigo` (`SIN_PERMISOS`, `NO_AUTENTICADO`, `USUARIO_NO_ENCONTRADO`, `CORREO_NO_ENVIADO`, `CUENTA_PENDIENTE`, `CUENTA_OAUTH`, `TOKEN_INVALIDO`, `TOKEN_CADUCADO`). `responderError` en `servidor/api.js` los traduce a `401`, `403`, `404`, `502` o `400`. Cualquier otra excepción se captura en el servidor HTTP y devuelve `500` con un mensaje genérico, registrándose con `[ERROR]`.
