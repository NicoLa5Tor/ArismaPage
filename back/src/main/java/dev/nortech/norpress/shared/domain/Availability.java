package dev.nortech.norpress.shared.domain;

/**
 * Whether a shopper can take the product now and how many. unitsLeft is only told when few remain (it nudges the
 * purchase without publishing the whole inventory); maxQuantity is what one order may carry, 0 when it cannot be bought.
 */
public record Availability(Status status, Integer unitsLeft, int maxQuantity) {
    public enum Status { IN_STOCK, BACKORDER, OUT_OF_STOCK }
    public static final int MAX_PER_ORDER = 99, FEW_LEFT = 5;

    /** stockStatus and backorders arrive as stored: instock|outofstock|onbackorder and no|notify|yes. */
    public static Availability of(boolean manageStock, Integer quantity, String stockStatus, String backorders, boolean soldIndividually) {
        int perOrder = soldIndividually ? 1 : MAX_PER_ORDER;
        if (manageStock) {
            int units = quantity == null ? 0 : quantity;
            if (units > 0) return new Availability(Status.IN_STOCK, units <= FEW_LEFT ? units : null, "no".equals(backorders) ? Math.min(units, perOrder) : perOrder);
            return "no".equals(backorders) ? new Availability(Status.OUT_OF_STOCK, null, 0) : new Availability(Status.BACKORDER, null, perOrder);
        }
        return switch (stockStatus == null ? "instock" : stockStatus) {
            case "outofstock" -> new Availability(Status.OUT_OF_STOCK, null, 0);
            case "onbackorder" -> new Availability(Status.BACKORDER, null, perOrder);
            default -> new Availability(Status.IN_STOCK, null, perOrder);
        };
    }
    public boolean purchasable() { return maxQuantity > 0; }
}
