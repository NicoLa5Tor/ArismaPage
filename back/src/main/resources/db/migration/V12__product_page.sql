-- What the public product page says and which of its sections it shows. Edited in the panel (tab "Página").
-- page_sections only keeps the choices that differ from the store default: {"reviews":"hide","sku":"show"}.
ALTER TABLE product
  ADD COLUMN short_description text NOT NULL DEFAULT '' CHECK (char_length(short_description) <= 300),
  ADD COLUMN highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN page_sections jsonb NOT NULL DEFAULT '{}'::jsonb;

-- The WooCommerce short description becomes the plain-text one: tags out, common entities decoded, spaces collapsed.
UPDATE product SET short_description = left(btrim(regexp_replace(regexp_replace(
    replace(replace(replace(source_metadata->>'short_description_html', '&nbsp;', ' '), '&amp;', '&'), '&#8211;', '-'),
    '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g')), 300)
  WHERE COALESCE(source_metadata->>'short_description_html', '') <> '';
