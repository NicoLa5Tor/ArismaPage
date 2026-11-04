package co.com.arisma.customers.adapter;
import co.com.arisma.customers.application.CustomerQueries;
import co.com.arisma.shared.application.Page;
import co.com.arisma.shared.domain.NotFound;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.*;

@Path("/api/admin/customers") @Produces(MediaType.APPLICATION_JSON)
public class AdminCustomerResource {
    @Inject CustomerQueries customers;
    @GET public Page list(@QueryParam("q") @DefaultValue("") String q,@QueryParam("buyers") @DefaultValue("true") boolean buyers,@QueryParam("sort") String sort,
                          @QueryParam("limit") @DefaultValue("25") int limit,@QueryParam("offset") @DefaultValue("0") int offset) {
        return customers.list(q,buyers,CustomerQueries.Sort.parse(sort),new Page.Request(limit,offset));
    }
    @GET @Path("/{id}") public Map<String,Object> get(@PathParam("id") UUID id) { return customers.detail(id).orElseThrow(() -> new NotFound("Cliente no encontrado")); }
}
