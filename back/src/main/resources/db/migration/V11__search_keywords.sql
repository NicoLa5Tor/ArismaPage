-- What shoppers call things, and who they are for. Both are edited in the admin and read by the search service:
-- a keyword on a category applies to every product in it and in its subcategories; a product can add its own.
-- An age range on a product wins over the ones its categories state.
CREATE TABLE category_keyword (
  category_id uuid NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  keyword text NOT NULL CHECK (char_length(keyword) BETWEEN 2 AND 40),
  PRIMARY KEY (category_id, keyword)
);
CREATE TABLE product_keyword (
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  keyword text NOT NULL CHECK (char_length(keyword) BETWEEN 2 AND 40),
  PRIMARY KEY (product_id, keyword)
);
ALTER TABLE category
  ADD COLUMN age_min smallint, ADD COLUMN age_max smallint,
  ADD CONSTRAINT category_age_range CHECK ((age_min IS NULL AND age_max IS NULL) OR (age_min BETWEEN 0 AND 99 AND age_max BETWEEN age_min AND 99));
ALTER TABLE product
  ADD COLUMN age_min smallint, ADD COLUMN age_max smallint,
  ADD CONSTRAINT product_age_range CHECK ((age_min IS NULL AND age_max IS NULL) OR (age_min BETWEEN 0 AND 99 AND age_max BETWEEN age_min AND 99));
