-- Each payment method keeps two sets of credentials, tests and production; one store setting says which method is
-- active and which set it uses. Transfer instructions do not change between environments and are kept as 'live'.
CREATE TABLE payment_credential (
  code text NOT NULL CHECK (code IN ('wompi','payu','manual')),
  environment text NOT NULL CHECK (environment IN ('test','live')),
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb, secret_cipher text,
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  PRIMARY KEY (code, environment));

INSERT INTO payment_credential(code, environment, public_config, secret_cipher, updated_at, updated_by)
SELECT code, CASE WHEN code = 'manual' OR NOT sandbox THEN 'live' ELSE 'test' END, public_config, secret_cipher, updated_at, updated_by FROM payment_gateway
WHERE public_config <> '{}'::jsonb OR secret_cipher IS NOT NULL;

-- the first method that was switched on becomes the active one, in the environment it was using
INSERT INTO store_setting(key, value)
SELECT 'payments', jsonb_build_object('active', COALESCE((SELECT code FROM payment_gateway WHERE enabled ORDER BY code = 'manual', code LIMIT 1), ''),
  'mode', CASE WHEN EXISTS (SELECT 1 FROM payment_gateway WHERE enabled AND NOT sandbox AND code <> 'manual') THEN 'live' ELSE 'test' END)
ON CONFLICT (key) DO NOTHING;

DROP TABLE payment_gateway;

-- Orders placed while payments are in test mode are real rows (they follow the whole journey) but never count as
-- sales: the paid-orders view, which every report reads, leaves them out.
ALTER TABLE sales_order ADD COLUMN test boolean NOT NULL DEFAULT false;
CREATE OR REPLACE VIEW v_paid_order AS SELECT * FROM sales_order WHERE status IN ('processing','completed','on_hold') AND NOT test;
