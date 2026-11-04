package co.com.arisma.sales.adapter;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import co.com.arisma.sales.application.OrderQueries;
import co.com.arisma.sales.application.OrderService;
import co.com.arisma.sales.domain.OrderStatus;
import co.com.arisma.shared.application.Page;
import co.com.arisma.shared.domain.DateWindow;
import co.com.arisma.shared.domain.NotFound;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.*;

/** HTTP adapter for orders: translates requests to use cases and query ports, nothing else. */
@Path("/api/admin/orders") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminOrderResource {
    @Inject OrderQueries queries;
    @Inject OrderService orders;
    @Context jakarta.ws.rs.container.ContainerRequestContext context;
    public record StatusChange(OrderStatus status,String note) {}
    public record BulkStatusChange(List<UUID> ids,OrderStatus status,String note) {}
    public record Note(String body) {}

    @GET public OrderQueries.OrderList list(@QueryParam("status") String status,@QueryParam("from") String from,@QueryParam("to") String to,@QueryParam("q") @DefaultValue("") String q,@QueryParam("stage") String stage,
                                            @QueryParam("limit") @DefaultValue("25") int limit,@QueryParam("offset") @DefaultValue("0") int offset) {
        return queries.list(new OrderQueries.Filter(OrderStatus.parse(status),DateWindow.optional(from,to),q,stage),new Page.Request(limit,offset));
    }
    @GET @Path("/{id}") public Map<String,Object> get(@PathParam("id") UUID id) { return queries.detail(id).orElseThrow(() -> new NotFound("Pedido no encontrado")); }
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/{id}/status") public Map<String,Object> status(@PathParam("id") UUID id,StatusChange in) {
        if(in==null) throw new IllegalArgumentException("Indica el nuevo estado");
        orders.changeStatus(id,in.status(),in.note(),actor());
        return get(id);
    }
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/status") public OrderService.BulkResult bulk(BulkStatusChange in) {
        if(in==null) throw new IllegalArgumentException("Selecciona pedidos y el nuevo estado");
        return orders.changeStatuses(in.ids(),in.status(),in.note(),actor());
    }
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/{id}/notes") public Response note(@PathParam("id") UUID id,Note in) { return Response.status(201).entity(orders.addNote(id,in==null?null:in.body(),actor())).build(); }
    private UUID actor() { return (UUID)context.getProperty("adminUser"); }
}
