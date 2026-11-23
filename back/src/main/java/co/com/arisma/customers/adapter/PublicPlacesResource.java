package co.com.arisma.customers.adapter;
import co.com.arisma.customers.application.ShopperAddressService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Cities the store already delivers to in a department, as suggestions for the address form. Names only, no customer data. */
@Path("/api/public/places") @Produces(MediaType.APPLICATION_JSON)
public class PublicPlacesResource {
    @Inject ShopperAddressService places;

    @GET @Path("/cities") public Response cities(@QueryParam("departamento") String state) {
        return Response.ok(places.cities(state)).header("Cache-Control", "public, max-age=3600").build();
    }
}
