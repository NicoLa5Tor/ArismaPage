package dev.nortech.norpress.identity.adapter;
import dev.nortech.norpress.identity.application.IdentityPorts.PasswordHasher;
import jakarta.enterprise.context.ApplicationScoped;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** PBKDF2-HMAC-SHA256, 600 000 rounds, encoded as pbkdf2-sha256$rounds$salt$hash (same format as scripts/create-admin.cjs). */
@ApplicationScoped
public class Pbkdf2PasswordHasher implements PasswordHasher {
    static final int ROUNDS = 600_000;
    private static final SecureRandom RANDOM = new SecureRandom();
    public String hash(String password) {
        byte[] salt = new byte[16]; RANDOM.nextBytes(salt);
        return "pbkdf2-sha256$" + ROUNDS + "$" + HexFormat.of().formatHex(salt) + "$" + HexFormat.of().formatHex(derive(password, salt, ROUNDS, 32));
    }
    public boolean verify(String password, String encoded) {
        try {
            String[] parts = encoded.split("\\$");
            if (parts.length != 4 || !parts[0].equals("pbkdf2-sha256")) return false;
            int rounds = Integer.parseInt(parts[1]);
            if (rounds < ROUNDS || rounds > 2_000_000) return false;
            byte[] expected = HexFormat.of().parseHex(parts[3]);
            return MessageDigest.isEqual(derive(password, HexFormat.of().parseHex(parts[2]), rounds, expected.length), expected);
        } catch (RuntimeException e) { return false; }
    }
    private static byte[] derive(String password, byte[] salt, int rounds, int bytes) {
        var spec = new PBEKeySpec(password.toCharArray(), salt, rounds, bytes * 8);
        try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); }
        catch (java.security.GeneralSecurityException e) { throw new IllegalStateException(e); }
        finally { spec.clearPassword(); }
    }
}
