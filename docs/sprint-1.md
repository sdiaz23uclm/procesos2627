---
type: Sprint
title: Sprint 1
description: Hitos de referencia y evidencia del estado alcanzado en el repositorio.
timestamp: 2026-10-28
---

El calendario y los objetivos de los hitos se toman del apartado 10 de la especificación. Son orientativos. El estado descrito es el comprobable en el código actual y en los mensajes de Git.

## Hito 1 — Esqueleto y backend

- **Objetivo:** repositorio y flujo de trabajo; CI y despliegue desde el primer día; lógica de usuarios con datos en memoria, sus pruebas y API.
- **Qué se hizo:** el commit `a904438` identifica el hito e indica implementación de datos, lógica, API y pruebas. En el código actual hay rutas de registro, inicio de sesión, listado y eliminación, pruebas de lógica y un workflow de CI. El despliegue no se acredita en este repositorio.
- **PR:** [PR #1](https://github.com/sdiaz23uclm/procesos2627/pull/1), integrado según GitHub.
- **Etiqueta:** no hay etiquetas según `git tag`.
- **Desviaciones del flujo:** los commits iniciales `3652c8f` y `98cfa6f` preceden al primer PR. El commit `5551fa0` llegó a `main` sin PR asociado en la lista consultada; GitHub lo identifica con `web-flow` como committer.

## Hito 2 — Frontend y sesión

- **Objetivo:** separar presentación y comunicación del cliente; registro e inicio de sesión locales con hash; cierre y mantenimiento de sesión entre recargas; proteger rutas.
- **Qué se hizo:** `cliente/index.html` contiene la interfaz y `cliente/rest.js` llamadas HTTP; `servidor/api.js` implementa sesiones por cookie y rutas de sesión. El commit `f99af2c` indica actualización de pruebas del hito.
- **PR:** [PR #2](https://github.com/sdiaz23uclm/procesos2627/pull/2), integrado según GitHub.
- **Etiqueta:** no hay etiquetas según `git tag`.
- **Desviaciones del flujo:** GitHub confirma que PR #2 está integrado; la desviación indicada para el Hito 1 se documenta arriba.

## Hito 3 — Persistencia y roles

- **Objetivo:** sustituir los datos en memoria por una base de datos real, gestionar secretos con variables de entorno, aplicar roles en el servidor y registrar actividad.
- **Qué se hizo:** `servidor/datos.js` usa MongoDB; `servidor/logica.js` y `servidor/api.js` aplican permisos de administrador y generan logs. `.env.example` contiene nombres de variables y `.env` está ignorado. El commit `aa2da12` está identificado como Hito 3.
- **PR:** [PR #3](https://github.com/sdiaz23uclm/procesos2627/pull/3), integrado según GitHub.
- **Etiqueta:** no hay etiquetas según `git tag`.
- **Desviaciones del flujo:** el despliegue cloud no queda acreditado. GitHub confirma la integración del PR #3.

## Hito 4 — Servicios externos y cierre

- **Objetivo:** OAuth, confirmación por correo, manejo de errores con feedback, README completo y revisión final.
- **Qué se hizo:** los commits `fb0b5ee` y `6267d36` mencionan lógica y comprobación de correo; el código actual aún deja el registro en estado pendiente y no implementa envío ni confirmación. No se encontraron rutas OAuth. La interfaz muestra errores de registro e inicio de sesión; el [README](../README.md) documenta tecnologías, ejecución y pruebas.
- **PR:** GitHub confirma integrados los PR [#4](https://github.com/sdiaz23uclm/procesos2627/pull/4)–[#11](https://github.com/sdiaz23uclm/procesos2627/pull/11). Sus títulos incluyen correcciones de API, CI, pruebas, README, normalización y `.gitignore`; no hay evidencia suficiente para atribuir un PR concreto a OAuth o a la entrega completa del Hito 4.
- **Etiqueta:** no hay etiquetas según `git tag`.
- **Desviaciones del flujo:** el commit `5551fa0` fuera de PR se describe en el Hito 1; no se puede determinar si hubo otras ediciones directas en GitHub.

## Tablero

No se recibió una URL de Donetonic ni confirmación de que no se use. **Por verificar:** añadir el enlace al tablero o confirmar «no uso». No se reproducen tareas del tablero.

## Retrospectiva

### Hechos

- El historial contiene commits con mensajes identificados como Esqueleto, Hito 1, Hito 2 y Hito 3; GitHub confirma integrados los PR #1–#11.
- El commit `5551fa0` llegó a `main` sin PR asociado en la lista consultada; GitHub lo identifica con `web-flow` como committer.
- `npm.cmd test` terminó con 9 pruebas aprobadas y 0 fallidas.
- GitHub Actions informó 13 ejecuciones completadas con conclusión `success`.
- `git tag` no mostró etiquetas.

### Qué funcionó

TODO(alumno): ¿qué práctica concreta del Sprint 1 ayudó a completar o integrar trabajo, y qué evidencia del historial lo respalda?

### Qué cambiaría

TODO(alumno): ¿qué cambio concreto harías al proceso del Sprint 1 y qué hecho observado justifica ese cambio?
