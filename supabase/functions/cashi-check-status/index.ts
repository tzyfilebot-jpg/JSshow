import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const URL="https://cashi.id/api/check-status", CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,"content-type":"application/json; charset=utf-8"}});
const env=(n:string)=>{const v=Deno.env.get(n);if(!v)throw new Error(`${n} is not configured`);return v};
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});if(req.method!=="POST")return json({error:"Method not allowed"},405);
try{const body=await req.json().catch(()=>({})),id=String(body.order_id||"").trim();if(!id)return json({error:"order_id required"},400);
 const su=env("SUPABASE_URL"),service=createClient(su,env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}}),h=req.headers.get("Authorization")||"";
 if(!h.startsWith("Bearer "))return json({error:"Login required"},401);
 const auth=createClient(su,env("SUPABASE_ANON_KEY"),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:h}}}),{data:ad,error:ae}=await auth.auth.getUser(),uid=ad.user?.id;
 if(ae||!uid)return json({error:"Invalid session"},401);
 const {data:o,error:oe}=await service.from("jsvidey_payment_orders").select("id,user_id,status,cashi_order_id").eq("id",id).maybeSingle();
 if(oe||!o)return json({error:"Order not found"},404);if(o.user_id!==uid)return json({error:"ORDER_ACCESS_DENIED"},403);
 if(o.status==="approved")return json({success:true,status:"APPROVED",paid:true,membership_activated:true});
 if(o.status==="rejected")return json({success:true,status:"REJECTED",paid:false});
 if(!o.cashi_order_id)return json({error:"CASHI_PAYMENT_NOT_CREATED"},409);
 const resp=await fetch(`${URL}/${encodeURIComponent(o.cashi_order_id)}`,{headers:{"x-api-key":env("CASHI_API_KEY")}}),r=await resp.json().catch(()=>({}));
 if(!resp.ok||r?.success!==true){console.error("Cashi status rejected",r);return json({error:"CASHI_STATUS_CHECK_FAILED",detail:String(r?.message||r?.error||`HTTP ${resp.status}`)},502)}
 const status=String(r.status||"").toUpperCase(),settled=status==="SETTLED";
 const patch:any={cashi_provider_status:status||"PENDING",cashi_provider_payload:r,updated_at:new Date().toISOString()};
 if(settled){patch.status="pending_review";patch.cashi_paid_at=new Date().toISOString()}
 const {error:ue}=await service.from("jsvidey_payment_orders").update(patch).eq("id",o.id);if(ue){console.error(ue);return json({error:"PAYMENT_STATUS_SAVE_FAILED"},500)}
 return json({success:true,status:status||"PENDING",paid:settled,membership_activated:false,message:settled?"Pembayaran terdeteksi lunas oleh Cashi. Menunggu verifikasi admin sebelum membership aktif.":"Cashi belum mengonfirmasi pembayaran lunas."});
}catch(e){console.error(e);return json({error:e instanceof Error?e.message:"Internal server error"},500)}});