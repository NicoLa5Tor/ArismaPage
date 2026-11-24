package dev.nortech.norpress.customers.adapter;
import dev.nortech.norpress.customers.application.ShopperAddressService;
import dev.nortech.norpress.customers.application.ShopperPorts.Shopper;
import dev.nortech.norpress.customers.domain.Address;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.*;

/**
 * The signed-in shopper's address book and own data (ShopFilter checks the session and, on writes, the CSRF token).
 * Under /api/shop/account like the rest of the account; the profile lives at /api/shop/account/profile.
 */
@Path("/api/shop/account/addresses") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class ShopAddressResource {
    @Inject ShopperAddressService book;
    @Context ContainerRequestContext context;
    public record AddressInput(String label, String recipient, String phone, String state, String city, String neighborhood, String street, String detail, String instructions, boolean makeDefault) {
        Address toDomain() { return new Address(null, Address.Label.parse(label), recipient, phone, state, city, neighborhood, street, detail, instructions, false); }
    }

    @GET public List<Map<String, Object>> list() { return book.addresses(shopper()).stream().map(ShopAddressResource::view).toList(); }
    @POST public Response add(AddressInput in) {
        if (in == null) throw new IllegalArgumentException("Escribe la dirección");
        return Response.status(201).entity(view(book.save(shopper(), null, in.toDomain(), in.makeDefault()))).build();
    }
    @PUT @Path("/{id}") public Map<String, Object> change(@PathParam("id") UUID id, AddressInput in) {
        if (in == null) throw new IllegalArgumentException("Escribe la dirección");
        return view(book.save(shopper(), id, in.toDomain(), in.makeDefault()));
    }
    @DELETE @Path("/{id}") public Response delete(@PathParam("id") UUID id) { book.delete(shopper(), id); return Response.noContent().build(); }
    @PUT @Path("/{id}/default") public List<Map<String, Object>> makeDefault(@PathParam("id") UUID id) { book.makeDefault(shopper(), id); return list(); }

    static Map<String, Object> view(Address a) {
        var out = new LinkedHashMap<String, Object>();
        out.put("id", a.id()); out.put("label", a.label().db()); out.put("recipient", a.recipient()); out.put("phone", a.phone());
        out.put("state", a.state()); out.put("city", a.city()); out.put("neighborhood", a.neighborhood()); out.put("street", a.street());
        out.put("detail", a.detail()); out.put("instructions", a.instructions()); out.put("isDefault", a.isDefault());
        return out;
    }
    private Shopper shopper() { return (Shopper) context.getProperty(ShopFilter.SHOPPER); }
}
