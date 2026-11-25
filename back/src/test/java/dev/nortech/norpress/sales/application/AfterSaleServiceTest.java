package dev.nortech.norpress.sales.application;
import static org.junit.jupiter.api.Assertions.*;
import dev.nortech.norpress.notifications.application.NotificationService;
import dev.nortech.norpress.sales.domain.AfterSale;
import dev.nortech.norpress.sales.domain.OrderStatus;
import dev.nortech.norpress.sales.domain.Payout;
import dev.nortech.norpress.sales.domain.RefundRoute;
import dev.nortech.norpress.settings.application.SettingsPorts.SecretVault;
import dev.nortech.norpress.shared.domain.Conflict;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.event.NotificationOptions;
import jakarta.enterprise.util.TypeLiteral;
import java.lang.annotation.Annotation;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Cancelling and refunding with in-memory adapters: every answer a gateway can give, and the store's own steps. */
class AfterSaleServiceTest {
    static class FakeAfterSale implements AfterSaleRepository {
        String stage = "to_prepare"; BigDecimal paid = new BigDecimal("100000"); boolean migrated;
        final Map<UUID, RefundRow> rows = new LinkedHashMap<>(); final Map<UUID, String> methods = new HashMap<>(); String payout; Request open;
        BigDecimal sum(boolean done) { return rows.values().stream().filter(r -> r.status().equals("succeeded") == done).map(RefundRow::amount).reduce(BigDecimal.ZERO, BigDecimal::add); }
        public Optional<Standing> standing(UUID orderId) { return Optional.of(new Standing(orderId, "100", stage, paid, sum(true), sum(false), migrated, "cliente@tienda.test", "Ana Pérez")); }
        public Optional<Request> openRequest(UUID orderId) { return Optional.ofNullable(open); }
        public void insertRequest(UUID orderId, String reason) { open = new Request(UUID.randomUUID(), reason, "requested"); }
        public void decide(UUID requestId, boolean approved, String answer, UUID actor) { open = null; }
        public void insertRefund(UUID orderId, AfterSale.Refund refund, UUID actor) { var id = UUID.randomUUID(); rows.put(id, new RefundRow(id, orderId, refund.amount(), "manual", "succeeded", "", "", null, Instant.now())); }
        public UUID insertPending(UUID orderId, BigDecimal amount, String route, String status, String requestedBy, UUID actor) {
            if (rows.values().stream().anyMatch(r -> !r.status().equals("succeeded"))) throw new IllegalStateException("unique index: one open refund");
            var id = UUID.randomUUID(); rows.put(id, new RefundRow(id, orderId, amount, route, status, "", "", null, Instant.now())); return id;
        }
        public Optional<RefundRow> refund(UUID refundId) { return Optional.ofNullable(rows.get(refundId)); }
        public Optional<RefundRow> openRefund(UUID orderId) { return rows.values().stream().filter(r -> !r.status().equals("succeeded")).findFirst(); }
        public boolean claim(UUID refundId) {
            var r = rows.get(refundId);
            if (!r.status().equals("processing") || r.sentAt() != null) return false;
            rows.put(refundId, new RefundRow(r.id(), r.orderId(), r.amount(), r.route(), r.status(), r.gatewayReference(), r.failure(), Instant.now(), r.createdAt())); return true;
        }
        public void update(UUID refundId, String status, String gatewayReference, String failure) {
            var r = rows.get(refundId);
            rows.put(refundId, new RefundRow(r.id(), r.orderId(), r.amount(), r.route(), status, gatewayReference == null || gatewayReference.isBlank() ? r.gatewayReference() : gatewayReference, failure, r.sentAt(), r.createdAt()));
        }
        public void complete(UUID refundId, String method, String reference, UUID actor) { update(refundId, "succeeded", reference, ""); methods.put(refundId, method); }
        public List<RefundRow> pending(int limit) { return rows.values().stream().filter(r -> r.status().equals("processing")).toList(); }
        public void savePayout(UUID orderId, String sealed) { payout = sealed; }
        public Optional<String> payout(UUID orderId) { return Optional.ofNullable(payout); }
        public void deletePayout(UUID orderId) { payout = null; }
    }
    /** A gateway that answers what each test sets, and counts how many times money was asked back. */
    static class FakeGateway implements RefundGateway {
        RefundRoute.Charge charge = new RefundRoute.Charge("wompi", "CARD", "tx-1", "ARI100T1", true, Instant.now().minusSeconds(3600));
        boolean ready = true; Result next = new Result(Outcome.APPROVED, "rf-1", ""); Result checked = new Result(Outcome.PENDING, "", ""); int calls;
        public Optional<RefundRoute.Charge> charge(UUID orderId) { return Optional.ofNullable(charge); }
        public boolean ready(RefundRoute.Charge c) { return ready; }
        public Result refund(RefundRoute.Charge c, BigDecimal amount, boolean whole, String reason) { calls++; if (next == null) throw new IllegalStateException("timeout"); return next; }
        public Result check(RefundRoute.Charge c, String ref) { return checked; }
    }
    static class Vault implements SecretVault {
        public String seal(Map<String, String> secrets) { return "sealed:" + String.join("|", secrets.values()); }
        public Map<String, String> open(String sealed) { var p = sealed.substring(7).split("\\|"); return Map.of("bank", p[0], "accountType", p[1], "number", p[2], "holder", p[3], "documentType", p[4], "document", p[5]); }
    }
    static class Mail extends NotificationService {
        final List<String> sent = new ArrayList<>();
        @Override public void orderCancelled(String to, String name, String number, BigDecimal refund, String how, String link) { sent.add("cancelado" + (refund == null ? "" : ":" + refund.toPlainString())); }
        @Override public void refundCompleted(String to, String name, String number, BigDecimal amount, String how, String link) { sent.add("devuelto:" + amount.toPlainString()); }
        final List<String> alerts = new ArrayList<>();
        @Override public void storeAlert(String subject, String text, java.util.UUID orderId) { alerts.add(subject); }
    }
    static class Changes implements Event<AfterSaleChanged> {
        int fired;
        public void fire(AfterSaleChanged e) { fired++; }
        public <U extends AfterSaleChanged> CompletionStage<U> fireAsync(U e) { fired++; return CompletableFuture.completedFuture(e); }
        public <U extends AfterSaleChanged> CompletionStage<U> fireAsync(U e, NotificationOptions o) { return fireAsync(e); }
        public Event<AfterSaleChanged> select(Annotation... q) { return this; }
        public <U extends AfterSaleChanged> Event<U> select(Class<U> t, Annotation... q) { throw new UnsupportedOperationException(); }
        public <U extends AfterSaleChanged> Event<U> select(TypeLiteral<U> t, Annotation... q) { throw new UnsupportedOperationException(); }
    }

