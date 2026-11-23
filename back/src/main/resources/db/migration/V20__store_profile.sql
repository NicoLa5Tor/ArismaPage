-- The store's own data (name, address, contact, legal pages) moves out of the code into store_setting 'store', and the
-- delivery rate for Bogotá becomes the rate of the store's local area.

-- Saved shipping rules: bogotaRate -> localRate, freeFromBogota -> freeFromLocal.
UPDATE store_setting
   SET value = (value - 'bogotaRate' - 'freeFromBogota')
               || jsonb_build_object('localRate', value -> 'bogotaRate', 'freeFromLocal', value -> 'freeFromBogota')
 WHERE key = 'shipping' AND value ? 'bogotaRate';

-- The Arisma database (the one with the orders imported from WooCommerce) keeps what the code used to say. A new
-- store starts empty and fills its profile in the panel.
INSERT INTO store_setting(key, value)
SELECT 'store', jsonb_build_object(
  'name', 'Arisma Didácticos', 'shortName', 'Arisma', 'legalName', 'ARISMA S.A.', 'taxId', '860.049.903-8',
  'address', 'Calle 53 No. 15-24', 'addressDetail', 'locales 103 al 105', 'localCity', 'Bogotá', 'localState', 'CO-DC',
  'whatsapp', '573108669112', 'phone', '601 210 2138', 'email', '',
  'hours', jsonb_build_array('Lunes a viernes de 9:00 a. m. a 5:30 p. m.', 'Sábados de 9:30 a. m. a 5:30 p. m.'),
  'site', 'https://arisma.com.co', 'termsUrl', 'https://arisma.com.co/terminos-y-condiciones-de-uso/',
  'privacyUrl', 'https://arisma.com.co/politica-de-tratamiento-de-datos/', 'color', '#d40e40')
WHERE EXISTS (SELECT 1 FROM sales_order WHERE source_key IS NOT NULL)
ON CONFLICT (key) DO NOTHING;

-- Its delivery rules, if they were never saved (the code used to default to them).
INSERT INTO store_setting(key, value)
SELECT 'shipping', jsonb_build_object('localRate', 11046, 'nationalRate', 11046, 'freeFromLocal', 150000, 'pickup', true, 'minimumOrder', 50000)
WHERE EXISTS (SELECT 1 FROM sales_order WHERE source_key IS NOT NULL)
ON CONFLICT (key) DO NOTHING;
