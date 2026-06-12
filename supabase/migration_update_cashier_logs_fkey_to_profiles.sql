ALTER TABLE public.cashier_logs DROP CONSTRAINT IF EXISTS fk_cashier_logs_user_id;
ALTER TABLE public.cashier_logs ADD CONSTRAINT fk_cashier_logs_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
