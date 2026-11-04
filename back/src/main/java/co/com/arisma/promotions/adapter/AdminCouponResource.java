package co.com.arisma.promotions.adapter;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import co.com.arisma.promotions.application.CouponRepository;
import co.com.arisma.promotions.application.CouponService;
import co.com.arisma.promotions.domain.Coupon;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Path("/api/admin/coupons") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminCouponResource {
    @Inject CouponRepository coupons;
    @Inject CouponService service;
    public record Input(String code,Coupon.Kind kind,BigDecimal amount,BigDecimal minimumAmount,BigDecimal maximumAmount,Integer usageLimit,Integer usageLimitPerCustomer,
                        boolean individualUse,boolean freeShipping,boolean excludeSaleItems,Instant expiresAt,boolean active,String description) {
        Coupon toDomain(UUID id) { return new Coupon(id,code,kind,amount,minimumAmount,maximumAmount,usageLimit,usageLimitPerCustomer,individualUse,freeShipping,excludeSaleItems,expiresAt,active,description); }
    }
    @GET public List<Map<String,Object>> list() { return coupons.list(); }
    @Requires(Permission.COUPONS_MANAGE) @POST public Response create(Input in) { return Response.status(201).entity(service.create(require(in).toDomain(UUID.randomUUID()))).build(); }
    @Requires(Permission.COUPONS_MANAGE) @PUT @Path("/{id}") public Map<String,Object> update(@PathParam("id") UUID id,Input in) { return service.update(require(in).toDomain(id)); }
    private static Input require(Input in) { if(in==null) throw new IllegalArgumentException("Datos del cupón requeridos"); return in; }
}
