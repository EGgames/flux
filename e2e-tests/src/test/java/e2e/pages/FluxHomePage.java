package e2e.pages;

import net.serenitybdd.core.pages.PageObject;
import net.serenitybdd.annotations.DefaultUrl;
import org.openqa.selenium.By;

@DefaultUrl("http://localhost:5173/#/playout")
public class FluxHomePage extends PageObject {

    public void openAtRoute(String route) {
        String normalized = route.startsWith("/") ? route.substring(1) : route;
        getDriver().get(baseUrl() + "/#/" + normalized);
    }

    public void clickSidebarOption(String option) {
        find(By.xpath("//a[normalize-space()='" + option + "']")).click();
    }

    public String pageTitle() {
        return find(By.xpath("//h1")).getText().trim();
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
}
