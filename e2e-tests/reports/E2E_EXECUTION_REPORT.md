# Reporte de Ejecucion E2E

## Fecha
2026-04-22

## Stack de automatizacion
- Serenity BDD
- Cucumber
- Selenium WebDriver
- Firefox
- Java

## Estado
Ejecutado con errores de entorno (app no levantada).

## Comando de ejecucion
```bash
mvn -f e2e-tests/pom.xml verify
```

## Resultado obtenido
- Maven compila y dispara Serenity + Cucumber correctamente.
- WebDriver Firefox inicia correctamente.
- Serenity ejecuta 8 escenarios y genera reporte HTML.
- Resultado de la corrida: `Tests run: 8, Failures: 0, Errors: 8, Skipped: 0`.
- Causa raiz de los 8 errores: no hay servidor web escuchando en `http://localhost:5173` al momento de la corrida.

Error raiz observado:
```
WebDriverException: Firefox can’t establish a connection to the server at localhost:5173
```

## Escenarios implementados
- Navegacion por rutas hash: `playout`, `playlists`, `soundboard`, `ad-breaks`, `programs`, `profiles`, `integrations`.
- Navegacion por sidebar: click en `Perfiles`.

## Reporte HTML Serenity
- Ruta esperada: `e2e-tests/target/site/serenity/index.html`
- Nota: si el build se corta por fallo de `failsafe:verify`, el agregado HTML puede no completarse.

Estado de agregacion en corrida real:
- Serenity generó reporte aunque el build terminó en `BUILD FAILURE` por `failsafe:verify`.
- Reporte generado en `e2e-tests/target/site/serenity/index.html`.
- Resumen informado por Serenity: `Test results for 8 tests`.

## Como dejarlo en verde
1. Levantar la app antes de ejecutar E2E (por ejemplo en otra terminal):
	```bash
	npm run dev
	```
2. Ejecutar E2E:
	```bash
	mvn -f e2e-tests/pom.xml verify
	```
3. Abrir reporte:
	- `e2e-tests/target/site/serenity/index.html`

## Notas
- Asegurate de tener la app corriendo en `http://localhost:5173` antes de ejecutar.
- Se puede cambiar URL con `-Dwebdriver.base.url=<url>`.
- Si queres solo regenerar HTML del ultimo run, usar:
	```bash
	npm run e2e:serenity:report
	```
