-- The invoice of an order. The store makes it in its own billing program; here it attaches the PDF and sends it to
-- the customer (email with the file, WhatsApp with a download link). An order is finished once delivered and invoiced.
CREATE TABLE order_invoice (
  order_id uuid PRIMARY KEY REFERENCES sales_order(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('uploaded','sent','not_needed')),
  number text,
  object_key text,
  file_name text,
  size_bytes integer,
  -- the download link given to the customer: random, unguessable, one per uploaded file
  token text UNIQUE,
  channels text[] NOT NULL DEFAULT '{}',
  sent_to text,
  uploaded_at timestamptz,
  uploaded_by uuid REFERENCES admin_user(id),
  sent_at timestamptz,
  sent_by uuid REFERENCES admin_user(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'not_needed' OR (object_key IS NOT NULL AND token IS NOT NULL))
);

-- Orders closed before invoices were sent from here stay finished: nobody has to invoice the past again.
INSERT INTO order_invoice(order_id, status)
  SELECT id, 'not_needed' FROM sales_order WHERE status IN ('completed','cancelled','failed','refunded');

-- Files that go with an email (name, where the file is kept, type); the bytes are read when it is sent.
ALTER TABLE mail_outbox ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]';

-- A delivered order whose invoice has not been sent (or marked as not needed) is "to_invoice"; once it is, "delivered" (finished).
CREATE OR REPLACE VIEW v_order_stage AS
  SELECT o.id AS order_id, d.status AS delivery_status, d.method AS delivery_method,
    CASE
      WHEN o.status IN ('cancelled','failed','refunded') THEN 'cancelled'
      WHEN (o.status = 'completed' OR d.status = 'delivered') AND COALESCE(i.status, '') NOT IN ('sent','not_needed') THEN 'to_invoice'
      WHEN o.status = 'completed' OR d.status = 'delivered' THEN 'delivered'
      WHEN o.status = 'on_hold' OR d.status IN ('failed','returned') THEN 'issue'
      WHEN o.status = 'pending' AND COALESCE(o.payment_method, '') <> 'cod' THEN 'unpaid'
      WHEN d.status = 'shipped' THEN 'shipped'
      WHEN d.status = 'packed' THEN 'packed'
      ELSE 'to_prepare'
    END AS stage
  FROM sales_order o JOIN v_delivery d ON d.order_id = o.id LEFT JOIN order_invoice i ON i.order_id = o.id;