    static class Rules extends dev.nortech.norpress.settings.application.StoreSettingsService {
        boolean shopperCancels = true;
        @Override public dev.nortech.norpress.settings.domain.CheckoutRules checkout() { return new dev.nortech.norpress.settings.domain.CheckoutRules(48, shopperCancels); }
    }
    final Rules rules = new Rules();
    OrderServiceTest.FakeOrders orders; FakeAfterSale afterSale; FakeGateway gateway; Mail mail; AfterSaleService service; UUID id;
    static final Payout ACCOUNT = new Payout("Bancolombia", "ahorros", "12345678901", "Ana María Pérez", "CC", "1020304050");

    @BeforeEach void setUp() {
        orders = new OrderServiceTest.FakeOrders(); afterSale = new FakeAfterSale(); gateway = new FakeGateway(); mail = new Mail();
        var orderService = new OrderService();
        orderService.orders = orders; orderService.stock = new OrderServiceTest.FakeLedger(); orderService.self = orderService; orderService.events = new OrderServiceTest.Events();
        service = new AfterSaleService(); service.afterSale = afterSale; service.orders = orders; service.orderService = orderService; service.gateway = gateway;
        service.vault = new Vault(); service.notifications = mail; service.settings = rules; service.changed = new Changes(); service.self = service; service.site = "https://tienda.test";
        id = UUID.randomUUID(); orders.orders.put(id, new OrderRepository.OrderRef(id, "100", OrderStatus.PROCESSING));
    }
    OrderStatus status() { return orders.orders.get(id).status(); }
    AfterSaleRepository.RefundRow refund() { return afterSale.rows.values().iterator().next(); }
    void cancelAsShopper(Payout account) { service.cancel(id, "Cancelado por el cliente: ya no lo necesito", account, true, null).ifPresent(service::process); }

