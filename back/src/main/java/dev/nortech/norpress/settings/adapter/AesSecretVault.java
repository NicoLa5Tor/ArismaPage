package dev.nortech.norpress.settings.adapter;
import dev.nortech.norpress.settings.application.SettingsPorts.SecretVault;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;

/**
 * AES-256-GCM with a fresh nonce per write. The key comes from NORPRESS_SECRETS_KEY (32 random bytes in base64); without
 * it nothing can be sealed or opened, so payment credentials cannot be saved in clear by accident.
 */
@ApplicationScoped
public class AesSecretVault implements SecretVault {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final SecureRandom RANDOM = new SecureRandom();
    @ConfigProperty(name = "norpress.secrets.key") Optional<String> configured;

    public String seal(Map<String, String> secrets) {
        try {
            byte[] nonce = new byte[12]; RANDOM.nextBytes(nonce);
            var cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            byte[] sealed = cipher.doFinal(JSON.writeValueAsBytes(secrets));
            return "v1." + Base64.getEncoder().encodeToString(nonce) + "." + Base64.getEncoder().encodeToString(sealed);
        } catch (IllegalArgumentException e) { throw e; }
        catch (Exception e) { throw new IllegalStateException("No se pudieron proteger las credenciales", e); }
    }
    public Map<String, String> open(String sealed) {
        try {
            String[] parts = sealed.split("\\.");
            if (parts.length != 3 || !parts[0].equals("v1")) throw new IllegalStateException("Formato de credenciales desconocido");
            var cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.getDecoder().decode(parts[1])));
            return JSON.readValue(cipher.doFinal(Base64.getDecoder().decode(parts[2])), new TypeReference<Map<String, String>>() {});
        } catch (IllegalArgumentException | IllegalStateException e) { throw e; }
        catch (Exception e) { throw new IllegalStateException("No se pudieron leer las credenciales guardadas; revisa NORPRESS_SECRETS_KEY", e); }
    }
    private SecretKeySpec key() {
        byte[] bytes;
        try { bytes = Base64.getDecoder().decode(configured.map(String::trim).orElse("")); } catch (IllegalArgumentException e) { bytes = new byte[0]; }
        if (bytes.length != 32) throw new IllegalArgumentException("Falta la llave de credenciales del servidor (NORPRESS_SECRETS_KEY). Pide a quien administra el servidor que la configure.");
        return new SecretKeySpec(bytes, "AES");
    }
}
