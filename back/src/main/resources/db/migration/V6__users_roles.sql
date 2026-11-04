-- Panel users with roles, account state and login throttling. Existing users are administrators.
ALTER TABLE admin_user
  ADD COLUMN name text NOT NULL DEFAULT '',
  ADD COLUMN role text NOT NULL DEFAULT 'seller' CHECK (role IN ('admin','seller')),
  ADD COLUMN active boolean NOT NULL DEFAULT true,
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN last_login_at timestamptz,
  ADD COLUMN failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  ADD COLUMN locked_until timestamptz,
  ADD COLUMN created_by uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
UPDATE admin_user SET role = 'admin', name = split_part(email, '@', 1);
CREATE INDEX admin_session_user ON admin_session(user_id);
