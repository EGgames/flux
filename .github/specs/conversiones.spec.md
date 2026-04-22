---
id: SPEC-001
status: DRAFT
feature: conversiones
created: 2026-03-13
updated: 2026-03-13
author: spec-generator
version: "1.0"
related-specs: []
---

# Spec: Conversiones

> **Estado:** `DRAFT` → aprobar con `status: APPROVED` antes de iniciar implementación.
> **Ciclo de vida:** DRAFT → APPROVED → IN_PROGRESS → IMPLEMENTED → DEPRECATED

---

## 1. REQUERIMIENTOS

### Descripción
Esta funcionalidad convierte la tarjeta KPI de Conversiones del Dashboard en un punto de navegación hacia un módulo dedicado de análisis de conversión. El módulo permite visualizar KPIs, tendencia y conversiones recientes para que el Usuario autenticado pueda profundizar en métricas que hoy solo se muestran de forma resumida.

### Requerimiento de Negocio
Fuente principal: `.github/requirements/conversiones.md`.

Resumen del requerimiento base:
- La tarjeta KPI `Conversiones` del `Dashboard` debe ser clickeable y navegar a `/conversiones` sin recarga.
- Debe existir una nueva página protegida `/conversiones` con encabezado, 4 KPIs de resumen, gráfico de tendencia (30 días), tabla de conversiones recientes y paginación de 10 registros.
- La distribución por tipo se considera opcional para fase 2.
- Debe mantenerse consistencia visual con `Dashboard`, soporte de dark mode, y uso de terminología canónica.

### Historias de Usuario

#### HU-01: Navegar desde KPI de Conversiones al módulo dedicado

```
Como:        Usuario autenticado
Quiero:      hacer clic en la tarjeta Conversiones del Dashboard
Para:        acceder rápidamente a una vista detallada de conversiones

Prioridad:   Alta
Estimación:  S
Dependencias: Ninguna
Capa:        Frontend
```

#### Criterios de Aceptación — HU-01

**Happy Path**
```gherkin
CRITERIO-1.1: Navegación desde tarjeta Conversiones
  Dado que:  el Usuario autenticado está en /dashboard y visualiza la tarjeta KPI Conversiones
  Cuando:    hace clic sobre la tarjeta Conversiones
  Entonces:  el sistema navega a /conversiones usando React Router sin recargar la página
  Y:         la tarjeta mantiene su apariencia (valor, tendencia, ícono, color)
```

**Error Path**
```gherkin
CRITERIO-1.2: Intento de acceso sin autenticación
  Dado que:  un Usuario no autenticado intenta abrir /conversiones
  Cuando:    ProtectedRoute evalúa el estado de sesión
  Entonces:  el sistema redirige a /login
  Y:         no renderiza datos de conversiones
```

**Edge Case** *(si aplica)*
```gherkin
CRITERIO-1.3: No afectar otros KPIs del Dashboard
  Dado que:  existen también las tarjetas Usuarios Activos, Sesiones Hoy e Ingresos
  Cuando:    se habilita comportamiento interactivo para Conversiones
  Entonces:  las otras tres tarjetas conservan su comportamiento actual sin navegación obligatoria
```

#### HU-02: Visualizar panel de conversiones con resumen, tendencia y listado

```
Como:        Usuario autenticado
Quiero:      consultar una pantalla de conversiones con información consolidada
Para:        analizar desempeño del embudo y tomar decisiones operativas

Prioridad:   Alta
Estimación:  M
Dependencias: HU-01
Capa:        Ambas
```

#### Criterios de Aceptación — HU-02

**Happy Path**
```gherkin
CRITERIO-2.1: Renderizar módulo principal de Conversiones
  Dado que:  el Usuario autenticado accede a /conversiones
  Cuando:    la página finaliza la carga de datos
  Entonces:  se muestran el encabezado, la fecha actual formateada y el botón "← Volver al Dashboard"
  Y:         se renderizan 4 KPIs: Tasa de Conversión, Conversiones Totales, Valor por Conversión y Conversiones Nuevas
  Y:         se visualiza un gráfico de línea con tendencia de los últimos 30 días
  Y:         se muestra una tabla con columnas Fecha, Usuario, Tipo de Conversión, Valor y Estado
```

**Error Path**
```gherkin
CRITERIO-2.2: Manejo de error al consultar datos
  Dado que:  el Usuario autenticado está en /conversiones
  Cuando:    falla la consulta de datos por backend no disponible o token inválido
  Entonces:  el sistema muestra mensaje de error entendible para el Usuario
  Y:         no rompe el layout de la página
  Y:         para token inválido, la API responde 401 con detail descriptivo
```

