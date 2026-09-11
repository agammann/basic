DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='basic_reader') THEN
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO basic_reader;
   GRANT INSERT, UPDATE, DELETE ON rate_buckets TO basic_reader;
 END IF;
END $$;
