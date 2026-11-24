package dev.nortech.norpress.catalog.application;
import dev.nortech.norpress.catalog.domain.Product;
import dev.nortech.norpress.inventory.application.StockLedger;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.Objects;
import java.util.UUID;

/** Product use cases. A stock change always needs a reason and is recorded in the inventory ledger. */
@ApplicationScoped
public class CatalogService {
    @Inject ProductRepository products;
    @Inject StockLedger stock;
    @Transactional
    public ProductRepository.ProductView save(Product product, UUID actor, String reason) {
        if (actor == null) throw new IllegalArgumentException("Usuario requerido");
        Integer before = products.lockStock(product.id()).map(ProductRepository.Stock::quantity).orElse(null);
        if (product.taxRateId() != null && !products.taxRateActive(product.taxRateId())) throw new IllegalArgumentException("La tasa de impuesto no existe o está inactiva");
        boolean changed = !Objects.equals(before, product.stockQuantity());
        if (changed && (reason == null || reason.isBlank())) throw new IllegalArgumentException("Indica el motivo del ajuste de inventario");
        products.upsert(product);
        if (changed) stock.recordManualChange(product.id(), before, product.stockQuantity(), reason.trim(), actor);
        return products.view(product.id()).orElseThrow();
    }
}
