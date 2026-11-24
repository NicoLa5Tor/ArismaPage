package dev.nortech.norpress.sales.application;
import java.util.UUID;

/** A cancellation request or a refund changed the order: the open screens (panel, the shopper's account) look again. */
public record AfterSaleChanged(UUID orderId) {}
