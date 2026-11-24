-- Tracking pages checked by hand on 2026-11-23, carrier by carrier, with a guide number:
--   Envía takes the number in the address and opens the guide's status directly (envia.co/rastreo?guia=…).
--   Inter Rapidísimo, TCC and Domina have their own tracking page; the home page was one step away from it.
--   Coordinadora (link with the number), Servientrega, Deprisa and 4-72 (tracking box on the page) stay as they were.
-- A link the store already changed in the panel is left alone: only the values seeded in V26 are replaced.
UPDATE carrier SET link_template = 'https://envia.co/rastreo?guia={guia}'
 WHERE code = 'envia' AND link_template IS NULL AND page_url = 'https://envia.co/';
UPDATE carrier SET page_url = 'https://siguetuenvio.interrapidisimo.com/'
 WHERE code = 'inter' AND page_url = 'https://www.interrapidisimo.com/';
UPDATE carrier SET page_url = 'https://tcc.com.co/rastreo/'
 WHERE code = 'tcc' AND page_url = 'https://tcc.com.co/';
UPDATE carrier SET page_url = 'https://tracking.domina.com.co/'
 WHERE code = 'domina' AND page_url = 'https://www.domina.com.co/';
