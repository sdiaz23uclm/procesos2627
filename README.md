# procesos2627 — Alianzas

Proyecto individual de Procesos de Ingeniería del Software (curso 2026-2027). Aplicación tipo SaaS con arquitectura en capas y gestión de usuarios (registro con confirmación por correo, inicio de sesión local y con Google, roles de usuario y administrador, persistencia en MongoDB) sobre la que se construye el juego de estrategia **Alianzas**.

**URL pública:** https://procesos26-27-1061448815388.europe-southwest1.run.app

> La capa gratuita de Cloud Run apaga el servicio tras un rato sin uso: la primera petición puede tardar unos segundos.

## Tecnologías elegidas

| Tecnología | Por qué |
|---|---|
| **Node.js** (servidor `http` nativo, módulos ES) | Ligero y asíncrono; sin framework se ve claramente dónde está cada capa. |
| **HTML + CSS + JavaScript nativos** | Interfaz sencilla y sin dependencias; `rest.js` separa la comunicación de la presentación. |
| **MongoDB Atlas** (driver oficial) | Base de datos real con capa gratuita en la nube; guarda usuarios y sesiones. |
| **bcryptjs** | Hash seguro de contraseñas, nunca en texto plano. |
| **Brevo** (API HTTP) | Correo transaccional gratuito (300/día) para la confirmación de cuenta; Cloud Run no permite SMTP directo. |
| **Google OAuth 2.0** | Inicio de sesión externo; las credenciales se crean en el mismo Google Cloud donde está desplegada la app. |
| **node:test** | Framework de pruebas incluido en Node.js: no añade dependencias. |
| **GitHub Actions** | Integración continua: ejecuta las pruebas en cada PR y en cada cambio en `main`. |
| **Google Cloud Run** | Despliegue continuo desde GitHub con capa gratuita y URL pública. |

Las decisiones de diseño y sus motivos están en [`docs/decisiones.md`](docs/decisiones.md); las capas y los endpoints, en [`docs/arquitectura.md`](docs/arquitectura.md).

## Estructura

```
servidor/
  api.js        capa API: servidor HTTP, rutas, cookies (y composición de dependencias)
  sesiones.js   capa API: gestión de sesiones
  logica.js     capa de lógica de negocio de usuarios (no conoce HTTP ni servicios externos)
  logicaPartidas.js  capa de lógica: partidas de Alianzas
  juego/reglas.js    capa de lógica: reglas puras del juego
  juego/ia.js        capa de lógica: las 3 IAs
  datos.js      capa de acceso a datos (MongoDB)
  correo.js     servicio externo de correo (Brevo)
  oauth.js      servicio externo de OAuth (Google)
cliente/
  index.html    capa de presentación (cuentas y panel)
  juego.js/.css capa de presentación del juego
  rest.js       capa de comunicación con el servidor
tests/          pruebas automatizadas (node:test)
docs/           documentación del proyecto (bundle OKF)
```

## Ejecutar en local

Requisitos: Node.js 18 o superior y un clúster de MongoDB Atlas.

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Crea un archivo `.env` en la raíz a partir de [`.env.example`](.env.example) (ver la tabla de variables).
3. Arranca el servidor:
   ```bash
   npm start
   ```
4. Abre http://localhost:3000

## Pruebas

```bash
npm test
```

Ejecuta todas las pruebas de `tests/` con `node --test`. No necesitan base de datos ni conexión a internet: MongoDB, Brevo y Google se sustituyen por dobles de prueba.

## Variables de entorno

Solo nombres; los valores nunca se suben al repositorio.

| Variable | Para qué | Secreta |
|---|---|---|
| `PORT` | Puerto local (en Cloud Run lo pone la plataforma: no se define). | No |
| `MONGODB_URI` | Cadena de conexión a MongoDB Atlas. | **Sí** |
| `ADMIN_EMAIL` | Email que obtiene el rol de administrador. | No |
| `APP_URL` | URL base de la app, sin barra final (`http://localhost:3000` en local). Se usa para el enlace del correo y el retorno de Google. | No |
| `BREVO_API_KEY` | Clave de API de Brevo (empieza por `xkeysib-`, no es la clave SMTP). | **Sí** |
| `MAIL_FROM` | Remitente verificado en Brevo. | No |
| `GOOGLE_CLIENT_ID` | ID del cliente OAuth de Google. | No |
| `GOOGLE_CLIENT_SECRET` | Secreto del cliente OAuth de Google. | **Sí** |

