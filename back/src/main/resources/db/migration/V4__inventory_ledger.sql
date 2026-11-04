-- Inventory ledger: every stock change records why it happened (manual edit, sale, cancellation or import).
ALTER TABLE inventory_adjustment
  ADD COLUMN kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','sale','cancel','import')),
  ADD COLUMN order_line_id uuid REFERENCES order_line(id) ON DELETE SET NULL,
  ADD COLUMN quantity_delta integer,
  ADD COLUMN source_key text UNIQUE,
  ALTER COLUMN actor_id DROP NOT NULL;
UPDATE inventory_adjustment SET quantity_delta = quantity_after - quantity_before WHERE quantity_before IS NOT NULL AND quantity_after IS NOT NULL;
CREATE INDEX inventory_adjustment_product ON inventory_adjustment(product_id, created_at DESC);
CREATE INDEX inventory_adjustment_kind ON inventory_adjustment(kind, created_at DESC);

-- Paid orders: processing, completed and on hold. Pending, failed and cancelled never count as sales.
CREATE VIEW v_paid_order AS SELECT * FROM sales_order WHERE status IN ('processing','completed','on_hold');

CREATE VIEW v_sales_daily AS
  SELECT (placed_at AT TIME ZONE 'America/Bogota')::date AS day, count(*) AS orders, sum(total) AS total, sum(subtotal - discount_total) AS net, sum(tax_total) AS tax, sum(shipping_total) AS shipping
  FROM v_paid_order GROUP BY 1;

CREATE VIEW v_product_sales AS
  SELECT l.product_id, sum(l.quantity) AS units, sum(l.total) AS net_revenue, count(DISTINCT l.order_id) AS orders, max(o.placed_at) AS last_sold_at,
         (array_agg(l.unit_price ORDER BY o.placed_at DESC))[1] AS last_unit_price
  FROM order_line l JOIN v_paid_order o ON o.id = l.order_id WHERE l.product_id IS NOT NULL GROUP BY l.product_id;

CREATE VIEW v_customer_stats AS
  SELECT c.id AS customer_id, count(o.id) AS orders, coalesce(sum(o.total),0) AS total_spent, max(o.placed_at) AS last_order_at
  FROM customer c LEFT JOIN v_paid_order o ON o.customer_id = c.id GROUP BY c.id;
