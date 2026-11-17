---
type: Proceso
title: Flujo de trabajo, CI y despliegue
description: Evidencia comprobable del proceso Git y del workflow del repositorio.
timestamp: 2026-11-17
---

## Flujo de trabajo

La especificación prescribe GitHub Flow: rama por cambio, pruebas locales y merge mediante pull request. GitHub confirma que los PR #1–#11 están integrados. En la primera línea de `main`, `3652c8f` y `98cfa6f` preceden al PR #1. El commit `5551fa0` aparece en `main` antes del PR #10, no está asociado a un PR de la lista consultada y GitHub lo identifica con `web-flow` como committer: es evidencia de un commit directo mediante GitHub. Por ello, hay una desviación confirmada del flujo exigido de integrar cada cambio mediante PR.

`git tag` no mostró etiquetas. El commit `5551fa0` acredita una creación de commit mediante GitHub; no se puede determinar si hubo otras ediciones directas en la interfaz. `npm.cmd test` ejecutó correctamente la suite local; las instrucciones de ejecución están en el [README](../README.md).

## Integración continua

El workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

- se activa con `pull_request` y `push` a `main`;
- usa GitHub Actions en `ubuntu-latest` y una matriz de Node.js 18.x y 20.x;
- instala dependencias con `npm install` y ejecuta `npm test`.

La lista del [workflow en GitHub Actions](https://github.com/sdiaz23uclm/procesos2627/actions) devolvió **13 ejecuciones**, todas con estado completado y conclusión `success`, tanto para `pull_request` como para `push` a `main`.

## Despliegue continuo

La aplicación se despliega en Google Cloud Run (servicio `procesos26-27`, región `europe-southwest1`), accesible en https://procesos26-27-1061448815388.europe-southwest1.run.app. Cloud Run está conectado al repositorio de GitHub y compila y despliega automáticamente cada cambio que llega a `main`; las ejecuciones aparecen en «Historial de compilaciones» del servicio. Esta configuración vive en Google Cloud, no en el repositorio, y el despliegue no espera al resultado del CI (la especificación lo permite).

Las variables de entorno se configuran una vez en el servicio y las heredan todas las revisiones: `APP_URL`, `MAIL_FROM`, `ADMIN_EMAIL` y `GOOGLE_CLIENT_ID` como variables normales; `MONGODB_URI`, `BREVO_API_KEY` y `GOOGLE_CLIENT_SECRET` como referencias a Secret Manager. La cuenta de servicio de Cloud Run necesita el rol «Descriptor de acceso a secretos de Secret Manager»: sin él, la revisión falla al crearse (incidencia encontrada y resuelta el 2026-11-17).

## Hito 4: flujo seguido

Cada requisito se desarrolló en su propia rama con la decisión de diseño como primer commit (`docs/decisiones.md`), pruebas en local con `npm test` y PR contra `main`: `feature/RF-02-confirmacion-correo`, `feature/RF-04-oauth-google` y `feature/cierre-hito-4`. Por verificar: números de PR y ejecuciones del CI de cada rama.
