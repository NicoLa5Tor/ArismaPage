package dev.nortech.norpress.settings.domain;
import java.util.LinkedHashMap;
import java.util.Map;

/** Whether the store follows carrier shipments by itself. Off until the administrator turns it on. */
public record TrackingSettings(boolean enabled) {
    public static final String KEY = "tracking";
    public static final TrackingSettings DEFAULT = new TrackingSettings(false);
    public static TrackingSettings fromMap(Map<String, Object> m) {
        if (m == null || m.isEmpty()) return DEFAULT;
        return new TrackingSettings(Conversations.flag(m, "enabled", false));
    }
    public Map<String, Object> toMap() { var out = new LinkedHashMap<String, Object>(); out.put("enabled", enabled); return out; }
}
