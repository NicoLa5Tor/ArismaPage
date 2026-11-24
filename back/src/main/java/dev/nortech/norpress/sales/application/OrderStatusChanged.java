package dev.nortech.norpress.sales.application;
import dev.nortech.norpress.sales.domain.OrderStatus;
import java.util.UUID;

/** Fired inside the same transaction whenever an order changes status, so other modules (deliveries) can react without sales knowing them. */
public record OrderStatusChanged(UUID orderId, OrderStatus from, OrderStatus to, UUID actor) {}
