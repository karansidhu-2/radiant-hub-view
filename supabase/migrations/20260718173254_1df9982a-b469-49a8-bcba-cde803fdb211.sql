GRANT SELECT ON public.technicians TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.technicians TO authenticated;
GRANT ALL ON public.technicians TO service_role;