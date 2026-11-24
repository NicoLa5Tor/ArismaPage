package dev.nortech.norpress.reporting.application;
import dev.nortech.norpress.shared.domain.DateWindow;
import java.util.List;
import java.util.Map;

/** Sales reports over paid orders (processing, completed, on hold). */
public interface ReportQueries {
    /** Totals for the window: orders, sales, average ticket, tax, shipping, discount, units. */
    Map<String, Object> totals(DateWindow window);
    long newCustomers(DateWindow window);
    /** What needs attention now, independent of the window. */
    Map<String, Object> queue(int lowStockThreshold);
    List<Map<String, Object>> salesByMonth(DateWindow window);
    List<Map<String, Object>> topProducts(DateWindow window, int limit, boolean byRevenue);
    List<Map<String, Object>> paymentMethods(DateWindow window);
    List<Map<String, Object>> shippingMethods(DateWindow window);
    List<Map<String, Object>> orderStatuses(DateWindow window);
}
