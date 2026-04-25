package e2e.steps;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import net.serenitybdd.annotations.Managed;
import org.assertj.core.api.Assertions;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

public class NavigationSteps {

    @Managed(driver = "firefox")
    WebDriver driver;

    @Given("el operador abre FLUX en el navegador")
    public void elOperadorAbreFluxEnElNavegador() {
        driver.get(baseUrl() + "/#/playout");
        waitForTitle();
    }

    @When("navega a la ruta {string}")
    public void navegaALaRuta(String route) {
        String normalized = route.startsWith("/") ? route.substring(1) : route;
        driver.get(baseUrl() + "/#/" + normalized);
        waitForTitle();
    }

    @When("hace click en la opcion {string} del menu lateral")
    public void haceClickEnLaOpcionDelMenuLateral(String option) {
        driver.findElement(By.xpath("//a[contains(normalize-space(),'" + option + "')]")).click();
        waitForTitle();
    }

    @Then("debe ver el titulo {string}")
    public void debeVerElTitulo(String expectedTitle) {
        WebElement heading = driver.findElement(By.xpath("//h1"));
        Assertions.assertThat(heading.getText().trim())
            .as("Titulo visible en la pagina")
            .isEqualTo(expectedTitle);
    }

    @Then("debe ver un titulo que contiene {string}")
    public void debeVerUnTituloQueContiene(String expectedFragment) {
        WebElement heading = driver.findElement(By.xpath("//h1 | //h2"));
        Assertions.assertThat(heading.getText())
            .as("Titulo visible en la pagina contiene fragmento")
            .containsIgnoringCase(expectedFragment);
    }

    @Then("debe ver el elemento con testid {string}")
    public void debeVerElElementoConTestid(String testId) {
        WebElement el = new WebDriverWait(driver, Duration.ofSeconds(10))
            .until(ExpectedConditions.visibilityOfElementLocated(
                By.cssSelector("[data-testid='" + testId + "']")));
        Assertions.assertThat(el.isDisplayed())
            .as("Elemento con data-testid='" + testId + "' visible")
            .isTrue();
    }

    private String baseUrl() {
        String property = System.getProperty("webdriver.base.url");
        if (property != null && !property.isBlank()) {
            return property;
        }
        String env = System.getenv("WEBDRIVER_BASE_URL");
        if (env != null && !env.isBlank()) {
            return env;
        }
        return "http://localhost:5173";
    }

    private void waitForTitle() {
        new WebDriverWait(driver, Duration.ofSeconds(10))
            .until(ExpectedConditions.visibilityOfElementLocated(By.xpath("//h1 | //h2")));
    }
}
