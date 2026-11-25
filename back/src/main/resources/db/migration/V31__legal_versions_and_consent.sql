-- The store's legal documents (terms, data policy, returns and refunds, shipping) are edited as drafts in
-- store_setting 'legal'; publishing copies the draft here as the next version, never changed again. The store serves
-- the latest version, and every acceptance points to the version the person saw.
CREATE TABLE legal_version (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('terms','privacy','returns','shipping')),
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL,
  content jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  UNIQUE (kind, version));

-- Proof that someone accepted a document: which version, when, from where, and on which occasion (placing an order,
-- creating an account, signing in with Google or Facebook for the first time with that version).
CREATE TABLE legal_acceptance (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES legal_version(id),
  context text NOT NULL CHECK (context IN ('checkout','signup','social')),
  order_id uuid REFERENCES sales_order(id) ON DELETE SET NULL,
  account_id uuid REFERENCES customer_account(id) ON DELETE SET NULL,
  ip text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  accepted_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX legal_acceptance_order ON legal_acceptance(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX legal_acceptance_account ON legal_acceptance(account_id, version_id) WHERE account_id IS NOT NULL;

-- What a store had published until now becomes version 1 of each page.
INSERT INTO legal_version(id, kind, version, title, content)
SELECT gen_random_uuid(), k.kind, 1, COALESCE(s.value->k.kind->>'title', ''),
       jsonb_build_object('blocks', COALESCE(s.value->k.kind->'blocks', '[]'::jsonb), 'documents', COALESCE(s.value->k.kind->'documents', '[]'::jsonb))
FROM store_setting s CROSS JOIN (VALUES ('terms'), ('privacy')) AS k(kind)
WHERE s.key = 'legal'
  AND (jsonb_array_length(COALESCE(s.value->k.kind->'blocks', '[]'::jsonb)) > 0 OR jsonb_array_length(COALESCE(s.value->k.kind->'documents', '[]'::jsonb)) > 0);
