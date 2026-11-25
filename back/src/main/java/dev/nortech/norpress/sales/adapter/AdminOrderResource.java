package dev.nortech.norpress.sales.adapter;
import dev.nortech.norpress.shared.adapter.Requires;
import dev.nortech.norpress.shared.domain.Permission;
import dev.nortech.norpress.sales.application.OrderQueries;
import dev.nortech.norpress.sales.application.OrderService;
import dev.nortech.norpress.sales.domain.OrderStatus;
import dev.nortech.norpress.shared.application.Page;
import dev.nortech.norpress.shared.domain.DateWindow;
import dev.nortech.norpress.shared.domain.NotFound;
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
    public record KeepActive(boolean active) {}
    public record Decision(String answer) {}
    public record RefundInput(java.math.BigDecimal amount, String method, String reference, String note) {}
    @jakarta.inject.Inject dev.nortech.norpress.sales.application.AfterSaleService afterSale;

    /** The shopper asked to cancel: the store approves it (the order is cancelled) or rejects it with an answer. */
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/{id}/cancellation/approve") public Map<String,Object> approve(@PathParam("id") UUID id,Decision in) {
        afterSale.approve(id,in==null?null:in.answer(),actor());
        return get(id);
    }
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/{id}/cancellation/reject") public Map<String,Object> reject(@PathParam("id") UUID id,Decision in) {
        afterSale.reject(id,in==null?null:in.answer(),actor());
        return get(id);
    }
    public record TransferInput(String reference) {}
    public record CheckInput(Boolean refunded, String reference) {}
    /** The store transferred the refund to the shopper's account. */
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/{id}/refund/transferred") public Map<String,Object> transferred(@PathParam("id") UUID id,TransferInput in) {
        afterSale.completeTransfer(id,in==null?null:in.reference(),actor());
        return get(id);
    }
    /** The gateway did not answer; the store looked in its dashboard and says whether the refund happened. */
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/{id}/refund/checked") public Map<String,Object> checked(@PathParam("id") UUID id,CheckInput in) {
        if(in==null||in.refunded()==null) throw new IllegalArgumentException("Indica si el reembolso se hizo en la pasarela");
        afterSale.confirmChecked(id,in.refunded(),in.reference(),actor());
        return get(id);
    }
    /** The account to transfer to. Opening it is written in the order's history. */
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/{id}/refund/account") public Response account(@PathParam("id") UUID id) {
        var p=afterSale.viewAccount(id,actor());
        return Response.ok(Map.of("bank",p.bank(),"accountType",p.accountType(),"number",p.number(),"holder",p.holder(),"documentType",p.documentType(),"document",p.document()))
            .header("Cache-Control","no-store").build();
    }
    /** Money the store gave back (in the gateway's dashboard, by transfer or in cash). */
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/{id}/refunds") public Map<String,Object> refund(@PathParam("id") UUID id,RefundInput in) {
        if(in==null) throw new IllegalArgumentException("Escribe cuánto devolviste");
        afterSale.recordRefund(id,new dev.nortech.norpress.sales.domain.AfterSale.Refund(in.amount(),dev.nortech.norpress.sales.domain.AfterSale.Method.parse(in.method()),in.reference(),in.note()),actor());
        return get(id);
    }

    /** Brings back an order cancelled for lack of payment whose money arrived later, once its units are there. */
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/{id}/revive") public Map<String,Object> revive(@PathParam("id") UUID id) {
        afterSale.revive(id,actor());
        return get(id);
    }
    @GET public OrderQueries.OrderList list(@QueryParam("status") String status,@QueryParam("from") String from,@QueryParam("to") String to,@QueryParam("q") @DefaultValue("") String q,@QueryParam("stage") String stage,
                                            @QueryParam("historial") boolean history,@QueryParam("limit") @DefaultValue("25") int limit,@QueryParam("offset") @DefaultValue("0") int offset) {
        return queries.list(new OrderQueries.Filter(OrderStatus.parse(status),DateWindow.optional(from,to),q,stage,history),new Page.Request(limit,offset));
    }
    @GET @Path("/{id}") public Map<String,Object> get(@PathParam("id") UUID id) { return queries.detail(id).orElseThrow(() -> new NotFound("Pedido no encontrado")); }
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/{id}/status") public Map<String,Object> status(@PathParam("id") UUID id,StatusChange in) {
        if(in==null) throw new IllegalArgumentException("Indica el nuevo estado");
        if(in.status()==OrderStatus.REFUNDED) throw new IllegalArgumentException("Para marcarlo reembolsado, registra el reembolso en el pedido");
        // cancelling goes through the after-sale rules: a paid order is refunded, a dispatched one is not cancelled here
        if(in.status()==OrderStatus.CANCELLED) afterSale.cancelByStore(id,in.note(),actor());
        else orders.changeStatus(id,in.status(),in.note(),actor());
        return get(id);
    }
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/status") public OrderService.BulkResult bulk(BulkStatusChange in) {
        if(in==null) throw new IllegalArgumentException("Selecciona pedidos y el nuevo estado");
        if(in.status()==OrderStatus.REFUNDED) throw new IllegalArgumentException("Para marcarlos reembolsados, registra el reembolso en cada pedido");
        if(in.status()==OrderStatus.CANCELLED) {
            // each one on its own: one that cannot be cancelled does not stop the others, and each paid one is refunded
            if(in.ids()==null||in.ids().isEmpty()) throw new IllegalArgumentException("Selecciona pedidos");
            if(in.ids().size()>200) throw new IllegalArgumentException("Máximo 200 pedidos a la vez");
            int done=0; var failed=new java.util.ArrayList<OrderService.Failure>();
            for(var id:new java.util.LinkedHashSet<>(in.ids())) {
                try { afterSale.cancelByStore(id,in.note(),actor()); done++; }
                catch(RuntimeException e) { failed.add(new OrderService.Failure(id,e.getMessage()==null?"No se pudo cancelar":e.getMessage())); }
            }
            return new OrderService.BulkResult(done,failed);
        }
        return orders.changeStatuses(in.ids(),in.status(),in.note(),actor());
    }
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/{id}/notes") public Response note(@PathParam("id") UUID id,Note in) { return Response.status(201).entity(orders.addNote(id,in==null?null:in.body(),actor())).build(); }
    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/{id}/active") public Map<String,Object> keepActive(@PathParam("id") UUID id,KeepActive in) {
        orders.keepActive(id,in!=null&&in.active(),actor());
        return get(id);
    }
    private UUID actor() { return (UUID)context.getProperty("adminUser"); }
}
