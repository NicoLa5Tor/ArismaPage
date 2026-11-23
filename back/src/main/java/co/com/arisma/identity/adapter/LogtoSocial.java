package co.com.arisma.identity.adapter;

import co.com.arisma.identity.application.IdentityPorts.Secrets;
import co.com.arisma.shared.adapter.Jdbc;
import co.com.arisma.shared.domain.Unauthorized;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.RemoteJWKSet;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import javax.sql.DataSource;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

/** Logto authorization code exchange. The browser receives only a short-lived state cookie. */
@ApplicationScoped
public class LogtoSocial implements co.com.arisma.identity.application.SocialLogin {
    @Inject DataSource db;
    @Inject Secrets secrets;
    @ConfigProperty(name="arisma.logto.issuer", defaultValue="https://logto.arisma.com.co/oidc") String issuer;
    @ConfigProperty(name="arisma.logto.client-id", defaultValue="yds9ek12blseg1ipr5v4o") String clientId;
    @ConfigProperty(name="arisma.logto.redirect-uri", defaultValue="http://localhost:8000/callback") String redirectUri;
    @ConfigProperty(name="arisma.logto.post-logout-uri", defaultValue="http://localhost:8000/") String postLogoutUri;
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();

    public Start start(String provider, String audience) {
        if (!ADMIN.equals(audience) && !SHOP.equals(audience)) throw invalid();
        if (!"google".equals(provider) && !"facebook".equals(provider)) throw invalid();
        String state = secrets.token(), nonce = secrets.token(), verifier = secrets.token();
        Jdbc.with(db, c -> { Jdbc.update(c, "DELETE FROM social_login_attempt WHERE expires_at < now()");
            Jdbc.update(c, "INSERT INTO social_login_attempt(state_hash,verifier,nonce,expires_at,audience) VALUES(?,?,?,?,?)", secrets.digest(state), verifier, nonce, Instant.now().plusSeconds(300), audience); return null; });
        try {
            String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
            String url = issuer + "/auth?response_type=code&client_id=" + enc(clientId) + "&redirect_uri=" + enc(redirectUri)
                + "&prompt=login&direct_sign_in=" + enc("social:" + provider) + "&scope=" + enc("openid email profile") + "&state=" + enc(state) + "&nonce=" + enc(nonce) + "&code_challenge_method=S256&code_challenge=" + enc(challenge);
            return new Start(state, url);
        } catch (Exception e) { throw new IllegalStateException("No se pudo iniciar sesi\u00f3n social", e); }
    }

    public Verified verified(String state, String cookie, String code, String audience) {
        if (state == null || cookie == null || code == null || state.length() > 128 || code.length() > 4096 || !MessageDigest.isEqual(state.getBytes(StandardCharsets.UTF_8), cookie.getBytes(StandardCharsets.UTF_8))) throw invalid();
        Map<String,Object> attempt = Jdbc.with(db, c -> Jdbc.one(c, "DELETE FROM social_login_attempt WHERE state_hash=? AND audience=? AND expires_at>now() RETURNING verifier,nonce", secrets.digest(state), audience).orElseThrow(LogtoSocial::invalid));
        try {
            String body = "grant_type=authorization_code&client_id=" + enc(clientId) + "&redirect_uri=" + enc(redirectUri) + "&code=" + enc(code) + "&code_verifier=" + enc((String) attempt.get("verifier"));
            var response = HTTP.send(HttpRequest.newBuilder(URI.create(issuer + "/token")).timeout(Duration.ofSeconds(12)).header("Content-Type", "application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw invalid();
            var tokens = JSON.readTree(response.body());
            if (!tokens.path("id_token").isTextual() || !tokens.path("access_token").isTextual()) throw invalid();
            var processor = new DefaultJWTProcessor<SecurityContext>();
            var keys = new RemoteJWKSet<SecurityContext>(URI.create(issuer + "/jwks").toURL(), new com.nimbusds.jose.util.DefaultResourceRetriever(5000, 5000, 100000));
            processor.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.ES384, keys));
            var claims = processor.process(tokens.path("id_token").asText(), null);
            if (!issuer.equals(claims.getIssuer()) || !claims.getAudience().contains(clientId) || claims.getExpirationTime() == null || !claims.getExpirationTime().toInstant().isAfter(Instant.now()) || !attempt.get("nonce").equals(claims.getStringClaim("nonce")) || claims.getSubject() == null) throw invalid();
            var userInfo = HTTP.send(HttpRequest.newBuilder(URI.create(issuer + "/me")).timeout(Duration.ofSeconds(12)).header("Authorization", "Bearer " + tokens.path("access_token").asText()).GET().build(), HttpResponse.BodyHandlers.ofString());
            if (userInfo.statusCode() != 200) throw invalid();
            var user = JSON.readTree(userInfo.body());
            if (!claims.getSubject().equals(user.path("sub").asText()) || !user.path("email_verified").asBoolean(false) || !user.path("email").isTextual() || user.path("email").asText().isBlank()) throw invalid();
            return new Verified(user.path("email").asText(), user.path("name").asText(""));
        } catch (Unauthorized e) { throw e; }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw invalid(); }
        catch (Exception e) { throw invalid(); }
    }
    public String logoutUrl() { return issuer + "/session/end?client_id=" + enc(clientId) + "&post_logout_redirect_uri=" + enc(postLogoutUri); }
    private static String enc(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private static Unauthorized invalid() { return new Unauthorized("No se pudo verificar el inicio de sesi\u00f3n social."); }
}
