-- The shopper asks to cancel an order; the store approves (the order is cancelled) or rejects it with an answer.
CREATE TABLE order_cancellation_request (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected')),
  answer text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES admin_user(id)
);
-- one open request per order at a time
CREATE UNIQUE INDEX order_cancellation_request_open ON order_cancellation_request(order_id) WHERE status = 'requested';
CREATE INDEX order_cancellation_request_order ON order_cancellation_request(order_id, requested_at);

-- Money given back to the shopper. The store returns it in the gateway's own dashboard, by transfer or in cash, and
-- records here how much, how and its reference; when everything paid is back, the order becomes refunded.
CREATE TABLE order_refund (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('gateway', 'transfer', 'cash', 'other')),
  reference text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  refunded_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES admin_user(id)
);
CREATE INDEX order_refund_order ON order_refund(order_id, refunded_at);
