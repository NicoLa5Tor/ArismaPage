package co.com.arisma.shared.application;
import java.util.List;
import java.util.Map;

/**
 * Read side: query ports return read models as rows (column name → value) ready for JSON,
 * so listing screens do not need a domain object per projection.
 */
public record Page(List<Map<String, Object>> items, long total) {
    /** Bounded paging request; limits are clamped so no caller can ask for the whole table. */
    public record Request(int limit, int offset) {
        public Request { limit = Math.clamp(limit, 1, 100); offset = Math.max(0, offset); }
    }
}
