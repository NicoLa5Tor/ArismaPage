-- Conversations on a product: reviews (with a 1 to 5 rating) and questions, each with replies from the store or from
-- other shoppers. Nothing is shown publicly until it is 'published'.
CREATE TABLE product_post (
  id uuid PRIMARY KEY, product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  account_id uuid REFERENCES customer_account(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('review','question')),
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL, author_name text NOT NULL, verified_purchase boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN ('pending','published','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  source_key text UNIQUE,
  CHECK ((kind = 'review') = (rating IS NOT NULL)));
-- one review per account and product; questions are not limited
CREATE UNIQUE INDEX product_post_one_review ON product_post(product_id, account_id) WHERE kind = 'review' AND account_id IS NOT NULL;
CREATE INDEX product_post_product ON product_post(product_id, kind, status, created_at DESC);
CREATE INDEX product_post_status ON product_post(status, created_at);
CREATE INDEX product_post_account ON product_post(account_id, created_at DESC);

CREATE TABLE product_post_reply (
  id uuid PRIMARY KEY, post_id uuid NOT NULL REFERENCES product_post(id) ON DELETE CASCADE,
  account_id uuid REFERENCES customer_account(id) ON DELETE SET NULL,
  admin_id uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  staff boolean NOT NULL DEFAULT false, author_name text NOT NULL, body text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','published','hidden')),
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX product_post_reply_post ON product_post_reply(post_id, created_at);
CREATE INDEX product_post_reply_status ON product_post_reply(status, created_at);
