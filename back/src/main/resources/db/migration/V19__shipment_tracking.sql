-- Automatic tracking of carrier shipments through a tracking provider (17TRACK).
-- One row per shipment whose number is followed; the number is kept so a corrected guide starts again.
CREATE TABLE shipment_tracking (
  shipment_id uuid PRIMARY KEY REFERENCES shipment(id) ON DELETE CASCADE,
  number text NOT NULL, carrier_key integer,
  state text NOT NULL CHECK (state IN ('following','rejected','finished')),
  stage text CHECK (stage IN ('waiting','received','in_transit','pickup_ready','out_for_delivery','attempt_failed','delivered','exception','expired')),
  error text, registered_at timestamptz NOT NULL DEFAULT now(), checked_at timestamptz, changed_at timestamptz);
CREATE INDEX shipment_tracking_due ON shipment_tracking(state, checked_at);

-- Every number that started being followed, kept even if the shipment changes later: it is what the monthly plan counts.
CREATE TABLE tracking_registration (
  id uuid PRIMARY KEY, shipment_id uuid REFERENCES shipment(id) ON DELETE SET NULL, number text NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX tracking_registration_month ON tracking_registration(registered_at);

-- Movements the carrier published, as it wrote them.
CREATE TABLE shipment_tracking_event (
  id uuid PRIMARY KEY, shipment_id uuid NOT NULL REFERENCES shipment(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL, description text NOT NULL, location text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, occurred_at, description));
CREATE INDEX shipment_tracking_event_shipment ON shipment_tracking_event(shipment_id, occurred_at DESC);
