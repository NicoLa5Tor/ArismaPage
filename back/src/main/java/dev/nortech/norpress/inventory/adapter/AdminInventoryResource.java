package dev.nortech.norpress.inventory.adapter;
import dev.nortech.norpress.inventory.application.InventoryQueries;
import dev.nortech.norpress.inventory.domain.MovementKind;
import dev.nortech.norpress.shared.application.Page;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.*;

@Path("/api/admin/inventory") @Produces(MediaType.APPLICATION_JSON)
public class AdminInventoryResource {
    @Inject InventoryQueries inventory;
    @GET @Path("/movements") public Page movements(@QueryParam("productId") UUID productId,@QueryParam("kind") String kind,@QueryParam("q") @DefaultValue("") String q,
                                                   @QueryParam("limit") @DefaultValue("30") int limit,@QueryParam("offset") @DefaultValue("0") int offset) {
        return inventory.movements(productId,MovementKind.parse(kind),q,new Page.Request(limit,offset));
    }
    @GET @Path("/low-stock") public List<Map<String,Object>> lowStock(@QueryParam("threshold") @DefaultValue("5") int threshold,@QueryParam("limit") @DefaultValue("50") int limit) { return inventory.lowStock(threshold,limit); }
}
