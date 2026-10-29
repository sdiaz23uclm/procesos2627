---
type: Proceso
title: Flujo de trabajo, CI y despliegue
description: Evidencia comprobable del proceso Git y del workflow del repositorio.
timestamp: 2026-10-28
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

El workflow revisado no incluye un paso de despliegue. Tampoco se encontró en los archivos del repositorio una URL pública o configuración del proveedor cloud. No se puede determinar desde este checkout si existe integración de despliegue configurada externamente: **Por verificar** en la configuración del proveedor y en GitHub.
