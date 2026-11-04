-- Gallery: the primary image is always position 0; uploaded files keep their type and size.
ALTER TABLE product_image ADD COLUMN content_type text, ADD COLUMN byte_size integer CHECK (byte_size > 0), ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX product_image_position ON product_image(product_id, position);

-- Cover image per product, for thumbnails in lists, orders and quotes.
CREATE VIEW v_product_cover AS
  SELECT DISTINCT ON (product_id) product_id, id AS image_id, original_url, object_key IS NOT NULL AS uploaded
  FROM product_image ORDER BY product_id, is_primary DESC, position, id;