    @Test void aPaidOrderIsCancelledAndItsMoneyGoesBackThroughTheGateway() {
        cancelAsShopper(null);
        assertEquals(OrderStatus.REFUNDED, status(), "cancelled, then refunded once Wompi approved");
        assertEquals("succeeded", refund().status());
        assertEquals("gateway", afterSale.methods.get(refund().id()));
        assertEquals(1, gateway.calls);
        assertEquals(List.of("cancelado:100000", "devuelto:100000"), mail.sent);
    }
    @Test void anUnpaidOrderIsOnlyCancelled() {
        orders.orders.put(id, new OrderRepository.OrderRef(id, "100", OrderStatus.PENDING)); afterSale.paid = BigDecimal.ZERO; afterSale.stage = "unpaid";
        cancelAsShopper(null);
        assertEquals(OrderStatus.CANCELLED, status());
        assertTrue(afterSale.rows.isEmpty());
        assertEquals(0, gateway.calls);
        assertEquals(List.of("cancelado"), mail.sent);
    }
    @Test void anOrderThatLeftIsNotCancelledByTheShopperNorTheStore() {
        for (String stage : new String[]{"shipped", "delivered", "to_invoice"}) {
            afterSale.stage = stage;
            assertThrows(Conflict.class, this::cancelShopperRaw, stage);
            assertThrows(Conflict.class, () -> service.cancel(id, "x", null, false, null), stage);
        }
        assertEquals(OrderStatus.PROCESSING, status());
        assertEquals(0, gateway.calls);
    }
    void cancelShopperRaw() { service.cancel(id, "Cancelado por el cliente: x", ACCOUNT, true, null); }
    @Test void aSecondCancelFindsItAlreadyCancelled() {
        cancelAsShopper(null);
        assertThrows(Conflict.class, () -> cancelAsShopper(null));
        assertEquals(1, gateway.calls, "money asked back once");
    }
    @Test void aDeclinedRefundGoesToTransferAndNeedsTheAccount() {
        gateway.next = new RefundGateway.Result(RefundGateway.Outcome.DECLINED, "", "Fondos insuficientes");
        cancelAsShopper(null);
        assertEquals(OrderStatus.CANCELLED, status());
        assertEquals("to_transfer", refund().status());
        assertTrue(refund().failure().contains("Fondos insuficientes"));
        assertThrows(Conflict.class, () -> service.completeTransfer(id, "TRF-1", null), "no account yet");
        afterSale.payout = new Vault().seal(ACCOUNT.toMap());
        assertEquals(ACCOUNT, service.viewAccount(id, null));
        service.completeTransfer(id, "TRF-1", null);
        assertEquals(OrderStatus.REFUNDED, status());
        assertNull(afterSale.payout, "the account is deleted once the money is back");
    }
    @Test void paidByTransferTheShopperMustGiveAnAccount() {
        gateway.charge = null;
        assertThrows(IllegalArgumentException.class, () -> cancelAsShopper(null));
        assertEquals(OrderStatus.PROCESSING, status(), "nothing changes without the account");
        cancelAsShopper(ACCOUNT);
        assertEquals("to_transfer", refund().status());
        assertNotNull(afterSale.payout);
        assertEquals(0, gateway.calls);
        service.completeTransfer(id, "TRF-9", null);
        assertEquals(OrderStatus.REFUNDED, status());
        assertNull(afterSale.payout);
    }
    @Test void noAnswerIsNeverSentAgainTheStoreChecks() {
        gateway.next = null;
        cancelAsShopper(null);
        assertEquals("checking", refund().status());
        service.processPending();
        service.process(refund().id());
        assertEquals(1, gateway.calls, "an unknown result is never retried");
        service.confirmChecked(id, true, "WOMPI-RF", null);
        assertEquals(OrderStatus.REFUNDED, status());
    }
    @Test void noAnswerAndTheStoreSaysItDidNotHappenGoesToTransfer() {
        gateway.next = null;
        cancelAsShopper(null);
        service.confirmChecked(id, false, null, null);
        assertEquals("to_transfer", refund().status());
    }
    @Test void payuPendingIsAskedAgainUntilItsFinal() {
        gateway.charge = new RefundRoute.Charge("payu", "VISA", "tx-9", "ARI100T1", true, Instant.now().minusSeconds(3600));
        gateway.next = new RefundGateway.Result(RefundGateway.Outcome.PENDING, "8455", "");
        cancelAsShopper(null);
        assertEquals("processing", refund().status());
        assertEquals("8455", refund().gatewayReference());
        service.processPending();
        assertEquals("processing", refund().status(), "still under review");
        gateway.checked = new RefundGateway.Result(RefundGateway.Outcome.APPROVED, "8455", "");
        service.processPending();
        assertEquals(OrderStatus.REFUNDED, status());
        assertEquals(1, gateway.calls, "PayU was asked to refund once, then only asked about it");
    }
    @Test void payuWaitsTenMinutesAfterTheCharge() {
        gateway.charge = new RefundRoute.Charge("payu", "VISA", "tx-9", "ARI100T1", true, Instant.now().minusSeconds(120));
        cancelAsShopper(null);
        assertEquals(0, gateway.calls);
        assertEquals("processing", refund().status());
        assertNull(refund().sentAt(), "the periodic job sends it later");
    }
    @Test void withoutCredentialsItIsATransferFromTheStart() {
        gateway.ready = false;
        cancelAsShopper(ACCOUNT);
        assertEquals("to_transfer", refund().status());
        assertEquals(0, gateway.calls);
    }
    @Test void aManualRefundWaitsForTheOneInProgress() {
        gateway.next = new RefundGateway.Result(RefundGateway.Outcome.DECLINED, "", "no");
        cancelAsShopper(null);
        assertThrows(Conflict.class, () -> service.recordRefund(id, new AfterSale.Refund(new BigDecimal("1000"), AfterSale.Method.CASH, "", ""), null));
    }
    @Test void storeOrdersFromThePreviousStoreAreNotCancelledByTheShopper() {
        afterSale.migrated = true;
        assertThrows(Conflict.class, this::cancelShopperRaw);
    }
    @Test void aFailedDeliveryIsCancelledByTheStoreNotByTheShopper() {
        afterSale.stage = "issue";
        assertThrows(Conflict.class, this::cancelShopperRaw, "the package went out");
        service.cancel(id, "Volvió a la tienda", null, false, null).ifPresent(service::process);
        assertEquals(OrderStatus.REFUNDED, status());
    }
    @Test void wompiInProgressIsAskedAboutUntilItsFinal() {
        gateway.next = new RefundGateway.Result(RefundGateway.Outcome.PENDING, "33431", "Wompi lo dejó en estado PENDING");
        cancelAsShopper(null);
        assertEquals("processing", refund().status());
        assertEquals("33431", refund().gatewayReference());
        gateway.checked = new RefundGateway.Result(RefundGateway.Outcome.APPROVED, "33431", "");
        service.processPending();
        assertEquals(OrderStatus.REFUNDED, status());
        assertEquals(1, gateway.calls);
    }
    @Test void anUnknownAnswerWithAnIdIsAskedAboutNotSentAgain() {
        gateway.next = new RefundGateway.Result(RefundGateway.Outcome.UNKNOWN, "33431", "Wompi no dijo en qué estado quedó");
        cancelAsShopper(null);
        assertEquals("processing", refund().status(), "with an id the store can ask");
        gateway.checked = new RefundGateway.Result(RefundGateway.Outcome.DECLINED, "33431", "Rechazado");
        service.processPending();
        assertEquals("to_transfer", refund().status());
        assertEquals(1, gateway.calls);
    }
    @Test void whenTheStoreTurnsItOffOnlyTheStoreCancels() {
        rules.shopperCancels = false;
        assertThrows(Conflict.class, this::cancelShopperRaw);
        assertEquals(OrderStatus.PROCESSING, status());
        service.cancel(id, "Cancelado por la tienda", null, false, null).ifPresent(service::process);
        assertEquals(OrderStatus.REFUNDED, status(), "the store still cancels and refunds");
    }
}
