-- Delivery is tracked apart from payment: an order can be paid and still waiting to be packed.
CREATE TABLE shipment (
  id uuid PRIMARY KEY, order_id uuid NOT NULL UNIQUE REFERENCES sales_order(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('carrier','courier','pickup')),
  status text NOT NULL CHECK (status IN ('pending','packed','shipped','delivered','failed','returned','cancelled')),
  carrier text, tracking_code text, courier_user_id uuid REFERENCES admin_user(id) ON DELETE SET NULL, courier_name text,
  recipient_name text, failure_reason text,
  packed_at timestamptz, shipped_at timestamptz, delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES admin_user(id) ON DELETE SET NULL);
CREATE INDEX shipment_status ON shipment(status, updated_at DESC);
CREATE TABLE shipment_event (
  id uuid PRIMARY KEY, shipment_id uuid NOT NULL REFERENCES shipment(id) ON DELETE CASCADE,
  from_status text, to_status text NOT NULL, actor_id uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX shipment_event_shipment ON shipment_event(shipment_id, created_at);

-- Backfill from the WooCommerce history: completed orders were delivered; paid open orders wait to be prepared.
INSERT INTO shipment(id, order_id, method, status, carrier, tracking_code, delivered_at, created_at, updated_at)
SELECT gen_random_uuid(), o.id,
  CASE WHEN s.method = 'local_pickup' THEN 'pickup' ELSE 'carrier' END,
  CASE o.status WHEN 'completed' THEN 'delivered' WHEN 'cancelled' THEN 'cancelled' WHEN 'failed' THEN 'cancelled' WHEN 'refunded' THEN 'cancelled' ELSE 'pending' END,
  NULLIF(s.carrier, ''), NULLIF(s.tracking_code, ''),
  CASE WHEN o.status = 'completed' THEN COALESCE(o.completed_at, o.paid_at, o.placed_at) END,
  o.placed_at, COALESCE(o.completed_at, o.placed_at)
FROM sales_order o LEFT JOIN LATERAL (SELECT method, carrier, tracking_code FROM order_shipping WHERE order_id = o.id LIMIT 1) s ON true;
INSERT INTO shipment_event(id, shipment_id, from_status, to_status, note, created_at)
SELECT gen_random_uuid(), id, NULL, status, 'Estado inicial calculado desde WooCommerce', updated_at FROM shipment;
