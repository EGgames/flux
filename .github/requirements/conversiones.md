# Requerimiento: Módulo de Conversiones

## Descripción General

En el Dashboard existen 4 tarjetas KPI: `Usuarios Activos`, `Sesiones Hoy`, `Conversiones` e `Ingresos`. Actualmente la tarjeta **Conversiones** solo muestra un valor estático. Se necesita convertirla en un punto de entrada navegable hacia una pantalla dedicada que permita visualizar y gestionar las métricas de conversión.

## Problema / Necesidad

El equipo necesita una vista detallada de conversiones que vaya más allá del KPI resumido del dashboard. Hoy no existe forma de profundizar en los datos de conversión desde la interfaz.

## Solución Propuesta

### 1. Tarjeta de Conversiones navegable (Dashboard)

La tarjeta KPI `Conversiones` del `DashboardPage` debe comportarse como un botón de navegación. Al hacer clic, redirige al usuario a la ruta `/conversiones`.

- La tarjeta debe mantener su apariencia visual actual (valor, tendencia, ícono, color).
- Debe tener cursor pointer y un indicador visual sutil (hover/borde) que indique que es interactiva.
- La navegación debe usar `React Router` (`useNavigate`) sin recargar la página.

### 2. Página de Conversiones (`/conversiones`)

Nueva página protegida (requiere autenticación) que muestra el módulo completo de conversiones. Debe incluir:

#### 2.1 Encabezado
- Título: `Conversiones`
- Botón de regreso al Dashboard (`← Volver al Dashboard`).
- Fecha actual formateada (igual que el Dashboard).

#### 2.2 KPIs resumen (parte superior)
Cuatro métricas clave en tarjetas:
| KPI | Descripción |
|-----|-------------|
| `Tasa de Conversión` | Porcentaje de visitantes que completaron una acción objetivo |
| `Conversiones Totales` | Número absoluto de conversiones en el período |
| `Valor por Conversión` | Ingreso promedio generado por cada conversión |
| `Conversiones Nuevas` | Conversiones de usuarios que convierten por primera vez |

#### 2.3 Gráfico de tendencia
- Gráfico de línea con la evolución de conversiones en los últimos 30 días.
- Eje X: fechas. Eje Y: número de conversiones.

#### 2.4 Tabla de conversiones recientes
- Listado de las últimas conversiones registradas.
- Columnas: `Fecha`, `Usuario`, `Tipo de Conversión`, `Valor`, `Estado`.
- Estado posibles: `completada`, `pendiente`, `cancelada`.
- Paginación básica (10 registros por página).

#### 2.5 Distribución por tipo (opcional — fase 2)
- Gráfico de torta o barras con el desglose de conversiones por tipo.

## Contexto Técnico

- **Frontend:** React 19 + Vite + CSS Modules + React Router v6.
- **Ruta nueva:** `/conversiones` (protegida con `ProtectedRoute`).
- **Componente StatCard existente:** `frontend/src/components/StatCard.jsx` — se debe extender para soporte de `onClick`/`href` sin romper los otros 3 KPIs.
- **Datos:** Inicialmente pueden ser datos mock en el servicio `dashboardService.js` o un nuevo `conversionesService.js`. El backend puede implementarse en paralelo.
- **Auth:** Token `idToken` en header `Authorization: Bearer` para llamadas al backend.

## Criterios de Aceptación (Alto Nivel)

1. La tarjeta `Conversiones` del Dashboard es clickeable y navega a `/conversiones`.
2. La página `/conversiones` es accesible solo para usuarios autenticados.
3. La página muestra los 4 KPIs resumen con valores reales o mock coherentes.
4. La página incluye el gráfico de tendencia de los últimos 30 días.
5. La tabla de conversiones recientes muestra al menos 10 registros con paginación.
6. El botón `← Volver al Dashboard` regresa a `/dashboard`.
7. La UI es consistente con el diseño del Dashboard existente (mismo layout, CSS Modules, soporte dark mode).

## Restricciones

- No romper el comportamiento actual de los otros 3 StatCards (`Usuarios Activos`, `Sesiones Hoy`, `Ingresos`).
- Usar terminología canónica: `conversión` (no "transacción", "evento" o "lead").
- Timestamps en `snake_case` (`created_at`, `updated_at`).

## Prioridad

Alta — es parte del MVP del dashboard analítico.
