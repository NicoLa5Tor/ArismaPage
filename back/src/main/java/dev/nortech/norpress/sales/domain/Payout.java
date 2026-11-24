package dev.nortech.norpress.sales.domain;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Where to transfer a refund: a bank account or a wallet (Nequi, Daviplata…) of the shopper. Validated here, sealed
 * before it is stored, opened only in the panel and deleted once the refund is done.
 */
public record Payout(String bank, String accountType, String number, String holder, String documentType, String document) {
    /** Banks and wallets in Colombia that take transfers. Wallets take the phone number as the account. */
    public static final List<String> BANKS = List.of("Bancolombia", "Banco de Bogotá", "Davivienda", "BBVA", "Banco de Occidente", "Banco Popular",
        "Banco AV Villas", "Banco Caja Social", "Scotiabank Colpatria", "Itaú", "Banco Agrario", "Banco Falabella", "Banco Pichincha", "Bancoomeva",
        "Banco GNB Sudameris", "Banco W", "Banco Finandina", "Banco Serfinanza", "Bancamía", "Banco Mundo Mujer", "Banco Cooperativo Coopcentral",
        "Confiar", "Lulo Bank", "Nu Colombia", "Nequi", "Daviplata", "Movii", "RappiPay", "Dale!");
    public static final List<String> WALLETS = List.of("Nequi", "Daviplata", "Movii", "RappiPay", "Dale!");
    public static final List<String> ACCOUNT_TYPES = List.of("ahorros", "corriente", "billetera");
    public static final List<String> DOCUMENT_TYPES = List.of("CC", "CE", "NIT", "PP", "TI");

    public Payout {
        bank = clean(bank); accountType = clean(accountType).toLowerCase(java.util.Locale.ROOT); number = clean(number).replaceAll("[\\s-]", "");
        holder = clean(holder).replaceAll("\\s+", " "); documentType = clean(documentType).toUpperCase(java.util.Locale.ROOT); document = clean(document).replaceAll("[\\s.-]", "");
        if (!BANKS.contains(bank)) throw new IllegalArgumentException("Elige tu banco o billetera de la lista");
        boolean wallet = WALLETS.contains(bank);
        if (wallet) accountType = "billetera";
        if (!ACCOUNT_TYPES.contains(accountType)) throw new IllegalArgumentException("Elige si la cuenta es de ahorros o corriente");
        if (!wallet && accountType.equals("billetera")) throw new IllegalArgumentException("Elige si la cuenta es de ahorros o corriente");
        if (wallet ? !number.matches("3\\d{9}") : !number.matches("\\d{6,20}"))
            throw new IllegalArgumentException(wallet ? "Escribe el celular de tu " + bank + ": 10 dígitos que empiezan por 3" : "Escribe el número de la cuenta: solo dígitos, entre 6 y 20");
        if (holder.length() < 5 || holder.length() > 80 || !holder.matches("[\\p{L} .'-]+")) throw new IllegalArgumentException("Escribe el nombre completo del titular de la cuenta");
        if (!DOCUMENT_TYPES.contains(documentType)) throw new IllegalArgumentException("Elige el tipo de documento del titular");
        if (!document.matches("[0-9A-Za-z]{5,15}")) throw new IllegalArgumentException("Escribe el número de documento del titular");
    }
    private static String clean(String value) { return value == null ? "" : value.trim(); }

    /** Only the last digits, for screens and messages that must not show the whole account. */
    public String masked() { return bank + " ···" + number.substring(number.length() - 4); }

    public Map<String, String> toMap() {
        var out = new LinkedHashMap<String, String>();
        out.put("bank", bank); out.put("accountType", accountType); out.put("number", number); out.put("holder", holder); out.put("documentType", documentType); out.put("document", document);
        return out;
    }
    public static Payout fromMap(Map<String, String> m) {
        return new Payout(m.get("bank"), m.get("accountType"), m.get("number"), m.get("holder"), m.get("documentType"), m.get("document"));
    }
}
