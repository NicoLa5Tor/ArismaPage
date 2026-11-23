-- Store accounts for shoppers, apart from panel users. An account points to a customer row (created when missing).
-- email_verified is true only when an identity provider vouched for the address (Google or Facebook through Logto):
-- nothing tied to the purchase history of that email is shown to an unverified account.
CREATE TABLE customer_account (
  id uuid PRIMARY KEY, customer_id uuid NOT NULL UNIQUE REFERENCES customer(id),
  email text NOT NULL, name text NOT NULL,
  password_hash text, email_verified boolean NOT NULL DEFAULT false,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0), locked_until timestamptz,
  last_login_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX customer_account_email ON customer_account(lower(email));
CREATE TABLE customer_session (
  token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES customer_account(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL);
CREATE INDEX customer_session_account ON customer_session(account_id);

-- The same Logto callback serves the panel and the store; an attempt started for one cannot be finished in the other.
ALTER TABLE social_login_attempt ADD COLUMN audience text NOT NULL DEFAULT 'admin' CHECK (audience IN ('admin','shop'));
