CREATE TABLE IF NOT EXISTS registry_quarantine(key text PRIMARY KEY,data jsonb NOT NULL,reason text NOT NULL,collected_at timestamptz NOT NULL DEFAULT now());
