package dev.nortech.norpress.shared.adapter;
import dev.nortech.norpress.shared.application.HumanCheck;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/** Cloudflare Turnstile, checked on the server. The secret comes from the environment (NORPRESS_TURNSTILE_SECRET), never from the database. */
@ApplicationScoped
public class CloudflareTurnstile implements HumanCheck {
    private static final Logger LOG = Logger.getLogger(CloudflareTurnstile.class);
    private static final URI VERIFY = URI.create("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    private static final ObjectMapper JSON = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    @ConfigProperty(name = "norpress.turnstile.secret") Optional<String> secret;

    public boolean enabled() { return secret.filter(s -> !s.isBlank()).isPresent(); }

    public boolean verify(String token, String clientAddress) {
        if (token == null || token.isBlank() || token.length() > 2048) return false;
        var fields = new LinkedHashMap<String, String>();
        fields.put("secret", secret.orElse(""));
        fields.put("response", token);
        if (clientAddress != null && !clientAddress.isBlank()) fields.put("remoteip", clientAddress);
        try {
            var request = HttpRequest.newBuilder(VERIFY).timeout(Duration.ofSeconds(8))
                .header("Content-Type", "application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(form(fields))).build();
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) { LOG.warnf("Turnstile respondió %d", response.statusCode()); return false; }
            var result = JSON.readTree(response.body());
            boolean ok = result.path("success").asBoolean(false);
            if (!ok) LOG.debugf("Turnstile rechazó el token: %s", result.path("error-codes"));
            return ok;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception e) {
            // fails closed: without an answer from Cloudflare nobody passes; the window limits keep counting
            LOG.warnf("No se pudo verificar Turnstile: %s", e.getMessage());
            return false;
        }
    }
    private static String form(Map<String, String> fields) {
        var out = new StringBuilder();
        fields.forEach((k, v) -> out.append(out.isEmpty() ? "" : "&").append(k).append('=').append(URLEncoder.encode(v, StandardCharsets.UTF_8)));
        return out.toString();
    }
}
