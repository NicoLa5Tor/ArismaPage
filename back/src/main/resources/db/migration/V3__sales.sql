-- Customers, orders, payments, coupons and quotes. Order lines keep a snapshot of what was sold.
CREATE TABLE customer (id uuid PRIMARY KEY, source_key text UNIQUE, wp_user_id bigint UNIQUE, email text, first_name text NOT NULL DEFAULT '', last_name text NOT NULL DEFAULT '', phone text, document_type text, document_number text, company text, has_account boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX customer_email ON customer(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX customer_search ON customer(lower(last_name), lower(first_name));
CREATE TABLE address (id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE, kind text NOT NULL CHECK (kind IN ('billing','shipping')), first_name text NOT NULL DEFAULT '', last_name text NOT NULL DEFAULT '', line1 text NOT NULL DEFAULT '', line2 text NOT NULL DEFAULT '', city text NOT NULL DEFAULT '', state text NOT NULL DEFAULT '', postcode text NOT NULL DEFAULT '', country text NOT NULL DEFAULT 'CO', phone text, UNIQUE (customer_id, kind));

CREATE TABLE coupon (id uuid PRIMARY KEY, source_key text UNIQUE, code text NOT NULL, kind text NOT NULL CHECK (kind IN ('fixed_cart','percent','fixed_product')), amount numeric(14,2) NOT NULL CHECK (amount >= 0), minimum_amount numeric(14,2) CHECK (minimum_amount >= 0), maximum_amount numeric(14,2) CHECK (maximum_amount >= 0), usage_limit integer CHECK (usage_limit >= 0), usage_limit_per_customer integer CHECK (usage_limit_per_customer >= 0), individual_use boolean NOT NULL DEFAULT false, free_shipping boolean NOT NULL DEFAULT false, exclude_sale_items boolean NOT NULL DEFAULT false, expires_at timestamptz, active boolean NOT NULL DEFAULT true, description text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK (kind <> 'percent' OR amount <= 100));
CREATE UNIQUE INDEX coupon_code ON coupon(lower(code));

CREATE TABLE sales_order (
  id uuid PRIMARY KEY, source_key text UNIQUE, number text NOT NULL UNIQUE, customer_id uuid REFERENCES customer(id),
  status text NOT NULL CHECK (status IN ('pending','on_hold','processing','completed','cancelled','failed','refunded')),
  currency text NOT NULL DEFAULT 'COP',
  subtotal numeric(14,2) NOT NULL DEFAULT 0, discount_total numeric(14,2) NOT NULL DEFAULT 0, shipping_total numeric(14,2) NOT NULL DEFAULT 0, tax_total numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL DEFAULT 0,
  prices_include_tax boolean NOT NULL DEFAULT false, payment_method text, payment_method_title text, created_via text,
  placed_at timestamptz NOT NULL, paid_at timestamptz, completed_at timestamptz,
  billing jsonb NOT NULL DEFAULT '{}'::jsonb, shipping jsonb NOT NULL DEFAULT '{}'::jsonb, customer_note text NOT NULL DEFAULT '',
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sales_order_status_placed ON sales_order(status, placed_at DESC);
CREATE INDEX sales_order_placed ON sales_order(placed_at DESC);
CREATE INDEX sales_order_customer ON sales_order(customer_id, placed_at DESC);

CREATE TABLE order_line (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE, product_id uuid REFERENCES product(id), sku text, title text NOT NULL, quantity integer NOT NULL CHECK (quantity > 0), unit_price numeric(14,2) NOT NULL, subtotal numeric(14,2) NOT NULL, discount numeric(14,2) NOT NULL DEFAULT 0, tax numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL, tax_rate_percent numeric(5,2), stock_reduced integer NOT NULL DEFAULT 0, source_key text UNIQUE);
CREATE INDEX order_line_order ON order_line(order_id);
CREATE INDEX order_line_product ON order_line(product_id);

CREATE TABLE order_shipping (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE, method text NOT NULL, label text NOT NULL DEFAULT '', cost numeric(14,2) NOT NULL DEFAULT 0, tax numeric(14,2) NOT NULL DEFAULT 0, tracking_code text, carrier text, picked_up_at timestamptz, source_key text UNIQUE);
CREATE INDEX order_shipping_order ON order_shipping(order_id);
CREATE TABLE order_discount (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE, coupon_id uuid REFERENCES coupon(id), code text NOT NULL, amount numeric(14,2) NOT NULL DEFAULT 0, tax numeric(14,2) NOT NULL DEFAULT 0, source_key text UNIQUE);
CREATE INDEX order_discount_order ON order_discount(order_id);
CREATE INDEX order_discount_coupon ON order_discount(coupon_id);
CREATE TABLE payment_transaction (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE, provider text NOT NULL, external_id text, payment_type text, status text NOT NULL DEFAULT 'approved', amount numeric(14,2), paid_at timestamptz, raw jsonb NOT NULL DEFAULT '{}'::jsonb, source_key text UNIQUE);
CREATE INDEX payment_transaction_order ON payment_transaction(order_id);
CREATE TABLE order_status_history (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE, from_status text, to_status text NOT NULL, actor_id uuid REFERENCES admin_user(id), note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX order_status_history_order ON order_status_history(order_id, created_at);

CREATE TABLE quote_request (id uuid PRIMARY KEY, source_key text UNIQUE, number text NOT NULL UNIQUE, customer_id uuid REFERENCES customer(id), name text NOT NULL DEFAULT '', email text, message text NOT NULL DEFAULT '', status text NOT NULL CHECK (status IN ('pending','accepted','rejected','expired','converted')), order_id uuid REFERENCES sales_order(id), subtotal numeric(14,2) NOT NULL DEFAULT 0, tax_total numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL DEFAULT 0, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE INDEX quote_request_status_created ON quote_request(status, created_at DESC);
CREATE INDEX quote_request_customer ON quote_request(customer_id);
CREATE TABLE quote_line (id uuid PRIMARY KEY, quote_id uuid NOT NULL REFERENCES quote_request(id) ON DELETE CASCADE, product_id uuid REFERENCES product(id), sku text, title text NOT NULL, quantity integer NOT NULL CHECK (quantity > 0), unit_price numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL DEFAULT 0, source_key text UNIQUE);
CREATE INDEX quote_line_quote ON quote_line(quote_id);
CREATE INDEX quote_line_product ON quote_line(product_id);

-- Internal and customer-visible notes (WooCommerce order_note comments) for orders and quotes.
CREATE TABLE order_note (id uuid PRIMARY KEY, order_id uuid REFERENCES sales_order(id) ON DELETE CASCADE, quote_id uuid REFERENCES quote_request(id) ON DELETE CASCADE, body text NOT NULL, author text NOT NULL DEFAULT '', actor_id uuid REFERENCES admin_user(id), customer_visible boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), source_key text UNIQUE, CHECK ((order_id IS NULL) <> (quote_id IS NULL)));
CREATE INDEX order_note_order ON order_note(order_id, created_at);
CREATE INDEX order_note_quote ON order_note(quote_id, created_at);
