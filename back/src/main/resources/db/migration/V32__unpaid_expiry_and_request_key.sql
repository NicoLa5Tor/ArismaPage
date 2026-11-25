-- An order cancelled because its time to pay ran out (not by anyone): a payment that arrives late may bring it back.
ALTER TABLE sales_order ADD COLUMN unpaid_expired_at timestamptz;

-- The key the checkout sends with each try at placing an order: the same try sent twice (a double click, a network
-- retry) finds the order the first one made instead of making a second one.
ALTER TABLE sales_order ADD COLUMN request_key text;
CREATE UNIQUE INDEX sales_order_request_key ON sales_order(account_id, request_key) WHERE request_key IS NOT NULL;
