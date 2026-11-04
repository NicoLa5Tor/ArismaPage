-- One stage per order, combining payment (sales) and delivery (fulfillment), so the panel shows a single journey:
-- unpaid → to_prepare → packed → shipped → delivered, plus issue (on hold, not delivered, returned) and cancelled.
-- Cash-on-delivery orders are dispatched before payment, so they never sit in "unpaid".
CREATE VIEW v_order_stage AS
  SELECT o.id AS order_id, d.status AS delivery_status, d.method AS delivery_method,
    CASE
      WHEN o.status IN ('cancelled','failed','refunded') THEN 'cancelled'
      WHEN o.status = 'completed' OR d.status = 'delivered' THEN 'delivered'
      WHEN o.status = 'on_hold' OR d.status IN ('failed','returned') THEN 'issue'
      WHEN o.status = 'pending' AND COALESCE(o.payment_method, '') <> 'cod' THEN 'unpaid'
      WHEN d.status = 'shipped' THEN 'shipped'
      WHEN d.status = 'packed' THEN 'packed'
      ELSE 'to_prepare'
    END AS stage
  FROM sales_order o JOIN v_delivery d ON d.order_id = o.id;
