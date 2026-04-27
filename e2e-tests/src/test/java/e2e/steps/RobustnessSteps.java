package e2e.steps;

import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.junit.Assume;

/**
 * Step definitions for robustness.feature.
 *
 * These scenarios test Electron-specific runtime behaviour (watchdog, ErrorBoundary,
 * Prisma backup/restore, stream reconnect, device-change events) that cannot be
 * exercised via Selenium against the renderer build.  Each step calls
 * {@code Assume.assumeTrue(false, reason)} so JUnit / Serenity marks the scenario
 * as SKIPPED (not FAILED), keeping the build green while the intent is preserved.
 */
public class RobustnessSteps {

    private static final String SKIP_REASON =
            "Requires a running Electron process – skipped in web/CI environment";

    // ── Stall recovery ──────────────────────────────────────────────────────────

    @Given("la aplicacion esta reproduciendo un track")
    public void laAplicacionEstaReproduciendoUnTrack() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @When("el playback no avanza durante mas de 3 segundos")
    public void elPlaybackNoAvanzaDuranteMasDe3Segundos() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @Then("se muestra un toast de {string}")
    public void seMuestraUnToastDe(String message) {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @And("el toast desaparece automaticamente despues de 6 segundos")
    public void elToastDesapareceAutomaticamenteDespuesDe6Segundos() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    // ── Error boundary ───────────────────────────────────────────────────────────

    @Given("la aplicacion esta abierta en el dashboard")
    public void laAplicacionEstaAbiertaEnElDashboard() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @When("un componente hijo lanza una excepcion")
    public void unComponenteHijoLanzaUnaExcepcion() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @Then("se muestra el panel de error con el boton {string}")
    public void seMuestraElPanelDeErrorConElBoton(String buttonLabel) {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @And("el resto de la app sigue siendo funcional al hacer click en {string}")
    public void elRestoDeLaAppSigueSiendoFuncionalAlHacerClickEn(String buttonLabel) {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    // ── Backup / restore ─────────────────────────────────────────────────────────

    @Given("existe una base de datos con datos del usuario")
    public void existeUnaBaseDeDatosConDatosDelUsuario() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @When("la app inicia y la migracion falla")
    public void laAppIniciaYLaMigracionFalla() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @Then("la app restaura automaticamente el ultimo backup")
    public void laAppRestaulaAutomaticamenteElUltimoBackup() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @And("el operador ve los datos previos a la migracion")
    public void elOperadorVeLosDatosPreviosALaMigracion() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    // ── Stream reconnect ─────────────────────────────────────────────────────────

    @Given("una salida Icecast esta conectada")
    public void unaSalidaIcecastEstaConectada() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @When("el servidor cierra la conexion abruptamente")
    public void elServidorCierraLaConexionAbruptamente() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @Then("la app reintenta conectar despues de 1s")
    public void laAppReintenstaConectarDespuesDe1s() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @And("ante segundo fallo reintenta despues de 2s")
    public void anteSegundoFalloReintenstaDesp() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @And("el delay maximo entre intentos no supera 60s")
    public void elDelayMaximoEntreIntentosNoSupera60s() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @And("al hacer disconnect manual la app no reintenta mas")
    public void alHacerDisconnectManualLaAppNoReintenaMas() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    // ── Device change ────────────────────────────────────────────────────────────

    @Given("una placa de audio externa esta conectada")
    public void unaPlacaDeAudioExternaEstaConectada() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @When("el operador desconecta la placa")
    public void elOperadorDesconectaLaPlaca() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @Then("la app detecta el cambio de dispositivos")
    public void laAppDetectaElCambioDeDispositivos() {
        Assume.assumeTrue(SKIP_REASON, false);
    }

    @And("ofrece seleccionar un dispositivo de salida alternativo")
    public void ofrecetSeleccionarUnDispositivoDeSalidaAlternativo() {
        Assume.assumeTrue(SKIP_REASON, false);
    }
}
