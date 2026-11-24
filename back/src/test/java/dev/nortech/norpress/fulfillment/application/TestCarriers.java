package dev.nortech.norpress.fulfillment.application;

import dev.nortech.norpress.fulfillment.domain.Carrier;
import io.smallrye.mutiny.Multi;
import java.util.*;

/** In-memory carriers (as the migration seeds them) and a feed that remembers what it published. */
final class TestCarriers {
    private TestCarriers() {}

    static final class Catalog implements FulfillmentPorts.CarrierCatalog {
        final Map<String, Carrier> byCode = new LinkedHashMap<>();
        Catalog() {
            save(new Carrier("coordinadora", "Coordinadora", List.of("coordinadora"), 100493, "https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia={guia}", "https://coordinadora.com/rastreo/rastreo-de-guia/", "", true, 1));
            save(new Carrier("inter", "Inter Rapidísimo", List.of("inter", "interrapidisimo", "inter rapidisimo"), 100491, null, "https://www.interrapidisimo.com/", "", true, 3));
            save(new Carrier("envia", "Envía", List.of("envia", "colvanes"), 100993, null, "https://envia.co/", "", true, 4));
            save(new Carrier("472", "4-72", List.of("472", "4 72"), 3131, null, "https://www.4-72.com.co/", "", true, 7));
            save(new Carrier("viejo", "Transportadora retirada", List.of(), null, null, "https://example.com/", "", false, 9));
        }
        public List<Carrier> all() { return List.copyOf(byCode.values()); }
        public Optional<Carrier> find(String code) { return Optional.ofNullable(byCode.get(code)); }
        public void save(Carrier c) { byCode.put(c.code(), c); }
    }

    static final class Feed implements ShipmentFeed {
        final List<Change> published = new ArrayList<>();
        public void publish(Change change) { published.add(change); }
        public Multi<Change> changes() { return Multi.createFrom().iterable(published); }
    }
}
