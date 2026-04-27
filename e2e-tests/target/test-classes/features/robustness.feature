# language: en
@robustness @smoke
Feature: Robustez operativa de FLUX
  Como operador de la radio
  Quiero que la app sea resiliente a errores y desconexiones
  Para que el aire no se corte

  @stall-recovery
  Scenario: Watchdog notifica stall y propone recuperacion
    Given la aplicacion esta reproduciendo un track
    When el playback no avanza durante mas de 3 segundos
    Then se muestra un toast de "Track sin progreso detectado"
    And el toast desaparece automaticamente despues de 6 segundos

  @error-boundary
  Scenario: ErrorBoundary captura crash de UI sin tirar la app
    Given la aplicacion esta abierta en el dashboard
    When un componente hijo lanza una excepcion
    Then se muestra el panel de error con el boton "Reintentar"
    And el resto de la app sigue siendo funcional al hacer click en "Reintentar"

  @backup-restore
  Scenario: Backup automatico antes de migracion fallida
    Given existe una base de datos con datos del usuario
    When la app inicia y la migracion falla
    Then la app restaura automaticamente el ultimo backup
    And el operador ve los datos previos a la migracion

  @stream-reconnect
  Scenario: Reconexion exponencial en stream caido
    Given una salida Icecast esta conectada
    When el servidor cierra la conexion abruptamente
    Then la app reintenta conectar despues de 1s
    And ante segundo fallo reintenta despues de 2s
    And el delay maximo entre intentos no supera 60s
    And al hacer disconnect manual la app no reintenta mas

  @device-change
  Scenario: Cambio de placa de audio durante operacion
    Given una placa de audio externa esta conectada
    When el operador desconecta la placa
    Then la app detecta el cambio de dispositivos
    And ofrece seleccionar un dispositivo de salida alternativo
