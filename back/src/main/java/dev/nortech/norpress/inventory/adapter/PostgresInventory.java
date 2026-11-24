package dev.nortech.norpress.inventory.adapter;
import dev.nortech.norpress.inventory.application.InventoryQueries;
import dev.nortech.norpress.inventory.application.StockLedger;
import dev.nortech.norpress.inventory.domain.MovementKind;
import dev.nortech.norpress.shared.adapter.Jdbc;
import dev.nortech.norpress.shared.application.Page;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.util.*;

@ApplicationScoped
public class PostgresInventory implements InventoryQueries, StockLedger {
    private static final String FILTER = " FROM inventory_adjustment m JOIN product p ON p.id=m.product_id WHERE (?::uuid IS NULL OR m.product_id=?) AND (?='' OR m.kind=?) AND (?='' OR p.title ILIKE ? OR p.sku ILIKE ?)";
    @Inject DataSource db;

    public Page movements(UUID productId, MovementKind kind, String query, Page.Request page) {
        String k=kind==null?"":kind.db(), term=query==null?"":query.trim(), like="%"+term+"%";
        Object[] p={productId,productId,k,k,term,like,like};
        return Jdbc.with(db,c -> new Page(Jdbc.list(c,"SELECT m.id,m.kind,m.product_id,p.title,p.sku,m.quantity_before,m.quantity_after,m.quantity_delta,m.reason,m.created_at,a.email AS actor,o.id AS order_id,o.number AS order_number"
                + FILTER.replace(" WHERE "," LEFT JOIN admin_user a ON a.id=m.actor_id LEFT JOIN order_line l ON l.id=m.order_line_id LEFT JOIN sales_order o ON o.id=l.order_id WHERE ")+" ORDER BY m.created_at DESC,m.id LIMIT ? OFFSET ?",
                productId,productId,k,k,term,like,like,page.limit(),page.offset()), Jdbc.count(c,"SELECT count(*)"+FILTER,p)));
    }
    public List<Map<String,Object>> lowStock(int threshold, int limit) {
        return Jdbc.with(db,c -> Jdbc.list(c,"SELECT p.id,p.title,p.sku,p.stock_quantity,p.stock_status,p.backorders,COALESCE((SELECT sum(l.quantity) FROM order_line l JOIN v_paid_order o ON o.id=l.order_id WHERE l.product_id=p.id AND o.placed_at>now()-interval '180 days'),0) AS units_last_180_days"
            + " FROM product p WHERE p.status='published' AND p.manage_stock AND p.stock_quantity<=? ORDER BY p.stock_quantity,units_last_180_days DESC,p.title LIMIT ?",Math.max(0,threshold),Math.clamp(limit,1,200)));
    }
    public void returnToStock(UUID productId, int quantity, UUID orderLineId, String reason, UUID actor) {
        if(quantity<=0) throw new IllegalArgumentException("La cantidad a devolver debe ser positiva");
        Jdbc.with(db,c -> {
            var product=Jdbc.one(c,"SELECT stock_quantity,manage_stock FROM product WHERE id=? FOR UPDATE",productId).orElseThrow(() -> new NotFound("Producto no encontrado"));
            Integer before=(Integer)product.get("stockQuantity"), after=Boolean.TRUE.equals(product.get("manageStock")) && before!=null ? before+quantity : null;
            if(after!=null) Jdbc.update(c,"UPDATE product SET stock_quantity=?,stock_status=CASE WHEN stock_status='outofstock' THEN 'instock' ELSE stock_status END,updated_at=now() WHERE id=?",after,productId);
            return Jdbc.update(c,"INSERT INTO inventory_adjustment(id,product_id,quantity_before,quantity_after,quantity_delta,reason,actor_id,kind,order_line_id) VALUES(?,?,?,?,?,?,?,'cancel',?)",
                UUID.randomUUID(),productId,after==null?null:before,after,quantity,reason,actor,orderLineId);
        });
    }
    public int takeForSale(UUID productId, int quantity, UUID orderLineId, String reason) {
        if(quantity<=0) throw new IllegalArgumentException("La cantidad debe ser positiva");
        return Jdbc.with(db,c -> {
            var product=Jdbc.one(c,"SELECT title,stock_quantity,manage_stock,backorders FROM product WHERE id=? FOR UPDATE",productId).orElseThrow(() -> new NotFound("Producto no encontrado"));
            if(!Boolean.TRUE.equals(product.get("manageStock"))) return 0;
            int before=product.get("stockQuantity")==null?0:(Integer)product.get("stockQuantity");
            boolean backorders=!"no".equals(product.get("backorders"));
            if(before<quantity && !backorders) throw new dev.nortech.norpress.shared.domain.Conflict(before<=0 ? "«"+product.get("title")+"» se agotó" : "De «"+product.get("title")+"» solo quedan "+before+" unidades");
            // with backorders the shelf stops at zero; only what was really there is reduced and can be returned
            int taken=Math.min(before,quantity), after=before-taken;
            Jdbc.update(c,"UPDATE product SET stock_quantity=?,stock_status=CASE WHEN ?=0 THEN (CASE WHEN backorders='no' THEN 'outofstock' ELSE 'onbackorder' END) ELSE stock_status END,updated_at=now() WHERE id=?",after,after,productId);
            Jdbc.update(c,"INSERT INTO inventory_adjustment(id,product_id,quantity_before,quantity_after,quantity_delta,reason,kind,order_line_id) VALUES(?,?,?,?,?,?,'sale',?)",UUID.randomUUID(),productId,before,after,-taken,reason,orderLineId);
            return taken;
        });
    }
    public void recordManualChange(UUID productId, Integer before, Integer after, String reason, UUID actor) {
        Jdbc.with(db,c -> Jdbc.update(c,"INSERT INTO inventory_adjustment(id,product_id,quantity_before,quantity_after,quantity_delta,reason,actor_id,kind) VALUES (?,?,?,?,?,?,?,'manual')",
            UUID.randomUUID(),productId,before,after,before==null || after==null?null:after-before,reason,actor));
    }
}
