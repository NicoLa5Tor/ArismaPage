package co.com.arisma.identity.adapter;
import co.com.arisma.identity.application.IdentityPorts.Secrets;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

@ApplicationScoped
public class SecureSecrets implements Secrets {
    private static final SecureRandom RANDOM = new SecureRandom();
    /** No 0/O, 1/l/I: easy to read aloud or type from a phone. */
    private static final String READABLE = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    public String token() { byte[] b = new byte[32]; RANDOM.nextBytes(b); return Base64.getUrlEncoder().withoutPadding().encodeToString(b); }
    /** Four groups of four, e.g. "x7Kp-Qm4z-…": 19 characters, about 91 bits. */
    public String temporaryPassword() {
        var out = new StringBuilder();
        for (int g = 0; g < 4; g++) { if (g > 0) out.append('-'); for (int i = 0; i < 4; i++) out.append(READABLE.charAt(RANDOM.nextInt(READABLE.length()))); }
        return out.toString();
    }
    public String digest(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    public boolean sameDigest(String value, String digest) {
        return value != null && digest != null && MessageDigest.isEqual(digest(value).getBytes(StandardCharsets.US_ASCII), digest.getBytes(StandardCharsets.US_ASCII));
    }
}
