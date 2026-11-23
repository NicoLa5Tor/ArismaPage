package co.com.arisma.payments.domain;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

/**
 * The signatures Wompi and PayU ask for, exactly as their documentation states them (checked in November 2026).
 * Amounts are whole pesos here, so PayU's form amount is written without decimals in both the form and its signature.
 */
public final class Signatures {
    private Signatures() {}

    /** Wompi web checkout: SHA-256 of reference + amount in cents + currency + integrity secret, no separators. */
    public static String wompiIntegrity(String reference, long amountInCents, String currency, String integritySecret) {
        return hash("SHA-256", reference + amountInCents + currency + integritySecret);
    }
    /** Wompi events: SHA-256 of the values named by signature.properties, in order, then the timestamp, then the events secret. */
    public static String wompiEvent(List<String> propertyValues, long timestamp, String eventsSecret) {
        return hash("SHA-256", String.join("", propertyValues) + timestamp + eventsSecret);
    }

    /** PayU payment form: apiKey~merchantId~referenceCode~amount~currency, sent with algorithmSignature=SHA256. */
    public static String payuForm(String apiKey, String merchantId, String reference, String amount, String currency) {
        return hash("SHA-256", String.join("~", apiKey, merchantId, reference, amount, currency));
    }
    /** Response page: TX_VALUE rounded half to even to one decimal (150.25 gives 150.2, 150.35 gives 150.4). */
    public static String payuResponseValue(String txValue) { return new BigDecimal(txValue.trim()).setScale(1, RoundingMode.HALF_EVEN).toPlainString(); }
    /** Confirmation page: one decimal when the second one is zero (150.00 gives 150.0), otherwise the two decimals as sent. */
    public static String payuConfirmationValue(String value) {
        String v = value.trim();
        int dot = v.indexOf('.');
        if (dot < 0) return v + ".0";
        String decimals = v.substring(dot + 1);
        if (decimals.length() == 1) return v;
        return decimals.charAt(1) == '0' ? v.substring(0, dot + 2) : v.substring(0, dot + 3);
    }
    /**
     * Whether `given` signs apiKey~merchantId~reference~value~currency~state. PayU's documentation shows MD5 in its
     * code and HMAC-SHA256 in its examples, and offers SHA1 and SHA256 too; every one of them needs the API key, so a
     * match with any is proof the message comes from PayU.
     */
    public static boolean payuMatches(String given, String apiKey, String merchantId, String reference, String value, String currency, String state) {
        if (given == null || given.isBlank()) return false;
        String base = String.join("~", apiKey, merchantId, reference, value, currency, state), sent = given.trim().toLowerCase(java.util.Locale.ROOT);
        return same(sent, hash("MD5", base)) || same(sent, hash("SHA-1", base)) || same(sent, hash("SHA-256", base)) || same(sent, hmacSha256(apiKey, base));
    }

    public static boolean same(String a, String b) {
        return a != null && b != null && MessageDigest.isEqual(a.toLowerCase(java.util.Locale.ROOT).getBytes(StandardCharsets.US_ASCII), b.toLowerCase(java.util.Locale.ROOT).getBytes(StandardCharsets.US_ASCII));
    }
    static String hash(String algorithm, String text) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance(algorithm).digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    /** HMAC-SHA256 (RFC 2104) on top of MessageDigest, so the domain stays free of javax. */
    static String hmacSha256(String key, String text) {
        try {
            var sha = MessageDigest.getInstance("SHA-256");
            byte[] k = key.getBytes(StandardCharsets.UTF_8);
            if (k.length > 64) k = sha.digest(k);
            byte[] inner = new byte[64], outer = new byte[64];
            for (int i = 0; i < 64; i++) { byte b = i < k.length ? k[i] : 0; inner[i] = (byte) (b ^ 0x36); outer[i] = (byte) (b ^ 0x5c); }
            sha.update(inner);
            byte[] first = sha.digest(text.getBytes(StandardCharsets.UTF_8));
            sha.update(outer);
            return HexFormat.of().formatHex(sha.digest(first));
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
