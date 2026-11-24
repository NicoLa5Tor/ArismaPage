-- Refunds that move money: through the gateway that charged (Wompi or PayU) or by transfer to the shopper's account.
--   route:  manual (recorded by the store after doing it itself), wompi, payu, transfer
--   status: processing (sent or about to be sent to the gateway), checking (the gateway did not answer: the store looks
--           in the gateway's dashboard), to_transfer (the store must transfer it), succeeded
ALTER TABLE order_refund
  ADD COLUMN route text NOT NULL DEFAULT 'manual' CHECK (route IN ('manual', 'wompi', 'payu', 'transfer')),
  ADD COLUMN status text NOT NULL DEFAULT 'succeeded' CHECK (status IN ('processing', 'checking', 'to_transfer', 'succeeded')),
  ADD COLUMN requested_by text NOT NULL DEFAULT 'store' CHECK (requested_by IN ('shopper', 'store')),
  ADD COLUMN gateway_reference text NOT NULL DEFAULT '',
  ADD COLUMN failure text NOT NULL DEFAULT '',
  ADD COLUMN sent_at timestamptz,
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
UPDATE order_refund SET completed_at = refunded_at WHERE completed_at IS NULL;
-- one refund in progress per order at a time: a second click or a second tab finds the first one
CREATE UNIQUE INDEX order_refund_open ON order_refund(order_id) WHERE status IN ('processing', 'checking', 'to_transfer');
CREATE INDEX order_refund_pending ON order_refund(status, sent_at) WHERE status IN ('processing', 'checking', 'to_transfer');

-- Where to transfer a refund: the shopper's bank account or wallet, sealed with the store's secrets key. Only the
-- panel opens it, every opening is recorded, and it is deleted once the refund is done.
CREATE TABLE refund_payout (
  order_id uuid PRIMARY KEY REFERENCES sales_order(id) ON DELETE CASCADE,
  sealed text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
