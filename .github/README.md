# ASDD Framework — Guía de Uso (GitHub Copilot)

**ASDD** (Agent Spec Software Development) es un framework de desarrollo asistido por IA que organiza el trabajo de software en cinco fases orquestadas por agentes especializados.

```
Requerimiento → Spec → [Backend ∥ Frontend ∥ DB] → [Tests BE ∥ Tests FE] → QA → Doc (opcional)
```

> Esta guía cubre el uso con **GitHub Copilot Chat** en VS Code.
> Para uso con **Claude Code CLI**, ver `.claude/README.md`.

---

## Requisitos

| Requisito | Detalle |
|---|---|
| VS Code | Cualquier versión reciente |
| GitHub Copilot Chat | Extensión instalada y activa |
| Setting habilitado | `github.copilot.chat.codeGeneration.useInstructionFiles: true` |

El archivo `.vscode/settings.json` ya configura el auto-descubrimiento de agentes, skills e instructions. Si no existe, créalo con las rutas correspondientes a `.github/`.

---

## Onboarding — nuevo proyecto

Al copiar `.github/` y `docs/` a un proyecto nuevo, completa estos archivos **en orden** antes de usar cualquier agente:

| # | Archivo | Qué escribir |
|---|---------|-------------|
| 1 | `README.md` (raíz del proyecto) | Stack, arquitectura, comandos (`install`, `dev`, `test`, `build`), variables de entorno |
| 2 | `.claude/rules/backend.md + frontend.md` | Lenguaje, framework, base de datos, herramientas aprobadas |
| 3 | `.claude/rules/backend.md + frontend.md` | Capas, módulos, bounded contexts |
| 4 | `CLAUDE.md (Diccionario de Dominio)` | Términos canónicos del negocio (glosario) |
| 5 | `CLAUDE.md` (DoR + DoD ya incluidos) | Criterios DoR y DoD del equipo |

Una vez completados, los agentes tienen todo el contexto para operar de forma autónoma.

**No modificar**: `agents/`, `skills/`, `instructions/`, `.github/docs/lineamientos/`, `copilot-instructions.md`, `AGENTS.md`

---

## El flujo ASDD paso a paso

### Paso 1 — Spec (obligatorio, siempre primero)

Genera la especificación técnica antes de escribir código:

```
@Spec Generator genera la spec para: [tu requerimiento]
```
```
/generate-spec <nombre-feature>
```

El agente valida el requerimiento y genera `specs/<feature>.spec.md` con estado `DRAFT`.
Revisa y aprueba la spec (cambia a `APPROVED`) antes de continuar.

---

### Paso 2 — Implementación (paralelo)

Con la spec `APPROVED`, lanza backend, frontend y base de datos en paralelo:

```
@Backend Developer implementa specs/<feature>.spec.md
@Frontend Developer implementa specs/<feature>.spec.md
@Database Agent diseña el modelo de datos para specs/<feature>.spec.md
```

O con el Orchestrator para coordinar todo automáticamente:
```
@Orchestrator ejecuta el flujo completo para: [tu requerimiento]
```

> **Database Agent** solo es necesario si hay cambios en el modelo de datos.

---

### Paso 3 — Tests (paralelo)

Con la implementación completa, genera los tests:

```
@Test Engineer Backend genera tests para specs/<feature>.spec.md
@Test Engineer Frontend genera tests para specs/<feature>.spec.md
```
```
/unit-testing <nombre-feature>
```

---

### Paso 4 — QA

Con tests completos, ejecuta la estrategia QA:

```
@QA Agent ejecuta QA para specs/<feature>.spec.md
```

El agente genera: casos Gherkin, matriz de riesgos y (si hay SLAs) plan de performance.

---

### Paso 5 — Documentación *(opcional)*

Al cerrar el feature:

```
@Documentation Agent documenta el feature specs/<feature>.spec.md
```

---

### Flujo completo con Orchestrator

```
@Orchestrator ejecuta el flujo completo para: [tu requerimiento]
```
```
/asdd-orchestrate <nombre-feature>
```

---

## Agentes disponibles (`@nombre` en Copilot Chat)

| Agente | Fase | Cuándo usarlo |
|---|---|---|
| `@Orchestrator` | Entry point | Coordinar el flujo completo (`/asdd-orchestrate status` para ver estado) |
| `@Spec Generator` | Fase 1 | Validar un requerimiento y generar su spec técnica |
| `@Backend Developer` | Fase 2 ∥ | Implementar el backend según la spec |
| `@Frontend Developer` | Fase 2 ∥ | Implementar el frontend según la spec |
| `@Database Agent` | Fase 2 ∥ | Diseñar modelos de datos, migrations y seeders |
| `@Test Engineer Backend` | Fase 3 ∥ | Generar tests para el backend (paralelo con Frontend) |
| `@Test Engineer Frontend` | Fase 3 ∥ | Generar tests para el frontend (paralelo con Backend) |
| `@QA Agent` | Fase 4 | Gherkin, riesgos y análisis de performance |
| `@Documentation Agent` | Fase 5 | README, API docs y ADRs |

---

## Skills disponibles (`/comando` en Copilot Chat)

