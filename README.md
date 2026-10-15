# procesos2627
Proyecto de Procesos de Ingeniería del Software curso 26-27

Bienvenidos al Proyecto de Procesos 26-27!

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