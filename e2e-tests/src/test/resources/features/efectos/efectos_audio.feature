Feature: Efectos de Audio (SPEC-004)
  Como operador de FLUX
  Quiero acceder al panel de Efectos de Audio
  Para configurar crossfade global, fades por tema y operar el Mixer DJ

  Background:
    Given el operador abre FLUX en el navegador

  Scenario: Acceso a la pagina de Efectos por hash route
    When navega a la ruta "efectos"
    Then debe ver un titulo que contiene "Efectos de Audio"

  Scenario: Acceso a la pagina de Efectos desde el sidebar
    When hace click en la opcion "Efectos" del menu lateral
    Then debe ver un titulo que contiene "Efectos de Audio"

  Scenario: La pagina renderiza el contenedor principal
    When navega a la ruta "efectos"
    Then debe ver el elemento con testid "audio-effects-page"
