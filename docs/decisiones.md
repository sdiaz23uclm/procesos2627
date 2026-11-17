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
- **Estado:** sustituida por D-13.

## D-07 — Normalizar el email

- **Qué se decidió:** quitar espacios exteriores, pasar a minúsculas y validar el email antes de usarlo.
- **Por qué:** el README describe ese comportamiento para `/api/prueba/email`; los commits `8f1526b` y `6267d36` registran cambios relacionados con normalización/comprobación. TODO(alumno): ¿qué necesidad motivó extender esa normalización al registro y al inicio de sesión?
- **Estado:** vigente.

## D-08 — Confirmación de cuenta pendiente

- **Qué se decidió:** crear cuentas en estado `pendiente` y rechazar su inicio de sesión mientras mantengan ese estado.
- **Por qué:** TODO(alumno): ¿qué decisión llevó a dejar pendiente la confirmación por correo en esta versión?
- **Estado:** vigente.

## D-09 — Brevo como servicio de correo transaccional

- **Qué se decidió:** enviar el correo de confirmación de cuenta (RF-02) mediante la API HTTP de Brevo. El servicio de correo se crea en la composición (`servidor/api.js`) y se inyecta en la lógica, que no conoce HTTP ni Brevo.
- **Por qué:** TODO(alumno): ¿por qué Brevo frente a Resend o SendGrid?
- **Estado:** vigente.

## D-10 — Google como proveedor OAuth

- **Qué se decidió:** implementar el inicio de sesión externo (RF-04) con OAuth 2.0 de Google (flujo de código de autorización), sin librerías de terceros.
- **Por qué:** TODO(alumno): ¿por qué Google frente a GitHub?
- **Estado:** vigente.

## D-11 — Vincular cuentas cuando el email OAuth ya existe

- **Qué se decidió:** si un usuario entra con Google y ya hay una cuenta local con ese email, se inicia sesión en la cuenta existente y, si estaba `pendiente`, pasa a `confirmado`.
- **Por qué:** TODO(alumno): ¿por qué vincular en lugar de rechazar?
- **Estado:** vigente.

## D-12 — Borrado lógico de usuarios, con posibilidad de volver a registrarse

- **Qué se decidió:** eliminar un usuario no borra su documento: se marca con estado `eliminado` y fecha `eliminadoEn`. La cuenta eliminada no puede iniciar sesión (ni local ni con Google) y sus sesiones se cierran. Las búsquedas por email ignoran las cuentas eliminadas, así que el mismo email puede registrarse de nuevo y obtiene una cuenta nueva; la antigua sigue en la base de datos como `eliminado`.
- **Por qué:** TODO(alumno): ¿por qué borrado lógico y por qué permitir volver a registrarse?
- **Estado:** vigente. Sustituye al borrado físico implícito en D-03.

## D-13 — Sesiones persistidas en MongoDB

- **Qué se decidió:** guardar las sesiones en la colección `sesiones` de MongoDB (hash del identificador, email y caducidad de 7 días con índice TTL) en lugar del `Map` en memoria.
- **Por qué:** TODO(alumno): (pista: reinicios y varias instancias en Cloud Run).
- **Estado:** vigente. Sustituye a D-06.

## D-14 — Alianzas: rondas simultáneas de 10 segundos con acciones instantáneas

- **Qué se decidió:** la partida avanza en rondas de 10 s en las que todos los países (jugador e IAs) actúan a la vez. Cada acción se aplica en el momento en que se elige (gana quien actúa primero); no se resuelven al final de la ronda.
- **Por qué:** TODO(alumno).
- **Estado:** sustituida por D-22.

## D-15 — Alianzas: puntos de acción

- **Qué se decidió:** cada país empieza con 2 puntos; cada 30 s (3 rondas) recibe +2, con un tope de 6. No gastar puntos equivale a «no hacer nada» y permite acumular hasta el tope.
- **Por qué:** TODO(alumno).
- **Estado:** el ritmo de recarga se mantiene; el momento en que se puede actuar lo fija D-22.

