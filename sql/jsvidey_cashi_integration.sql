-- JSShow dynamic Cashi QR integration. Run in JSShow Supabase SQL editor.
ALTER TABLE public.jsvidey_payment_orders
 ADD COLUMN IF NOT EXISTS cashi_order_id text,
 ADD COLUMN IF NOT EXISTS cashi_qr_url text,
 ADD COLUMN IF NOT EXISTS cashi_checkout_url text,
 ADD COLUMN IF NOT EXISTS cashi_provider_status text,
 ADD COLUMN IF NOT EXISTS cashi_provider_payload jsonb,
 ADD COLUMN IF NOT EXISTS cashi_paid_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS jsvidey_payment_orders_cashi_order_id_uidx
 ON public.jsvidey_payment_orders(cashi_order_id) WHERE cashi_order_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.jsvidey_create_payment_order(p_package text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_package text:=lower(trim(coalesce(p_package,''))); v_amount integer; v_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Silakan login terlebih dahulu'; END IF;
 v_amount:=CASE v_package WHEN 'vip1' THEN 20000 WHEN 'vip3' THEN 35000 WHEN 'vip5' THEN 45000 WHEN 'vip7' THEN 50000 WHEN 'premium' THEN 120000 ELSE NULL END;
 IF v_amount IS NULL THEN RAISE EXCEPTION 'Paket tidak valid'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND lower(coalesce(p.plan,''))='premium') THEN
  RAISE EXCEPTION 'Akun sudah Premium permanen';
 END IF;
 INSERT INTO public.jsvidey_payment_orders(user_id,package,amount_idr,status)
 VALUES(auth.uid(),v_package,v_amount,'awaiting_payment') RETURNING id INTO v_id;
 RETURN jsonb_build_object('id',v_id,'package',v_package,'amount_idr',v_amount,'status','awaiting_payment');
END $$;
REVOKE ALL ON FUNCTION public.jsvidey_create_payment_order(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.jsvidey_create_payment_order(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.jsvidey_admin_payment_orders()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.jsvidey_is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',o.id,'user_id',o.user_id,'email',u.email,'username',p.username,
   'package',o.package,'amount_idr',o.amount_idr,'status',o.status,
   'proof_reference',o.proof_reference,'admin_note',o.admin_note,
   'created_at',o.created_at,'cashi_order_id',o.cashi_order_id,
   'cashi_provider_status',o.cashi_provider_status,'cashi_qr_url',o.cashi_qr_url,
   'cashi_paid_at',o.cashi_paid_at
 ) ORDER BY o.created_at DESC),'[]'::jsonb)
 INTO result
 FROM public.jsvidey_payment_orders o
 LEFT JOIN auth.users u ON u.id=o.user_id
 LEFT JOIN public.profiles p ON p.id=o.user_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.jsvidey_admin_payment_orders() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.jsvidey_admin_payment_orders() TO authenticated;

-- Membership is activated only after an admin approves a settled Cashi payment
-- or a submitted manual proof. Existing active VIP time is extended, not lost.
CREATE OR REPLACE FUNCTION public.jsvidey_admin_review_payment(
 p_order_id uuid,p_approve boolean,p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE o public.jsvidey_payment_orders%rowtype; v_expiry timestamptz; v_base timestamptz;
BEGIN
 IF NOT public.jsvidey_is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT * INTO o FROM public.jsvidey_payment_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
 IF o.status NOT IN ('pending_review','awaiting_payment','rejected') THEN RAISE EXCEPTION 'Pesanan sudah diproses'; END IF;
 IF NOT p_approve THEN
   UPDATE public.jsvidey_payment_orders SET status='rejected',admin_note=left(coalesce(p_note,''),500),updated_at=now() WHERE id=o.id;
   RETURN jsonb_build_object('id',o.id,'status','rejected');
 END IF;
 IF coalesce(o.cashi_provider_status,'') <> 'SETTLED' AND length(trim(coalesce(o.proof_reference,''))) < 3 THEN
   RAISE EXCEPTION 'Pembayaran belum terverifikasi. Pastikan Cashi berstatus SETTLED atau bukti pembayaran sudah dikirim.';
 END IF;
 IF o.package='premium' THEN
   UPDATE public.profiles SET plan='premium',plan_expires_at=NULL WHERE id=o.user_id;
 ELSE
   SELECT CASE WHEN lower(coalesce(plan,''))='vip' AND plan_expires_at>now()
     THEN plan_expires_at ELSE now() END
   INTO v_base FROM public.profiles WHERE id=o.user_id FOR UPDATE;
   v_base:=coalesce(v_base,now());
   v_expiry:=v_base + CASE o.package WHEN 'vip1' THEN interval '1 day' WHEN 'vip3' THEN interval '3 days' WHEN 'vip5' THEN interval '5 days' WHEN 'vip7' THEN interval '7 days' ELSE interval '1 day' END;
   UPDATE public.profiles SET plan='vip',plan_expires_at=v_expiry WHERE id=o.user_id;
 END IF;
 UPDATE public.jsvidey_payment_orders SET status='approved',admin_note=left(coalesce(p_note,''),500),updated_at=now() WHERE id=o.id;
 RETURN jsonb_build_object('id',o.id,'status','approved','package',o.package);
END $$;
REVOKE ALL ON FUNCTION public.jsvidey_admin_review_payment(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.jsvidey_admin_review_payment(uuid,boolean,text) TO authenticated;
