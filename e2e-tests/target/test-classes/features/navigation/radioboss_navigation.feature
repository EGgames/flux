Feature: Navegacion principal de FLUX
  Como operador
  Quiero abrir las pantallas principales desde navegador
  Para validar que la app renderiza las vistas base correctamente

  Background:
    Given el operador abre FLUX en el navegador

  Scenario Outline: Navegacion directa por hash route
    When navega a la ruta "<route>"
    Then debe ver el titulo "<title>"

    Examples:
      | route        | title              |
      | playout      | Playout            |
      | playlists    | Playlists          |
      | soundboard   | Soundboard         |
      | ad-breaks    | Tandas (Ad Breaks) |
      | programs     | Grilla Semanal     |
      | profiles     | Perfiles           |
      | integrations | Salidas de Audio   |

  Scenario: Navegacion desde sidebar a perfiles
    When hace click en la opcion "Perfiles" del menu lateral
    Then debe ver el titulo "Perfiles"
