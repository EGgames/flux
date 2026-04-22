# Requirements — Requerimientos de Negocio

Este directorio contiene los requerimientos de negocio que están **listos para ser especificados** pero aún no tienen una spec generada.

## ¿Qué es un Requerimiento?

Un requerimiento es un documento que describe **qué necesita el negocio**, antes de que el `Spec Generator` lo convierta en una spec técnica ASDD. Es la entrada al pipeline ASDD.

## Lifecycle

```
requirements/<feature>.md  →  /generate-spec  →  specs/<feature>.spec.md
  (requerimiento de negocio)     (Spec Generator)    (especificación técnica)
```

## Cómo Usar

1. Crear un archivo `<feature>.md` en este directorio con la descripción del requerimiento
2. Ejecutar `/generate-spec` o usar `@Spec Generator` en Copilot Chat
3. Una vez generada la spec en `.github/specs/`, el requerimiento puede archivarse o eliminarse

## Convención de Nombres

```
.github/requirements/<nombre-feature-kebab-case>.md
```

## Requerimientos Pendientes

| Feature | Archivo | Estado |
|---------|---------|--------|
| Creación de Usuarios por Administrador | `user-creation.md` | LISTO PARA SPEC |
| Módulo de Conversiones | `conversiones.md` | LISTO PARA SPEC |

> Actualiza esta tabla al agregar o procesar requerimientos.