**Edge Case** *(si aplica)*
```gherkin
CRITERIO-2.3: Estado vacío en conversiones recientes
  Dado que:  el servicio responde sin registros de conversiones recientes
  Cuando:    se renderiza la tabla
  Entonces:  se muestra estado vacío con texto informativo
  Y:         la paginación permanece deshabilitada en página 1
```

#### HU-03: Paginar conversiones recientes y mantener filtros de estado válidos

```
Como:        Usuario autenticado
Quiero:      navegar entre páginas de conversiones recientes
Para:        revisar histórico sin sobrecargar la interfaz

Prioridad:   Alta
Estimación:  S
Dependencias: HU-02
Capa:        Ambas
```

#### Criterios de Aceptación — HU-03

**Happy Path**
```gherkin
CRITERIO-3.1: Paginación básica de 10 registros
  Dado que:  existen más de 10 conversiones recientes
  Cuando:    el Usuario avanza de página
  Entonces:  el sistema consulta y muestra el siguiente bloque de 10 registros
  Y:         conserva las columnas y formato definidos
```

**Error Path**
```gherkin
CRITERIO-3.2: Parámetros inválidos de paginación
  Dado que:  un cliente envía page < 1 o limit fuera de rango permitido
  Cuando:    el backend valida parámetros de consulta
  Entonces:  responde HTTP 422 por validación de FastAPI
  Y:         no ejecuta consulta en la colección
```

**Edge Case** *(si aplica)*
```gherkin
CRITERIO-3.3: Estado fuera de catálogo
  Dado que:  una conversión tiene estado distinto de completada, pendiente o cancelada
  Cuando:    se intenta persistir o exponer el registro
  Entonces:  el backend rechaza el dato con HTTP 400
  Y:         retorna detail indicando catálogo de estados permitido
```

#### HU-04: Visualizar distribución por tipo de conversión (fase 2 opcional)

```
Como:        Usuario autenticado
Quiero:      visualizar la distribución por tipo de conversión
Para:        identificar qué tipo aporta mayor volumen

Prioridad:   Media
Estimación:  S
Dependencias: HU-02
Capa:        Ambas
```

#### Criterios de Aceptación — HU-04

**Happy Path**
```gherkin
CRITERIO-4.1: Mostrar distribución por tipo cuando esté habilitada fase 2
  Dado que:  la fase 2 está habilitada en la configuración del módulo
  Cuando:    el Usuario accede a /conversiones
  Entonces:  se muestra gráfico de torta o barras con desglose por tipo de conversión
```

**Error Path**
```gherkin
CRITERIO-4.2: Falla de datos de distribución
  Dado que:  la fase 2 está habilitada
  Cuando:    falla la consulta del endpoint de distribución
  Entonces:  el módulo oculta el gráfico de distribución
  Y:         mantiene disponibles KPIs, tendencia y tabla
```

**Edge Case** *(si aplica)*
```gherkin
CRITERIO-4.3: Fase 2 deshabilitada
  Dado que:  la fase 2 no está habilitada
  Cuando:    el Usuario accede a /conversiones
  Entonces:  el sistema no muestra bloque de distribución por tipo
  Y:         no realiza llamada al endpoint de distribución
```

### Reglas de Negocio
1. Solo Usuario autenticado puede acceder al módulo de Conversiones y consumir endpoints protegidos con `Authorization: Bearer <idToken>`.
2. Los estados permitidos para una conversión son `completada`, `pendiente` y `cancelada`.
3. `Dashboard` permanece como vista de resumen; la exploración detallada ocurre en `/conversiones`.
4. Paginación estándar de conversiones recientes: `limit=10` por defecto y `page` inicia en 1.
5. Timestamps del dominio deben mantenerse en `snake_case`: `created_at` y `updated_at`.
6. El atributo `uid` corresponde al UID de Firebase del Usuario asociado a la conversión.
7. La distribución por tipo de conversión es opcional y queda explícitamente fuera del entregable obligatorio de fase 1.

---

## 2. DISEÑO

### Modelos de Datos

#### Entidades afectadas
| Entidad | Almacén | Cambios | Descripción |
|---------|---------|---------|-------------|
| `conversion` | colección `conversiones` | nueva | Registro individual de conversión asociado a un Usuario |
| `conversion_summary` | agregado calculado | nueva (vista lógica) | Métricas consolidadas para tarjetas KPI del módulo |

