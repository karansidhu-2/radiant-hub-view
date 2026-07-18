
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;

-- Storage policies for the product-images bucket (bucket created via storage tool)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='product-images public read') THEN
    CREATE POLICY "product-images public read" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'product-images');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='product-images admin insert') THEN
    CREATE POLICY "product-images admin insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='product-images admin update') THEN
    CREATE POLICY "product-images admin update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'))
      WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='product-images admin delete') THEN
    CREATE POLICY "product-images admin delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
