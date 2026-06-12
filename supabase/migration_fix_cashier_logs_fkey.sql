ALTER TABLE public.cashier_logs DROP CONSTRAINT IF EXISTS cashier_logs_user_id_fkey;
ALTER TABLE public.cashier_logs ADD CONSTRAINT fk_cashier_logs_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