## D-16 — Alianzas: mapa de 12 x 12 y radio de acción cuadrado

- **Qué se decidió:** mapa en rejilla de 12 x 12 con 4 países que empiezan cerca de las esquinas. El radio de acción se mide en cuadrado (las diagonales cuentan: radio 3 = zona de 7 x 7) y empieza en 3.
- **Por qué:** TODO(alumno).
- **Estado:** vigente el mapa de 12 x 12; la forma del radio la sustituye D-23.

## D-17 — Alianzas: IAs con personalidad

- **Qué se decidió:** las 3 IAs tienen personalidades distintas: agresiva (ataca al más débil a su alcance), diplomática (devuelve los puntos que le regalan y evita atacar a sus aliados) y equilibrada.
- **Por qué:** TODO(alumno).
- **Estado:** vigente.

## D-18 — Alianzas: el jugador elige su país

- **Qué se decidió:** el jugador elige su país de una lista de 8 y las IAs toman otros 3 al azar.
- **Por qué:** TODO(alumno).
- **Estado:** vigente.

## D-19 — Alianzas: guardado automático y manual en MongoDB

- **Qué se decidió:** la partida se guarda en MongoDB al final de cada ronda y también con un botón «Guardar». Al iniciar sesión se puede continuar la partida guardada.
- **Por qué:** TODO(alumno).
- **Estado:** vigente.

## D-20 — Alianzas: el servidor manda y el tiempo avanza bajo demanda

- **Qué se decidió:** toda la lógica del juego (rondas, recargas, IAs, validación de acciones) se ejecuta en el servidor. No hay temporizadores en el servidor: el navegador consulta el estado cada 500 ms y, en cada petición, el servidor avanza el reloj de la partida el tiempo real transcurrido (como mucho 3 s por petición) y procesa lo que haya ocurrido. Si nadie consulta, la partida queda en pausa.
- **Por qué:** TODO(alumno). (Contexto: Cloud Run solo asigna CPU mientras atiende peticiones, y la especificación prohíbe la lógica de negocio en el cliente).
- **Estado:** vigente.

## D-21 — Alianzas: la partida vive en MongoDB

- **Qué se decidió:** el estado de cada partida se guarda en la colección `partidas` (una por usuario) con un número de versión; cada petición carga la partida, la actualiza y la guarda solo si nadie la cambió entretanto (si no, reintenta). «Guardar» deja además la partida en pausa con su fecha.
- **Por qué:** TODO(alumno). (Contexto: funciona con reinicios y con varias instancias de Cloud Run, igual que las sesiones de D-13).
- **Estado:** vigente.

## D-22 — Alianzas: ciclos de 30 s con un turno de 10 s para actuar

- **Qué se decidió:** la partida avanza en ciclos (rondas) de 30 s. Al empezar cada ciclo todos los países reciben +2 puntos (tope 6) y se abre un turno de 10 s en el que se puede actuar tantas veces como permitan los puntos; las acciones siguen aplicándose al instante. Durante los 20 s restantes nadie puede actuar. Quien no actúa en su turno lo pierde (sus puntos se conservan para el siguiente).
- **Por qué:** TODO(alumno).
- **Estado:** vigente. Sustituye a D-14.

## D-23 — Alianzas: radio en cruz

- **Qué se decidió:** la zona de acción empieza siendo el cuadrado de 7 x 7 alrededor del país (radio 3). Cada ampliación alarga una casilla los cuatro brazos (arriba, abajo, izquierda y derecha) manteniendo su ancho de 7; las esquinas no crecen. Una casilla está al alcance si `max(|dx|, |dy|) <= radio` y `min(|dx|, |dy|) <= 3`. El movimiento sigue siendo de una casilla en 8 direcciones.
- **Por qué:** con el radio cuadrado, ampliar daba demasiado alcance (desbalanceado). TODO(alumno): completar.
- **Estado:** vigente. Sustituye a la forma del radio de D-16.
