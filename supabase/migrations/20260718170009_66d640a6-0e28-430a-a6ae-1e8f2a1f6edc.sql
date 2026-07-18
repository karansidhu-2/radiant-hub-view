
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON public.bookings (scheduled_date, scheduled_hour);
CREATE INDEX IF NOT EXISTS idx_bookings_status_scheduled ON public.bookings (status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON public.bookings (reference);
CREATE INDEX IF NOT EXISTS idx_orders_reference ON public.orders (reference);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_product_slug ON public.order_items (product_slug);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_published ON public.reviews (published) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON public.reviews (booking_id);
CREATE INDEX IF NOT EXISTS idx_capacity_conflicts_resolved ON public.capacity_conflicts (resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_capacity_conflicts_scheduled ON public.capacity_conflicts (scheduled_date, scheduled_hour);
CREATE INDEX IF NOT EXISTS idx_products_published ON public.products (published) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_services_published ON public.services (published) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON public.admin_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
