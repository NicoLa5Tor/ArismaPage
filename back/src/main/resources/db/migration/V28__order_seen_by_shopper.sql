-- When the shopper last looked at their order: a step recorded after it is news for them (a notice in their account).
ALTER TABLE sales_order ADD COLUMN shopper_seen_at timestamptz;
-- orders from before this column are treated as seen up to now, so old history does not show up as news
UPDATE sales_order SET shopper_seen_at = now();
