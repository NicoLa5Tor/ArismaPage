-- Delivery state of every order, even before its shipment row exists (created on the first delivery step).
-- Read models use this view so new orders appear on the dispatch board right away.
CREATE VIEW v_delivery AS
  SELECT o.id AS order_id, s.id AS shipment_id,
    COALESCE(s.status, CASE WHEN o.status IN ('cancelled','failed','refunded') THEN 'cancelled' WHEN o.status = 'completed' THEN 'delivered' ELSE 'pending' END) AS status,
    COALESCE(s.method, CASE WHEN EXISTS (SELECT 1 FROM order_shipping x WHERE x.order_id = o.id AND x.method = 'local_pickup') THEN 'pickup' ELSE 'carrier' END) AS method,
    s.carrier, s.tracking_code, s.courier_user_id, s.courier_name, s.recipient_name, s.failure_reason, s.delivered_at,
    COALESCE(s.updated_at, o.placed_at) AS updated_at
  FROM sales_order o LEFT JOIN shipment s ON s.order_id = o.id;
