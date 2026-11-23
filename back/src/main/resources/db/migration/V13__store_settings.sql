-- What the administrator configures for the public store. Each key holds one small JSON document checked by the domain.
CREATE TABLE store_setting (
  key text PRIMARY KEY, value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES admin_user(id) ON DELETE SET NULL);

-- Payment methods offered at checkout. Secrets (API keys) are stored encrypted with a key that lives outside the database.
CREATE TABLE payment_gateway (
  code text PRIMARY KEY CHECK (code IN ('wompi','payu','manual')),
  enabled boolean NOT NULL DEFAULT false, sandbox boolean NOT NULL DEFAULT true,
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb, secret_cipher text,
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES admin_user(id) ON DELETE SET NULL);
INSERT INTO payment_gateway(code) VALUES ('wompi'), ('payu'), ('manual');
