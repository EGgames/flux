#!/usr/bin/env bash
# ============================================================
# run-e2e.sh — Levanta Vite renderer, ejecuta Serenity E2E,
#              mata el servidor y sale con el código correcto.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
PORT=5173
TIMEOUT=60

# ---- 1. Matar cualquier proceso previo en el puerto --------
echo "[E2E] Liberando puerto $PORT si está ocupado..."
lsof -ti tcp:"$PORT" | xargs kill -9 2>/dev/null || true
sleep 1

# ---- 2. Arrancar Vite en background -------------------------
echo "[E2E] Iniciando Vite renderer en http://localhost:$PORT ..."
cd "$ROOT"
npx vite --config vite.config.e2e.ts &
VITE_PID=$!

# ---- 3. Esperar hasta que el servidor responda --------------
echo "[E2E] Esperando servidor (máx ${TIMEOUT}s)..."
ELAPSED=0
until curl -sf "http://localhost:$PORT" > /dev/null 2>&1; do
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "[E2E] ERROR: servidor no disponible tras ${TIMEOUT}s"
    kill "$VITE_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done
echo "[E2E] Servidor listo en ${ELAPSED}s"

# ---- 4. Ejecutar tests Serenity BDD -------------------------
E2E_EXIT=0
mvn -f "$ROOT/e2e-tests/pom.xml" verify \
  -Dwebdriver.base.url="http://localhost:$PORT" \
  || E2E_EXIT=$?

# ---- 5. Apagar Vite ----------------------------------------
echo "[E2E] Deteniendo servidor Vite (PID $VITE_PID)..."
kill "$VITE_PID" 2>/dev/null || true
wait "$VITE_PID" 2>/dev/null || true

echo "[E2E] Tests finalizados con código de salida: $E2E_EXIT"
exit "$E2E_EXIT"
