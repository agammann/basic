CREATE INDEX IF NOT EXISTS verification_latest_deployment ON verification_runs(profile_id,deployment_id,started_at DESC,id DESC);
