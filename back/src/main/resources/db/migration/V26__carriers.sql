-- Carriers become store data: the team picks one from the list when shipping, and each has the link the shopper
-- follows. link_template carries {guia} where the carrier's page takes the number in its address; page_url is the plain
-- tracking page when it does not (the shopper then pastes the number shown next to the link). tracking_key is the
-- carrier's code in 17TRACK (null: 17TRACK detects it from the number).
CREATE TABLE carrier (
  code text PRIMARY KEY CHECK (code ~ '^[a-z0-9-]{2,30}$'),
  name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  tracking_key integer,
  link_template text,
  page_url text,
  number_hint text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Deep links were checked on 2026-11-22 from outside the carriers' sites: Coordinadora's is the most likely to open
-- the guide directly; the others only offer their tracking page. The team can change any of them in Tienda → Envíos.
INSERT INTO carrier(code, name, aliases, tracking_key, link_template, page_url, number_hint, position) VALUES
  ('coordinadora', 'Coordinadora', '{coordinadora}', 100493, 'https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia={guia}', 'https://coordinadora.com/rastreo/rastreo-de-guia/', 'Número de 11 dígitos', 1),
  ('servientrega', 'Servientrega', '{servientrega}', NULL, NULL, 'https://www.servientrega.com/wps/portal/rastreo-envio', '', 2),
  ('inter', 'Inter Rapidísimo', '{inter,interrapidisimo,"inter rapidisimo"}', 100491, NULL, 'https://www.interrapidisimo.com/', '', 3),
  ('envia', 'Envía', '{envia,"envia colvanes",colvanes}', 100993, NULL, 'https://envia.co/', '', 4),
  ('tcc', 'TCC', '{tcc}', 101181, NULL, 'https://tcc.com.co/', '', 5),
  ('deprisa', 'Deprisa', '{deprisa}', 100287, NULL, 'https://www.deprisa.com/', '', 6),
  ('472', '4-72', '{472,"4 72","servicios postales nacionales"}', 3131, NULL, 'https://www.4-72.com.co/', '', 7),
  ('domina', 'Domina', '{domina}', NULL, NULL, 'https://www.domina.com.co/', '', 8);

-- Which carrier the shipment went with (its link does not depend on how the name was typed) and whether the team
-- chose to follow that guide automatically (17TRACK) or to give the shopper only the carrier's link.
ALTER TABLE shipment ADD COLUMN carrier_code text REFERENCES carrier(code) ON UPDATE CASCADE;
ALTER TABLE shipment ADD COLUMN follow boolean NOT NULL DEFAULT true;
UPDATE shipment s SET carrier_code = c.code FROM carrier c
  WHERE s.carrier IS NOT NULL AND (lower(trim(s.carrier)) = lower(c.name) OR lower(trim(s.carrier)) = ANY(c.aliases));
