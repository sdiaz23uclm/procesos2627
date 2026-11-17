# procesos2627
Proyecto de Procesos de Ingeniería del Software curso 26-27

# Sprint 1: Desarrollar la arquitectura base del proyecto
Bienvenidos al Proyecto de Procesos 26-27!

# CloudSaaS Platform

Aplicación tipo SaaS (Software as a Service) desarrollada con arquitectura en capas, gestión de usuarios, roles (usuario y administrador), persistencia real en base de datos y diseño moderno[cite: 1, 2, 5, 8].

## Tecnologías Elegidas (y Justificación)
* **Node.js (con módulos nativos y arquitectura en capas)**: Elegido por su ligereza y eficiencia en la gestión de APIs HTTP asíncronas, permitiendo una separación limpia entre la capa API, la lógica de negocio y el acceso a datos[cite: 1, 2].
* **MongoDB Atlas**: Base de datos NoSQL en la nube elegida por su alta disponibilidad, gratuidad en capa inicial y facilidad de integración asíncrona mediante el driver oficial de Node.js.
* **Brevo**: servicio de correo transaccional con capa gratuita (300 correos/día) para enviar el enlace de confirmación de cuenta; se usa por API HTTP porque Cloud Run no permite SMTP directo.
* **Bcryptjs**: Seleccionado para garantizar la seguridad mediante el hashing seguro de contraseñas de usuario, evitando su almacenamiento en texto plano[cite: 2, 5].
* **HTML5 & CSS3 nativo (Vanilla)**: Utilizado para la interfaz visual y el cliente de red (`rest.js`), asegurando un diseño rápido, modular y sin sobrecarga de frameworks pesados[cite: 1, 2].

## Requisitos Previos
* Tener instalado [Node.js](https://nodejs.org/) (versión 18 o superior recomendada).
* Una cuenta activa en MongoDB Atlas con un clúster configurado[cite: 5].

## Configuración del Entorno
Crea un archivo `.env` en la raíz del proyecto basándote en el archivo de ejemplo `.env.example`:

```env
PORT=3000
MONGODB_URI=tu_cadena_de_conexion_de_mongodb_atlas
ADMIN_EMAIL=tu_correo_de_administrador@saas.com
APP_URL=http://localhost:3000
BREVO_API_KEY=tu_clave_de_api_de_brevo
MAIL_FROM=remitente_verificado_en_brevo@ejemplo.com
GOOGLE_CLIENT_ID=tu_client_id_de_google
GOOGLE_CLIENT_SECRET=tu_client_secret_de_google
```

* `APP_URL`: URL base usada para construir el enlace de confirmación (en producción, la URL pública de Cloud Run, sin barra final).
* `BREVO_API_KEY` y `MAIL_FROM`: clave de API de Brevo y remitente verificado en Brevo.
* `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`: credenciales del cliente OAuth (tipo «Aplicación web») creado en Google Cloud.
* En Cloud Run, `MONGODB_URI`, `BREVO_API_KEY` y `GOOGLE_CLIENT_SECRET` se guardan en Secret Manager y se referencian como variables de entorno.

## Confirmación de cuenta por correo
Al registrarse, la cuenta queda `pendiente` y se envía un correo con un enlace (`/api/confirmar?token=…`) válido 24 horas. Al abrirlo, la cuenta pasa a `confirmado` y ya se puede iniciar sesión. Si el enlace caduca, al intentar iniciar sesión aparece el botón «Reenviar correo de confirmación».

Los correos a dominios de la universidad pueden quedar retenidos por su filtro; para probar, usa otro buzón.

## Inicio de sesión con Google
El botón «Entrar con Google» usa OAuth 2.0 (flujo de código de autorización). En Google Cloud, el cliente OAuth debe tener registradas exactamente estas URI de redireccionamiento: `http://localhost:3000/api/auth/google/callback` (desarrollo) y `<APP_URL>/api/auth/google/callback` (producción). Si ya existía una cuenta local pendiente con el mismo email, se vincula y queda confirmada.

## Instalación y Ejecución

1. Clona el repositorio e instálate las dependencias situándote en la raíz del proyecto:
   ```bash
   npm install

    Configura tu archivo .env con los valores correspondientes (como se indica en la sección anterior).

    Ejecución: Arranca el servidor ejecutando el siguiente comando en la raíz:

    npm start

    (Esto pondrá en marcha la aplicación, normalmente accesible en http://localhost:3000).

Pruebas (Tests)

Para ejecutar la suite de pruebas del proyecto, utiliza el comando:

npm test

## Variante 2: normalización y validación de email

El endpoint público `POST /api/prueba/email` recibe un JSON con el campo `email`.
Elimina los espacios exteriores, convierte el email a minúsculas y valida su formato.

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