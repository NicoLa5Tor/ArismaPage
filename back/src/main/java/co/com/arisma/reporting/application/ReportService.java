package co.com.arisma.reporting.application;
import co.com.arisma.shared.domain.DateWindow;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/** Builds the dashboard summary: the period, the same-length period before it, and what is pending now. */
@ApplicationScoped
public class ReportService {
    @Inject ReportQueries reports;
    public DateWindow window(String from, String to) { return DateWindow.report(from, to, LocalDate.now(DateWindow.BOGOTA)); }
    public Map<String, Object> summary(DateWindow window, int lowStockThreshold) {
        var out = new LinkedHashMap<String, Object>(reports.totals(window));
        out.put("from", window.firstDay()); out.put("to", window.lastDay());
        out.put("previous", reports.totals(window.previous()));
        out.put("newCustomers", reports.newCustomers(window));
        out.put("queue", reports.queue(Math.max(0, lowStockThreshold)));
        return out;
    }
}