En Cloud Run, las variables secretas se guardan en **Secret Manager** y se referencian como variables de entorno; la cuenta de servicio de Cloud Run necesita el rol «Descriptor de acceso a secretos de Secret Manager».

## Acceso como administrador

La cuenta con el email configurado en `ADMIN_EMAIL` obtiene el rol `admin` al registrarse o, si ya existía, la próxima vez que inicie sesión (local o con Google). Si se registra con contraseña, debe confirmar el correo antes de entrar. En su panel aparece «Administración · Usuarios»: la lista de usuarios (email, rol, estado y si está activo) con un botón «Eliminar» en cada uno, y un buscador para comprobar si un usuario está activo.

Las credenciales de prueba del administrador se envían junto con la entrega, no se publican aquí.

## Funcionalidades

- **Registro y confirmación por correo.** La cuenta queda `pendiente` y se envía un enlace (`/api/confirmar?token=…`) válido 24 horas. Si caduca, al intentar entrar aparece «Reenviar correo de confirmación». Los correos a dominios de la universidad pueden quedar retenidos por su filtro: para probar, usa otro buzón.
- **Inicio de sesión con Google.** En Google Cloud, el cliente OAuth debe tener registradas exactamente `http://localhost:3000/api/auth/google/callback` y `<APP_URL>/api/auth/google/callback`. Mientras la pantalla de consentimiento esté en modo «Prueba», solo pueden entrar los usuarios de prueba añadidos. Si ya existía una cuenta local pendiente con ese email, se vincula y queda confirmada.
- **Sesión.** Cookie `HttpOnly` con sesión guardada en MongoDB durante 7 días: se mantiene al recargar y tras reiniciar el servidor.
- **Usuario activo.** Ha confirmado su correo o entró con Google, y no ha sido eliminado.
- **Eliminar cuenta.** Borrado lógico: la cuenta queda `eliminado`, no puede volver a iniciar sesión y se cierran sus sesiones. El mismo email puede registrarse de nuevo como cuenta nueva.
- **Errores.** Cada error se muestra junto al formulario que lo provocó; los errores inesperados del servidor devuelven un mensaje genérico en lugar de tumbar la aplicación. La actividad relevante se registra en el log con el prefijo `[LOG]`.

## Alianzas

Desde el panel, «Jugar a Alianzas». Eliges tu país y juegas contra 3 IAs (agresiva, diplomática y equilibrada) en un mapa de 12 x 12:

- Cada ronda dura 30 s: empieza con +2 puntos para todos (máximo 6) y un **turno de 10 s** en el que puedes actuar tantas veces como puntos tengas. Los 20 s siguientes nadie puede actuar. Si no actúas en tus 10 s, pierdes ese turno (los puntos se guardan).
- Cada país tiene 3 vidas. Cada acción cuesta 1 punto: **atacar** (quita 1 vida), **dar un punto**, **moverse** una casilla (también en diagonal, nunca a una ocupada) o **ampliar el radio**.
- La zona de acción (en azul) empieza siendo un cuadrado de 7 x 7; al ampliarla solo crecen los brazos hacia arriba, abajo y los lados.
- Haz click en una casilla contigua para moverte o en un país dentro de tu zona para atacarle o darle un punto.
- Un país sin vidas queda en el mapa con la bandera apagada y una ✖ roja. Gana el último en pie.
- La partida se guarda en MongoDB en cada ronda; «Guardar y pausar» la deja en pausa y «Reiniciar» empieza de cero con el mismo país. Si cierras la página, la partida se detiene sola y la continúas al volver.
- El panel y la parte inferior del tablero incluyen un tutorial con las reglas y los contadores.

Toda la lógica se ejecuta en el servidor (el navegador solo dibuja y consulta cada 500 ms). Decisiones D-14 a D-23 en [`docs/decisiones.md`](docs/decisiones.md).

## Flujo de trabajo y CI/CD

GitHub Flow: cada cambio en su rama, `npm test` en local, pull request contra `main` y merge con el CI en verde. GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) ejecuta las pruebas en cada PR y push a `main`; Cloud Run despliega automáticamente cada cambio que llega a `main`. Detalle en [`docs/procesos.md`](docs/procesos.md).

## Endpoint de la variante 2: normalización y validación de email

`POST /api/prueba/email` recibe un JSON con el campo `email`, elimina los espacios exteriores, lo pasa a minúsculas y valida su formato.

```json
{"email": " Ana@X.com "}
```

Respuesta válida (`200`):

```json
{"email": "ana@x.com"}
```

Si el email falta, no es una cadena o no cumple el formato (`400`):

```json
{"error": "EMAIL_INVALIDO"}
```
