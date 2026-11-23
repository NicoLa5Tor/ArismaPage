package co.com.arisma.customers.adapter;
import co.com.arisma.customers.application.ShopperAddressService;
import co.com.arisma.customers.application.ShopperPorts.Shopper;
import co.com.arisma.customers.domain.Profile;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;

/** The signed-in shopper's own data for buying: name, phone and document (ShopFilter checks session and CSRF). */
@Path("/api/shop/account/profile") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class ShopProfileResource {
    @Inject ShopperAddressService book;
    @Context ContainerRequestContext context;
    public record ProfileInput(String firstName, String lastName, String phone, String documentType, String documentNumber, String company) {}

    @GET public Profile profile() { return book.profile(shopper()); }
    @PUT public Profile saveProfile(ProfileInput in) {
        if (in == null) throw new IllegalArgumentException("Escribe tus datos");
        return book.saveProfile(shopper(), new Profile(in.firstName(), in.lastName(), in.phone(), in.documentType(), in.documentNumber(), in.company()));
    }

    private Shopper shopper() { return (Shopper) context.getProperty(ShopFilter.SHOPPER); }
}
