# procesos2627
Proyecto de Procesos de Ingeniería del Software curso 26-27

# Sprint 1: Desarrollar la arquitectura base del proyecto
Bienvenidos al Proyecto de Procesos 26-27!

# CloudSaaS Platform

Aplicación tipo SaaS (Software as a Service) desarrollada con arquitectura en capas, gestión de usuarios, roles (usuario y administrador), persistencia real en base de datos y diseño moderno[cite: 1, 2, 5, 8].

## Tecnologías Elegidas (y Justificación)
* **Node.js (con módulos nativos y arquitectura en capas)**: Elegido por su ligereza y eficiencia en la gestión de APIs HTTP asíncronas, permitiendo una separación limpia entre la capa API, la lógica de negocio y el acceso a datos[cite: 1, 2].
* **MongoDB Atlas**: Base de datos NoSQL en la nube elegida por su alta disponibilidad, gratuidad en capa inicial y facilidad de integración asíncrona mediante el driver oficial de Node.js.
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