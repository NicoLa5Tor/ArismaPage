package co.com.arisma.quotes.adapter;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import co.com.arisma.quotes.application.QuoteQueries;
import co.com.arisma.quotes.application.QuoteService;
import co.com.arisma.quotes.domain.QuoteStatus;
import co.com.arisma.shared.application.Page;
import co.com.arisma.shared.domain.NotFound;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.*;

@Path("/api/admin/quotes") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminQuoteResource {
    @Inject QuoteQueries queries;
    @Inject QuoteService quotes;
    @Context jakarta.ws.rs.container.ContainerRequestContext context;
    public record StatusChange(String status,String note) {}
    @GET public Page list(@QueryParam("status") String status,@QueryParam("q") @DefaultValue("") String q,@QueryParam("limit") @DefaultValue("25") int limit,@QueryParam("offset") @DefaultValue("0") int offset) {
        return queries.list(QuoteStatus.parse(status),q,new Page.Request(limit,offset));
    }
    @GET @Path("/{id}") public Map<String,Object> get(@PathParam("id") UUID id) { return queries.detail(id).orElseThrow(() -> new NotFound("Cotización no encontrada")); }
    @Requires(Permission.QUOTES_MANAGE) @POST @Path("/{id}/status") public Map<String,Object> status(@PathParam("id") UUID id,StatusChange in) {
        if(in==null) throw new IllegalArgumentException("Indica el nuevo estado");
        quotes.changeStatus(id,QuoteStatus.parse(in.status()),in.note(),(UUID)context.getProperty("adminUser"));
        return get(id);
    }
}
