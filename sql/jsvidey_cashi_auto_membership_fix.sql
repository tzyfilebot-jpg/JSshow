-- JSshow Cashi checkout + automatic membership activation.
-- Run this migration in the Supabase SQL editor before deploying the updated Edge Functions.

ALTER TABLE public.jsvidey_payment_orders
  ADD COLUMN IF NOT EXISTS cashi_order_id text,
  ADD COLUMN IF NOT EXISTS cashi_qr_url text,
  ADD COLUMN IF NOT EXISTS cashi_checkout_url text,
  ADD COLUMN IF NOT EXISTS cashi_provider_status text,
  ADD COLUMN IF NOT EXISTS cashi_provider_payload jsonb,
  ADD COLUMN IF NOT EXISTS cashi_paid_at timestamptz;

-- Replace the older package CHECK constraint so both Premium choices are stored distinctly.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid='public.jsvidey_payment_orders'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%package%'
  LOOP
    EXECUTE format('ALTER TABLE public.jsvidey_payment_orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.jsvidey_payment_orders
  ADD CONSTRAINT jsvidey_payment_orders_package_check
  CHECK (package IN ('vip1','vip3','vip5','vip7','premium','premium_monthly','premium_permanent'));
CREATE UNIQUE INDEX IF NOT EXISTS jsvidey_payment_orders_cashi_order_id_uidx
  ON public.jsvidey_payment_orders(cashi_order_id) WHERE cashi_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.jsvidey_create_payment_order(p_package text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_package text:=lower(trim(coalesce(p_package,''))); v_amount integer; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Silakan login terlebih dahulu'; END IF;
  v_amount:=CASE v_package
    WHEN 'vip1' THEN 20000 WHEN 'vip3' THEN 35000 WHEN 'vip5' THEN 45000 WHEN 'vip7' THEN 50000
    WHEN 'premium_monthly' THEN 100000 WHEN 'premium_permanent' THEN 250000
    WHEN 'premium' THEN 250000 ELSE NULL END;
  IF v_amount IS NULL THEN RAISE EXCEPTION 'Paket tidak valid'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
    AND lower(coalesce(p.plan,'')) IN ('premium','pro') AND p.plan_expires_at IS NULL) THEN
    RAISE EXCEPTION 'Akun sudah memiliki Premium permanen';
  END IF;
  INSERT INTO public.jsvidey_payment_orders(user_id,package,amount_idr,status)
  VALUES(auth.uid(),v_package,v_amount,'awaiting_payment') RETURNING id INTO v_id;
  RETURN jsonb_build_object('id',v_id,'package',v_package,'amount_idr',v_amount,'status','awaiting_payment');
END $$;
REVOKE ALL ON FUNCTION public.jsvidey_create_payment_order(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.jsvidey_create_payment_order(text) TO authenticated;

-- Only the service-role Cashi status function can call this RPC. It atomically updates
-- the membership and marks the order approved after Cashi reports a verified settled status.
CREATE OR REPLACE FUNCTION public.jsvidey_activate_paid_membership(
  p_order_id uuid, p_cashi_status text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE o public.jsvidey_payment_orders%rowtype; v_base timestamptz; v_expiry timestamptz; v_package text;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF upper(coalesce(p_cashi_status,'')) NOT IN ('SETTLED','PAID','SUCCESS','COMPLETED') THEN
    RAISE EXCEPTION 'Cashi payment is not settled';
  END IF;
  SELECT * INTO o FROM public.jsvidey_payment_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  IF o.status='approved' THEN
    RETURN jsonb_build_object('id',o.id,'status','approved','already_active',true,'package',o.package);
  END IF;
  IF upper(coalesce(o.cashi_provider_status,'')) NOT IN ('SETTLED','PAID','SUCCESS','COMPLETED') THEN
    RAISE EXCEPTION 'Status lunas Cashi belum tersimpan';
  END IF;
  IF o.status IN ('rejected','cancelled') THEN RAISE EXCEPTION 'Pesanan tidak dapat diaktifkan'; END IF;

  v_package:=o.package;
  IF v_package IN ('premium_monthly') THEN
    UPDATE public.profiles SET plan='premium',plan_expires_at=now()+interval '1 month' WHERE id=o.user_id;
  ELSIF v_package IN ('premium_permanent','premium') THEN
    UPDATE public.profiles SET plan='premium',plan_expires_at=NULL WHERE id=o.user_id;
  ELSE
    SELECT CASE WHEN lower(coalesce(plan,''))='vip' AND plan_expires_at>now()
      THEN plan_expires_at ELSE now() END
      INTO v_base FROM public.profiles WHERE id=o.user_id FOR UPDATE;
    v_base:=coalesce(v_base,now());
    v_expiry:=v_base + CASE v_package WHEN 'vip1' THEN interval '1 day' WHEN 'vip3' THEN interval '3 days'
      WHEN 'vip5' THEN interval '5 days' WHEN 'vip7' THEN interval '7 days' ELSE interval '1 day' END;
    UPDATE public.profiles SET plan='vip',plan_expires_at=v_expiry WHERE id=o.user_id;
  END IF;
  UPDATE public.jsvidey_payment_orders SET status='approved',updated_at=now() WHERE id=o.id;
  RETURN jsonb_build_object('id',o.id,'status','approved','package',v_package,'plan_expires_at',
    (SELECT plan_expires_at FROM public.profiles WHERE id=o.user_id));
END $$;
REVOKE ALL ON FUNCTION public.jsvidey_activate_paid_membership(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jsvidey_activate_paid_membership(uuid,text) TO service_role;