#### Campos del modelo
| Campo | Tipo | Obligatorio | Validación | Descripción |
|-------|------|-------------|------------|-------------|
| `uid` | string | sí | UID válido Firebase | Identificador de la conversión (API) |
| `user_uid` | string | sí | UID válido Firebase | Usuario relacionado a la conversión |
| `conversion_type` | string | sí | max 100 chars | Tipo de conversión |
| `status` | string | sí | `completada` \| `pendiente` \| `cancelada` | Estado de la conversión |
| `value` | number | sí | `>= 0` | Valor monetario de la conversión |
| `occurred_at` | datetime (UTC) | sí | ISO 8601 | Fecha/hora efectiva de la conversión |
| `created_at` | datetime (UTC) | sí | auto-generado | Timestamp creación |
| `updated_at` | datetime (UTC) | sí | auto-generado | Timestamp actualización |

#### Índices / Constraints
- Índice compuesto `{ occurred_at: -1, status: 1 }` para optimizar tendencia y tabla reciente.
- Índice `{ user_uid: 1 }` para consultas por Usuario.
- Índice `{ conversion_type: 1 }` para agregación opcional de fase 2 (distribución por tipo).

### API Endpoints

#### GET /api/v1/conversiones/summary
- **Descripción**: Obtiene KPIs resumen del módulo de Conversiones.
- **Auth requerida**: sí (`idToken` Firebase).
- **Request Query**:
  - `from` (opcional, ISO date)
  - `to` (opcional, ISO date)
- **Response 200**:
  ```json
  {
    "conversion_rate": 12.4,
    "total_conversions": 312,
    "avg_value_per_conversion": 91.2,
    "new_conversions": 74
  }
  ```
- **Response 401**: token ausente o inválido (`detail`).
- **Response 422**: fechas inválidas.

#### GET /api/v1/conversiones/trend
- **Descripción**: Devuelve serie temporal de conversiones para los últimos 30 días (default).
- **Auth requerida**: sí.
- **Request Query**:
  - `days` (opcional, default `30`, rango `1..90`)
- **Response 200**:
  ```json
  {
    "data": [
      { "date": "2026-02-12", "total": 8 },
      { "date": "2026-02-13", "total": 11 }
    ]
  }
  ```
- **Response 401**: token ausente o inválido.
- **Response 422**: parámetro `days` fuera de rango.

#### GET /api/v1/conversiones/recent
- **Descripción**: Lista conversiones recientes con paginación.
- **Auth requerida**: sí.
- **Request Query**:
  - `page` (opcional, default `1`, min `1`)
  - `limit` (opcional, default `10`, max `50`)
- **Response 200**:
  ```json
  {
    "data": [
      {
        "uid": "conv_001",
        "user_uid": "firebase_uid_123",
        "conversion_type": "suscripcion",
        "value": 120.0,
        "status": "completada",
        "occurred_at": "2026-03-12T18:20:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 128,
      "total_pages": 13
    }
  }
  ```
- **Response 401**: token ausente o inválido.
- **Response 422**: `page`/`limit` inválidos.

#### GET /api/v1/conversiones/distribution
- **Descripción**: Distribución por tipo de conversión (fase 2 opcional).
- **Auth requerida**: sí.
- **Response 200**:
  ```json
  {
    "data": [
      { "conversion_type": "suscripcion", "total": 120 },
      { "conversion_type": "renovacion", "total": 82 }
    ]
  }
  ```
- **Response 401**: token ausente o inválido.
- **Response 404**: módulo fase 2 deshabilitado (opcional según configuración).

### Diseño Frontend

#### Componentes nuevos
| Componente | Archivo | Props principales | Descripción |
|------------|---------|------------------|-------------|
| `ConversionesRecentTable` | `frontend/src/components/ConversionesRecentTable.jsx` | `rows, pagination, onPageChange, loading` | Tabla de conversiones recientes con paginación |
| `ConversionesTrendChart` | `frontend/src/components/charts/ConversionesTrendChart.jsx` | `data, loading` | Gráfico de línea para tendencia diaria |
| `ConversionesDistributionChart` *(fase 2)* | `frontend/src/components/charts/ConversionesDistributionChart.jsx` | `data, loading` | Gráfico de distribución por tipo |

#### Páginas nuevas
| Página | Archivo | Ruta | Protegida |
|--------|---------|------|-----------|
| `ConversionesPage` | `frontend/src/pages/ConversionesPage.jsx` | `/conversiones` | sí |

#### Hooks y State
| Hook | Archivo | Retorna | Descripción |
|------|---------|---------|-------------|
| `useConversiones` | `frontend/src/hooks/useConversiones.js` | `{ summary, trend, recent, pagination, loading, error, loadPage }` | Orquesta carga de datos del módulo de Conversiones |

#### Services (llamadas API)
| Función | Archivo | Endpoint |
|---------|---------|---------|
| `getConversionesSummary(token, params)` | `frontend/src/services/conversionesService.js` | `GET /api/v1/conversiones/summary` |
| `getConversionesTrend(token, params)` | `frontend/src/services/conversionesService.js` | `GET /api/v1/conversiones/trend` |
| `getConversionesRecent(token, params)` | `frontend/src/services/conversionesService.js` | `GET /api/v1/conversiones/recent` |
| `getConversionesDistribution(token)` *(fase 2)* | `frontend/src/services/conversionesService.js` | `GET /api/v1/conversiones/distribution` |

