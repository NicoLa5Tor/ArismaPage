-- One-time links sent by email: confirm an address, or choose a new password. Stored only as digests.
CREATE TABLE account_token (
  token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES customer_account(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify','reset')),
  expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX account_token_account ON account_token(account_id, purpose, created_at DESC);

-- Every email the store writes. 'stored' means there is no mail server configured: it stays here, readable in the
-- panel, and is not sent. 'pending' waits for the next delivery round; failures are retried a few times.
CREATE TABLE mail_outbox (
  id uuid PRIMARY KEY, kind text NOT NULL, recipient text NOT NULL, subject text NOT NULL, body_text text NOT NULL, body_html text NOT NULL,
  status text NOT NULL CHECK (status IN ('stored','pending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0, last_error text, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz);
CREATE INDEX mail_outbox_due ON mail_outbox(next_attempt_at) WHERE status = 'pending';
CREATE INDEX mail_outbox_created ON mail_outbox(created_at DESC);
