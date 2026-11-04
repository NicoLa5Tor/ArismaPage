package co.com.arisma.catalog.adapter;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import co.com.arisma.catalog.application.TaxRateRepository;
import co.com.arisma.catalog.application.TaxRateService;
import co.com.arisma.catalog.domain.TaxRate;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.math.BigDecimal;
import java.util.*;

@Path("/api/admin/tax-rates") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminTaxRateResource {
    @Inject TaxRateRepository rates;
    @Inject TaxRateService service;
    public record Input(String code,String name,BigDecimal percent,boolean active) {
        TaxRate toDomain(UUID id) { return new TaxRate(id,code,name,percent,active); }
    }
    @GET public List<Map<String,Object>> list() { return rates.list(); }
    @Requires(Permission.TAXES_MANAGE) @POST public Response create(Input in) { return Response.status(201).entity(service.create(require(in).toDomain(UUID.randomUUID()))).build(); }
    @Requires(Permission.TAXES_MANAGE) @PUT @Path("/{id}") public Map<String,Object> update(@PathParam("id") UUID id,Input in) { return service.update(require(in).toDomain(id)); }
    private static Input require(Input in) { if(in==null) throw new IllegalArgumentException("Datos de la tasa requeridos"); return in; }
}
