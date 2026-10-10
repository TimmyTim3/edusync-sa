ALTER ROLE service_role SET statement_timeout = '180s';
NOTIFY pgrst, 'reload config';