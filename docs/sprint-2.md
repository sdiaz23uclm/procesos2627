---
type: Sprint
title: Sprint 2
description: Objetivo pendiente de definir y seguimiento de requisitos incompletos o no verificados.
timestamp: 2026-10-28
---

## Objetivo

Desarrollar el juego «Alianzas» sobre la base del Sprint 1.

## Primera versión (rama `feature/alianzas-base`)

Partida de 1 jugador contra 3 IAs en un mapa de 12 x 12, con rondas simultáneas de 10 s, puntos de acción (+2 cada 30 s, tope 6), radio cuadrado inicial 3, 3 vidas, guardado automático y manual en MongoDB. Decisiones D-14 a D-21. Pruebas en `tests/reglas.test.js`, `tests/ia.test.js` y `tests/partidas.test.js`.

## Ajustes tras la primera prueba (rama `feature/alianzas-ajustes`)

Ciclos de 30 s con un turno de 10 s para actuar (D-22), radio que crece en cruz (D-23), zona de acción más visible, tutorial en el panel y bajo el tablero, y acceso con pestañas «Iniciar sesión» / «Crear cuenta».

Pendiente para versiones siguientes: TODO(alumno) (por ejemplo, partidas entre varios jugadores humanos).

## Requisitos que pasan desde Sprint 1

Los siguientes requisitos quedaron parciales, pendientes o sin evidencia suficiente para verificarlos. Su inclusión no presupone que una configuración externa no exista.

| ID | Seguimiento |
|---|---|
| PRO-01 | Evitar commits directos a `main`: `5551fa0` consta en GitHub sin PR asociado en la lista consultada y con `web-flow` como committer. |

El tablero Donetonic queda **Por verificar**: falta su URL o confirmar «no uso».
