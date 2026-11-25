package dev.nortech.norpress.shared.adapter;
import io.vertx.core.http.HttpServerRequest;
import java.net.InetAddress;

/**
 * Where a request comes from: the connection's address, unless the connection comes from this machine or the private
 * network (the store's own Next.js proxy); then it is the first X-Forwarded-For entry, which that proxy sets.
 */
public final class ClientAddress {
    private ClientAddress() {}

    public static String of(HttpServerRequest connection, String forwarded) {
        String direct = connection == null || connection.remoteAddress() == null ? "" : connection.remoteAddress().hostAddress();
        if (forwarded != null && !forwarded.isBlank() && trusted(direct)) {
            String first = forwarded.split(",")[0].trim();
            if (!first.isEmpty() && first.length() <= 64) return first;
        }
        return direct.isEmpty() ? "desconocida" : direct;
    }
    static boolean trusted(String address) {
        if (address == null || address.isEmpty()) return false;
        try {
            var ip = InetAddress.getByName(address);
            return ip.isLoopbackAddress() || ip.isSiteLocalAddress();
        } catch (Exception e) { return false; }
    }
}
