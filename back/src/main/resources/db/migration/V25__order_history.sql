-- The work list shows only what the store still has to do. Finished and cancelled orders, and every order brought
-- from the previous store (WooCommerce), live in the history. A migrated order can be brought back to the work list
-- (kept_active) when it still needs attention.
ALTER TABLE sales_order ADD COLUMN kept_active boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW v_order_stage AS
  SELECT s.order_id, s.delivery_status, s.delivery_method, s.stage,
    (s.stage IN ('delivered','cancelled') OR (o.source_key IS NOT NULL AND NOT o.kept_active)) AS in_history
  FROM (
    SELECT o.id AS order_id, d.status AS delivery_status, d.method AS delivery_method,
      CASE
        WHEN o.status IN ('cancelled','failed','refunded') THEN 'cancelled'
        WHEN (o.status = 'completed' OR d.status = 'delivered') AND COALESCE(i.status, '') NOT IN ('sent','not_needed') THEN 'to_invoice'
        WHEN o.status = 'completed' OR d.status = 'delivered' THEN 'delivered'
        WHEN o.status = 'on_hold' OR d.status IN ('failed','returned') THEN 'issue'
        WHEN o.status = 'pending' AND COALESCE(o.payment_method, '') <> 'cod' THEN 'unpaid'
        WHEN d.status = 'shipped' THEN 'shipped'
        WHEN d.status = 'packed' THEN 'packed'
        ELSE 'to_prepare'
      END AS stage
    FROM sales_order o JOIN v_delivery d ON d.order_id = o.id LEFT JOIN order_invoice i ON i.order_id = o.id
  ) s JOIN sales_order o ON o.id = s.order_id;
