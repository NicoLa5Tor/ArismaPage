CREATE TABLE social_login_attempt (
  state_hash varchar(64) PRIMARY KEY,
  verifier varchar(128) NOT NULL,
  nonce varchar(128) NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX social_login_attempt_expiry ON social_login_attempt(expires_at);
