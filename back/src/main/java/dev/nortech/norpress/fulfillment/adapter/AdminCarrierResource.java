package dev.nortech.norpress.fulfillment.adapter;
import dev.nortech.norpress.fulfillment.application.FulfillmentService;
import dev.nortech.norpress.fulfillment.domain.Carrier;
import dev.nortech.norpress.shared.adapter.Requires;
import dev.nortech.norpress.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.*;

/** The carriers the store ships with (Tienda → Envíos): the list the team picks from and the link each one gives the shopper. */
@Path("/api/admin/carriers") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminCarrierResource {
    @Inject FulfillmentService service;
    public record Input(String code, String name, List<String> aliases, Integer trackingKey, String linkTemplate, String pageUrl, String numberHint, Boolean active, Integer position) {}

    @GET public List<Map<String, Object>> list() { return service.carriers().stream().map(AdminCarrierResource::view).toList(); }

    @Requires(Permission.SETTINGS_MANAGE) @PUT @Path("/{code}") public Map<String, Object> save(@PathParam("code") String code, Input in) {
        if (in == null) throw new IllegalArgumentException("Escribe los datos de la transportadora");
        return view(service.saveCarrier(new Carrier(code, in.name(), in.aliases(), in.trackingKey(), in.linkTemplate(), in.pageUrl(), in.numberHint(), in.active() == null || in.active(), in.position() == null ? 99 : in.position())));
    }

    static Map<String, Object> view(Carrier c) {
        var out = new LinkedHashMap<String, Object>();
        out.put("code", c.code()); out.put("name", c.name()); out.put("aliases", c.aliases()); out.put("trackingKey", c.trackingKey());
        out.put("linkTemplate", c.linkTemplate()); out.put("pageUrl", c.pageUrl()); out.put("numberHint", c.numberHint()); out.put("active", c.active()); out.put("position", c.position());
        return out;
    }
}
