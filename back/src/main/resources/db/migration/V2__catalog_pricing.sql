-- Configurable tax rates. Product prices are stored without tax; the final price is derived.
CREATE TABLE tax_rate (id uuid PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL, percent numeric(5,2) NOT NULL CHECK (percent >= 0 AND percent < 100), active boolean NOT NULL DEFAULT true, source_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO tax_rate(id,code,name,percent,source_key) VALUES ('5b0f8a52-6a39-4e0e-9a43-2f1c4a6b1901','iva-19','IVA 19 %',19,'wordpress:tax_class:iva'), ('5b0f8a52-6a39-4e0e-9a43-2f1c4a6b1900','exento','Exento',0,'wordpress:tax_status:none');

ALTER TABLE product
  ADD COLUMN regular_price numeric(14,2) CHECK (regular_price >= 0),
  ADD COLUMN sale_price numeric(14,2) CHECK (sale_price >= 0),
  ADD COLUMN sale_starts_at timestamptz,
  ADD COLUMN sale_ends_at timestamptz,
  ADD COLUMN tax_rate_id uuid REFERENCES tax_rate(id),
  ADD COLUMN manage_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN stock_status text NOT NULL DEFAULT 'instock' CHECK (stock_status IN ('instock','outofstock','onbackorder')),
  ADD COLUMN backorders text NOT NULL DEFAULT 'no' CHECK (backorders IN ('no','notify','yes')),
  ADD COLUMN hide_price boolean NOT NULL DEFAULT false,
  ADD COLUMN featured boolean NOT NULL DEFAULT false,
  ADD COLUMN sold_individually boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT product_sale_below_regular CHECK (sale_price IS NULL OR regular_price IS NULL OR sale_price <= regular_price),
  ADD CONSTRAINT product_sale_window CHECK (sale_starts_at IS NULL OR sale_ends_at IS NULL OR sale_starts_at < sale_ends_at);
-- price_cop is deprecated: it held the WooCommerce tax-exclusive _price. Kept until all readers move to regular_price.
-- tax_rate_id is filled by the WooCommerce importer (taxable vs exempt); NULL means not yet classified.
UPDATE product SET regular_price = price_cop, manage_stock = stock_quantity IS NOT NULL;
CREATE INDEX product_status_title ON product(status, title);

ALTER TABLE product_image ADD COLUMN alt text NOT NULL DEFAULT '', ADD COLUMN is_primary boolean NOT NULL DEFAULT false;
UPDATE product_image SET is_primary = true WHERE position = 0;
CREATE INDEX product_image_product ON product_image(product_id, position);
CREATE UNIQUE INDEX product_image_one_primary ON product_image(product_id) WHERE is_primary;

-- Attributes are filters and descriptive data, not sellable variants.
CREATE TABLE attribute (id uuid PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL, filterable boolean NOT NULL DEFAULT true);
CREATE TABLE attribute_value (id uuid PRIMARY KEY, attribute_id uuid NOT NULL REFERENCES attribute(id) ON DELETE CASCADE, slug text NOT NULL, name text NOT NULL, UNIQUE (attribute_id, slug));
CREATE TABLE product_attribute_value (product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE, attribute_value_id uuid NOT NULL REFERENCES attribute_value(id) ON DELETE CASCADE, PRIMARY KEY (product_id, attribute_value_id));
CREATE INDEX product_attribute_value_value ON product_attribute_value(attribute_value_id);
CREATE INDEX product_category_category ON product_category(category_id);
