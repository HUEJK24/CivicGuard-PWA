-- CivicGuard — esquema de PostgreSQL (Neon)
-- Aplicar con: npm run db:apply  (o pegar en el SQL Editor de Neon)

CREATE TABLE IF NOT EXISTS incidents (
  id               BIGSERIAL PRIMARY KEY,
  -- Idempotencia: el cliente genera este UUID y reintentar no duplica
  client_report_id UUID        NOT NULL UNIQUE,
  device_id        UUID        NOT NULL,
  title            TEXT        NOT NULL,
  description      TEXT,
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  photo_url        TEXT,
  status           TEXT        NOT NULL DEFAULT 'synced'
                   CHECK (status IN ('pending', 'synced', 'resolved')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS incidents_status_idx     ON incidents (status);
CREATE INDEX IF NOT EXISTS incidents_device_id_idx  ON incidents (device_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         BIGSERIAL PRIMARY KEY,
  device_id  UUID        NOT NULL,
  endpoint   TEXT        NOT NULL UNIQUE,
  keys       JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_device_id_idx ON push_subscriptions (device_id);