#### Ajustes sobre componentes existentes
- Extender `StatCard` para aceptar `onClick` opcional y atributos de accesibilidad de elemento interactivo.
- En `DashboardPage`, habilitar interacción únicamente para KPI con `id = "conversiones"`.
- Registrar ruta protegida `/conversiones` en `App.jsx` con `ProtectedRoute`.

### Arquitectura y Dependencias
- Paquetes nuevos requeridos: ninguno obligatorio para fase 1 (se reutilizan React 19, React Router, CSS Modules y librería de gráficas existente).
- Servicios externos: Firebase Auth para validar `idToken` y proteger endpoints backend.
- Impacto en punto de entrada:
  - Backend: registrar `conversiones_router` en `backend/app/main.py`.
  - Frontend: registrar ruta `/conversiones` en `frontend/src/App.jsx`.

### Notas de Implementación
- Fase 1 permite uso de datos mock en frontend mientras backend se desarrolla en paralelo.
- Si backend no está disponible, el módulo debe soportar fallback controlado (estado de carga/error/empty) sin bloquear navegación.
- La ruta de `Dashboard` continúa de solo lectura; el módulo de Conversiones agrega exploración analítica y no modifica entidades existentes.

---

## 3. LISTA DE TAREAS

> Checklist accionable para todos los agentes. Marcar cada ítem (`[x]`) al completarlo.
> El Orchestrator monitorea este checklist para determinar el progreso.

### Backend

#### Implementación
- [ ] Crear `conversiones_model.py` con schemas `ConversionSummaryResponse`, `ConversionTrendResponse`, `ConversionRecentResponse` y documento de conversión
- [ ] Crear `conversiones_repository.py` con consultas agregadas para resumen, tendencia y recientes paginados
- [ ] Crear `conversiones_service.py` con reglas de negocio y validaciones de parámetros
- [ ] Crear `conversiones_router.py` con endpoints `/api/v1/conversiones/summary`, `/trend`, `/recent`
- [ ] Registrar router en `backend/app/main.py`
- [ ] Implementar endpoint `/api/v1/conversiones/distribution` como alcance opcional de fase 2

#### Tests Backend
- [ ] `test_get_summary_success` — retorna KPIs de conversiones
- [ ] `test_get_trend_default_30_days_success` — retorna serie de 30 días
- [ ] `test_get_recent_pagination_success` — retorna 10 registros por defecto con metadatos
- [ ] `test_get_recent_invalid_page_returns_422` — validación de query param
- [ ] `test_get_conversiones_without_token_returns_401` — auth requerida
- [ ] `test_distribution_disabled_returns_404` — comportamiento fase 2 deshabilitada

### Frontend

#### Implementación
- [ ] Extender `StatCard` para modo interactivo sin romper KPIs existentes
- [ ] Actualizar `DashboardPage` para navegación a `/conversiones` desde KPI Conversiones
- [ ] Crear `conversionesService.js` para consumo de endpoints de conversiones
- [ ] Crear `useConversiones.js` para estado, carga y paginación
- [ ] Crear `ConversionesPage.jsx` + `ConversionesPage.module.css` con layout consistente con Dashboard
- [ ] Crear componentes de tabla y gráfico de tendencia para módulo Conversiones
- [ ] Registrar ruta protegida `/conversiones` en `frontend/src/App.jsx`
- [ ] Implementar distribución por tipo como bloque opcional de fase 2

#### Tests Frontend
- [ ] `StatCard navigates only when onClick is provided`
- [ ] `DashboardPage routes to /conversiones when KPI conversiones is clicked`
- [ ] `ConversionesPage blocks access when user is unauthenticated`
- [ ] `ConversionesPage renders 4 KPI cards with service data`
- [ ] `ConversionesRecentTable paginates with 10 rows per page`
- [ ] `ConversionesPage shows fallback error state on service failure`

### QA
- [ ] Ejecutar skill `/gherkin-case-generator` para HU-01 a HU-04
- [ ] Ejecutar skill `/risk-identifier` y clasificar riesgos ASD
- [ ] Validar cobertura de criterios happy path, validaciones y errores
- [ ] Verificar no regresión en tarjetas KPI existentes del Dashboard
- [ ] Verificar protección de ruta `/conversiones` con sesión no autenticada
- [ ] Confirmar alcance fase 1 vs fase 2 (distribución por tipo opcional)
- [ ] Actualizar estado spec según avance del flujo ASDD
