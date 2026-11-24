package dev.nortech.norpress.reporting.adapter;
import dev.nortech.norpress.reporting.application.ReportQueries;
import dev.nortech.norpress.reporting.application.ReportService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.*;

/** Dates are Bogotá calendar days; "to" is inclusive. */
@Path("/api/admin/reports") @Produces(MediaType.APPLICATION_JSON)
public class AdminReportResource {
    @Inject ReportService service;
    @Inject ReportQueries reports;
    @GET @Path("/summary") public Map<String,Object> summary(@QueryParam("from") String from,@QueryParam("to") String to,@QueryParam("lowStockThreshold") @DefaultValue("5") int threshold) { return service.summary(service.window(from,to),threshold); }
    @GET @Path("/sales-by-month") public List<Map<String,Object>> byMonth(@QueryParam("from") String from,@QueryParam("to") String to) { return reports.salesByMonth(service.window(from,to)); }
    @GET @Path("/top-products") public List<Map<String,Object>> top(@QueryParam("from") String from,@QueryParam("to") String to,@QueryParam("limit") @DefaultValue("10") int limit,@QueryParam("by") @DefaultValue("units") String by) { return reports.topProducts(service.window(from,to),limit,"revenue".equals(by)); }
    @GET @Path("/payment-methods") public List<Map<String,Object>> payments(@QueryParam("from") String from,@QueryParam("to") String to) { return reports.paymentMethods(service.window(from,to)); }
    @GET @Path("/shipping-methods") public List<Map<String,Object>> shipping(@QueryParam("from") String from,@QueryParam("to") String to) { return reports.shippingMethods(service.window(from,to)); }
    @GET @Path("/order-statuses") public List<Map<String,Object>> statuses(@QueryParam("from") String from,@QueryParam("to") String to) { return reports.orderStatuses(service.window(from,to)); }
}
