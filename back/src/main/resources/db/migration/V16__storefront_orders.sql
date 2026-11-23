-- Orders placed in the new store continue the WooCommerce numbering.
CREATE SEQUENCE sales_order_number_seq;
SELECT setval('sales_order_number_seq', GREATEST((SELECT COALESCE(max(number::bigint), 0) FROM sales_order WHERE number ~ '^[0-9]{1,12}$'), 20000));

-- The shopper follows an order with its number plus a secret only they received (stored as a digest).
-- account_id links the order to the store account that placed it, when there was one.
ALTER TABLE sales_order
  ADD COLUMN public_token_hash text,
  ADD COLUMN account_id uuid REFERENCES customer_account(id) ON DELETE SET NULL,
  ADD COLUMN expires_at timestamptz;
CREATE INDEX sales_order_unpaid_expiry ON sales_order(expires_at) WHERE status = 'pending' AND expires_at IS NOT NULL;

-- One row per try at paying an order. The reference is what the gateway sees; it is unique per try because gateways
-- refuse to reuse one. A row becomes 'approved' at most once, which is what makes confirmations idempotent.
CREATE TABLE payment_attempt (
  reference text PRIMARY KEY, order_id uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  gateway text NOT NULL CHECK (gateway IN ('wompi','payu','manual')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0), sandbox boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started','pending','approved','declined','voided','error')),
  external_id text, detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX payment_attempt_order ON payment_attempt(order_id, created_at DESC);
