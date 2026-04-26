# ADR 0002: Enrutado de Audio y EQ via MediaElementSource

## Estado
Aceptado

## Contexto
Para implementar ecualizadores (EQ) y vúmetros, necesitamos acceso al flujo de datos de audio. Howler.js por defecto usa audio HTML5 en modo "audio" simple. Para procesarlo, debemos usar `createMediaElementSource`. 

Sin embargo, al hacer esto, Chromium impone restricciones: si un elemento de audio está conectado a un `AudioContext`, ciertas operaciones como `setSinkId` (cambio de dispositivo de salida) pueden fallar con un `AbortError` si no se gestionan en el momento preciso del ciclo de vida del elemento.

## Decisión
1. **Captura Obligatoria**: Todo audio de Playout y Soundboard se conecta a un motor de Web Audio API compartido por perfil.
2. **Ciclo de Vida del SinkId**: La llamada a `setSinkId` se realiza **antes** de conectar el nodo a la cadena de Web Audio o inmediatamente después de asegurar que el `readyState` del elemento es `>= 2` (HAVE_CURRENT_DATA).
3. **Manejo de Excepciones**: Se implementa un wrapper sobre `setSinkId` que captura `AbortError` y reintenta la operación tras un breve delay o vuelve al dispositivo `default` en caso de fallo persistente catastrófico.

## Consecuencias
- **Positivas**: Permite EQ de 5 bandas en tiempo real y visualización estéreo profesional. Soporte nativo para múltiples tarjetas de sonido.
- **Negativas**: Aumenta la complejidad técnica del hook `usePlayout`. Riesgo de micro-cortes si el cambio de dispositivo falla y el reintento tarda demasiado.