| Comando | Agente | Qué hace |
|---|---|---|
| `/asdd-orchestrate` | Orchestrator | Orquesta el flujo completo o muestra estado actual |
| `/generate-spec` | Spec Generator | Genera spec técnica con validación INVEST/IEEE 830 |
| `/implement-backend` | Backend Developer | Implementa feature completo en el backend |
| `/implement-frontend` | Frontend Developer | Implementa feature completo en el frontend |
| `/unit-testing` | Test Engineers | Genera suite de tests (backend + frontend) |
| `/gherkin-case-generator` | QA Agent | Flujos críticos + casos Given-When-Then + datos de prueba |
| `/risk-identifier` | QA Agent | Matriz de riesgos ASD (Alto/Medio/Bajo) |
| `/automation-flow-proposer` | QA Agent | Propone flujos a automatizar con estimación de ROI |
| `/performance-analyzer` | QA Agent | Planifica pruebas de carga y performance |

---

## Prompts disponibles (`/nombre` en Copilot Chat)

Alternativa rápida a invocar agentes directamente:

| Comando | Cuándo usarlo |
|---|---|
| `/generate-spec` | Crear una nueva spec desde un requerimiento |
| `/backend-task` | Implementar una spec en el backend |
| `/frontend-task` | Implementar una spec en el frontend |
| `/db-task` | Diseñar esquema de datos, migrations y seeders |
| `/generate-tests` | Generar tests para una spec o módulo existente |
| `/qa-task` | Ejecutar el flujo QA (Gherkin + riesgos + performance) |
| `/doc-task` | Generar documentación técnica del feature |
| `/full-flow` | Orquestar todas las fases de principio a fin |

---

## Instructions automáticas (sin intervención manual)

Inyectadas automáticamente por Copilot cuando el archivo activo coincide:

| Archivo activo | Instructions aplicadas |
|---|---|
| `backend/**/*.py` (o equivalente) | `instructions/backend.instructions.md` |
| `frontend/src/**/*.{js,jsx}` (o equivalente) | `instructions/frontend.instructions.md` |
| `backend/tests/**` / `frontend/src/__tests__/**` | `instructions/tests.instructions.md` |

> Si el proyecto usa otro stack, ajusta los patrones `applyTo:` de cada archivo.

---

## Lineamientos de referencia

Cargados automáticamente por los agentes:

| Documento | Contenido |
|---|---|
| `.github/docs/lineamientos/dev-guidelines.md` | Clean Code, SOLID, API REST, Seguridad, Observabilidad |
| `.github/docs/lineamientos/qa-guidelines.md` | Estrategia QA, Gherkin, Riesgos, Automatización, Performance |
| `.github/docs/lineamientos/guidelines.md` | Referencia rápida de estándares: código, tests, API, Git |

---

## Estructura de carpetas

```
Project Root/
│
├── docs/output/                     ← artefactos generados por los agentes
│   ├── qa/                          ← Gherkin, riesgos, performance
│   ├── api/                         ← documentación de API
│   └── adr/                         ← Architecture Decision Records
│
└── .github/                         ← framework Copilot (auto-contenido para compartir)
    ├── README.md                    ← este archivo
    ├── AGENTS.md                    ← reglas críticas para todos los agentes
    ├── copilot-instructions.md      ← siempre activo en Copilot Chat
    │
    ├── agents/                      ← 9 agentes (@nombre en Copilot Chat)
    │   ├── orchestrator.agent.md
    │   ├── spec-generator.agent.md
    │   ├── backend-developer.agent.md
    │   ├── frontend-developer.agent.md
    │   ├── database.agent.md
    │   ├── test-engineer-backend.agent.md
    │   ├── test-engineer-frontend.agent.md
    │   ├── qa.agent.md
    │   └── documentation.agent.md
    │
    ├── skills/                      ← 9 skills (/comando en Copilot Chat)
    │   ├── asdd-orchestrate/
    │   ├── generate-spec/
    │   ├── implement-backend/
    │   ├── implement-frontend/
    │   ├── unit-testing/
    │   ├── gherkin-case-generator/
    │   ├── risk-identifier/
    │   ├── automation-flow-proposer/
    │   └── performance-analyzer/
    │
    ├── docs/lineamientos/           ← guidelines del framework (incluidos al compartir)
    │   ├── dev-guidelines.md
    │   └── qa-guidelines.md
    │
    ├── prompts/                     ← 8 prompts (/nombre en Copilot Chat)
    │
    ├── instructions/                ← aplicadas automáticamente por contexto de archivo
    │   ├── backend.instructions.md  ← applyTo: backend/**
    │   ├── frontend.instructions.md ← applyTo: frontend/src/**
    │   └── tests.instructions.md   ← applyTo: tests/**
    │
    ├── requirements/                ← requerimientos de negocio (input del pipeline)
    │   └── <feature>.md
    │
    └── specs/                       ← specs técnicas (fuente de verdad)
        └── <feature>.spec.md        ← DRAFT → APPROVED → IN_PROGRESS → IMPLEMENTED
```

---

## Reglas de Oro

1. **No código sin spec aprobada** — siempre debe existir `specs/<feature>.spec.md` con estado `APPROVED`.
2. **No código no autorizado** — los agentes no generan ni modifican código sin instrucción explícita.
3. **No suposiciones** — si el requerimiento es ambiguo, el agente pregunta antes de actuar.
4. **Transparencia** — el agente explica qué va a hacer antes de hacerlo.
