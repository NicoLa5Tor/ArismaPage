package co.com.arisma.shared.domain;
import java.time.*;
import java.time.format.DateTimeParseException;

/** Half-open interval [start, end) of Bogotá calendar days. Either side may be open when filtering lists. */
public record DateWindow(Instant start, Instant end) {
    public static final ZoneId BOGOTA = ZoneId.of("America/Bogota");
    private static final long MAX_REPORT_DAYS = 3700;
    public DateWindow {
        if (start != null && end != null && !start.isBefore(end)) throw new IllegalArgumentException("La fecha inicial debe ser anterior a la final");
    }
    /** Optional filter: blank dates leave that side open; "to" is inclusive. */
    public static DateWindow optional(String from, String to) {
        return new DateWindow(day(from), day(to) == null ? null : day(to).plus(Duration.ofDays(1)));
    }
    /** Report period: defaults to the current year up to today; never open, at most about ten years. */
    public static DateWindow report(String from, String to, LocalDate today) {
        Instant start = day(from) == null ? today.withDayOfYear(1).atStartOfDay(BOGOTA).toInstant() : day(from);
        Instant end = (day(to) == null ? today.atStartOfDay(BOGOTA).toInstant() : day(to)).plus(Duration.ofDays(1));
        var window = new DateWindow(start, end);
        if (Duration.between(start, end).toDays() > MAX_REPORT_DAYS) throw new IllegalArgumentException("El rango máximo es de diez años");
        return window;
    }
    /** Window of the same length right before this one, for period-over-period comparison. */
    public DateWindow previous() {
        if (start == null || end == null) throw new IllegalStateException("Solo un rango cerrado tiene periodo anterior");
        var length = Duration.between(start, end);
        return new DateWindow(start.minus(length), start);
    }
    public LocalDate firstDay() { return start == null ? null : LocalDate.ofInstant(start, BOGOTA); }
    public LocalDate lastDay() { return end == null ? null : LocalDate.ofInstant(end.minusSeconds(1), BOGOTA); }
    static Instant day(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try { return LocalDate.parse(iso.trim()).atStartOfDay(BOGOTA).toInstant(); }
        catch (DateTimeParseException e) { throw new IllegalArgumentException("Fecha inválida, usa AAAA-MM-DD"); }
    }
}
