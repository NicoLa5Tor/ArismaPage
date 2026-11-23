-- The customer's address book, like Mercado Libre: saved addresses tied to the customer, one of them the default,
-- picked at checkout. The older `address` table keeps what the WooCommerce import brought and is left as it was.
CREATE TABLE customer_address (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (label IN ('casa','trabajo','otro')),
  recipient text NOT NULL,
  phone text NOT NULL,
  state text NOT NULL,
  city text NOT NULL,
  neighborhood text NOT NULL DEFAULT '',
  street text NOT NULL,
  detail text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_address_customer ON customer_address(customer_id, created_at DESC);
-- one default per customer
CREATE UNIQUE INDEX customer_address_default ON customer_address(customer_id) WHERE is_default;
