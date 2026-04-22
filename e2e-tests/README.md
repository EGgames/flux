# E2E Tests - Serenity BDD + Cucumber + Firefox

Este modulo contiene pruebas end-to-end en Java para FLUX usando:
- Serenity BDD
- Cucumber
- WebDriver Firefox
- Maven

## Requisitos

- Java 17+
- Maven 3.9+
- Firefox instalado
- Aplicacion levantada en `http://localhost:5173` (o configurar otra URL)

## Ejecutar tests E2E

Desde la raiz del repo:

```bash
mvn -f e2e-tests/pom.xml verify
```

Con URL personalizada:

```bash
mvn -f e2e-tests/pom.xml verify -Dwebdriver.base.url=http://localhost:4173
```

## Reporte Serenity

Al finalizar, el reporte HTML queda en:

- `e2e-tests/target/site/serenity/index.html`

Tambien puedes abrirlo directamente en navegador para revisar escenarios, steps, evidencias y fallas.
