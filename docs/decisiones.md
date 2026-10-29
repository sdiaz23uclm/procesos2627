---
type: Decisiones
title: Decisiones de diseño
description: Decisiones observables y sus fuentes en el README, el código y el historial.
timestamp: 2026-10-28
---

## D-01 — Node.js y servidor HTTP nativo

- **Qué se decidió:** usar Node.js con módulos nativos para el servidor HTTP.
- **Por qué:** el [README](../README.md) lo justifica por ligereza, eficiencia asíncrona y separación de capas.
- **Estado:** vigente.

## D-02 — Interfaz HTML y CSS nativos

- **Qué se decidió:** implementar la interfaz con HTML/CSS nativos y un cliente de comunicación en JavaScript.
- **Por qué:** el [README](../README.md) menciona rapidez, modularidad y evitar sobrecarga de frameworks.
- **Estado:** vigente.

## D-03 — MongoDB para persistencia

- **Qué se decidió:** usar MongoDB Atlas mediante el driver de Node.js; `servidor/datos.js` implementa las operaciones de usuarios.
- **Por qué:** el [README](../README.md) cita disponibilidad, capa inicial gratuita e integración asíncrona. El commit `aa2da12` identifica el Hito 3 como persistencia con MongoDB Atlas.
- **Estado:** vigente.

## D-04 — bcryptjs para las contraseñas

- **Qué se decidió:** generar y verificar hashes con `bcryptjs` en `servidor/logica.js`.
- **Por qué:** el [README](../README.md) lo justifica como protección frente al almacenamiento de contraseñas en texto plano.
- **Estado:** vigente.

## D-05 — Asignar el rol de administrador mediante variable de entorno

- **Qué se decidió:** asignar `admin` al registrarse con el email normalizado coincidente con `ADMIN_EMAIL`.
- **Por qué:** TODO(alumno): ¿por qué se eligió asignar el rol mediante `ADMIN_EMAIL` en el registro?
- **Estado:** vigente.

## D-06 — Sesiones almacenadas en memoria

- **Qué se decidió:** mantener un `Map` de sesiones en `servidor/api.js` y usar una cookie `sessionId`.
- **Por qué:** TODO(alumno): ¿por qué se eligió guardar las sesiones en memoria del proceso?
- **Estado:** vigente.

## D-07 — Normalizar el email

- **Qué se decidió:** quitar espacios exteriores, pasar a minúsculas y validar el email antes de usarlo.
- **Por qué:** el README describe ese comportamiento para `/api/prueba/email`; los commits `8f1526b` y `6267d36` registran cambios relacionados con normalización/comprobación. TODO(alumno): ¿qué necesidad motivó extender esa normalización al registro y al inicio de sesión?
- **Estado:** vigente.

## D-08 — Confirmación de cuenta pendiente

- **Qué se decidió:** crear cuentas en estado `pendiente` y rechazar su inicio de sesión mientras mantengan ese estado.
- **Por qué:** TODO(alumno): ¿qué decisión llevó a dejar pendiente la confirmación por correo en esta versión?
- **Estado:** vigente.
