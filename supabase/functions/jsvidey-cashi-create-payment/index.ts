import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const URL="https://cashi.id/api/create-order";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,"content-type":"application/json; charset=utf-8"}});
const env=(n:string)=>{const v=Deno.env.get(n);if(!v)throw new Error(`${n} is not configured`);return v};
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});if(req.method!=="POST")return json({error:"Method not allowed"},405);
try{
 const body=await req.json().catch(()=>({})), id=String(body.order_id||"").trim();if(!id)return json({error:"order_id required"},400);
 const su=env("SUPABASE_URL"), service=createClient(su,env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
 const h=req.headers.get("Authorization")||"";if(!h.startsWith("Bearer "))return json({error:"Login required"},401);
 const auth=createClient(su,env("SUPABASE_ANON_KEY"),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:h}}});
 const {data:ad,error:ae}=await auth.auth.getUser(), uid=ad.user?.id;if(ae||!uid)return json({error:"Invalid session"},401);
 const {data:o,error:oe}=await service.from("jsvidey_payment_orders").select("id,user_id,amount_idr,status,cashi_order_id,cashi_qr_url,cashi_checkout_url,cashi_provider_status").eq("id",id).maybeSingle();
 if(oe||!o)return json({error:"Order not found"},404);if(o.user_id!==uid)return json({error:"ORDER_ACCESS_DENIED"},403);
 if(o.status==="approved")return json({success:true,already_approved:true,order_id:o.id});
 if(o.status==="rejected")return json({error:"Order rejected; contact admin"},409);
 if(o.cashi_order_id&&(o.cashi_qr_url||o.cashi_checkout_url)&&String(o.cashi_provider_status||"").toUpperCase()!=="FAILED")
  return json({success:true,order_id:o.id,cashi_order_id:o.cashi_order_id,amount:o.amount_idr,qr_url:o.cashi_qr_url||null,checkout_url:o.cashi_checkout_url||null,reused:true});
 const cashiId=`JSV-${o.id}`, resp=await fetch(URL,{method:"POST",headers:{"x-api-key":env("CASHI_API_KEY"),"Content-Type":"application/json"},body:JSON.stringify({amount:Number(o.amount_idr),order_id:cashiId,kode_channel:"QRIS_CUSTOM"})});
 const raw=await resp.text();
 let r:any;
 try { r=JSON.parse(raw); } catch { r={raw_response:raw.slice(0,500)}; }
 if(!resp.ok||r?.success!==true){
  console.error("Cashi create rejected",JSON.stringify({http_status:resp.status,success:r?.success,message:r?.message,error:r?.error,response_preview:typeof r?.raw_response==="string"?r.raw_response.slice(0,300):undefined}));
  return json({error:"CASHI_CREATE_PAYMENT_FAILED",detail:String(r?.message||r?.error||`HTTP ${resp.status}`)},502);
 }
 const amount=Number(r.amount??o.amount_idr), qr=r.qrUrl?String(r.qrUrl):null, checkout=r.checkout_url?String(r.checkout_url):null;
 if(!Number.isFinite(amount)||amount!==Number(o.amount_idr))return json({error:"CASHI_AMOUNT_MISMATCH",expected_amount:o.amount_idr,provider_amount:r.amount??null},502);
 if(!qr&&!checkout)return json({error:"CASHI_QR_OR_CHECKOUT_MISSING"},502);
 const validQr=(value:string|null)=>!value||/^https:\/\//i.test(value)||/^data:image\/(?:png|jpeg|jpg);base64,[A-Za-z0-9+/=\r\n]+$/i.test(value);
 if(!validQr(qr)||(checkout&&!/^https:\/\//i.test(checkout)))return json({error:"CASHI_RETURNED_INVALID_URL"},502);
 const {error:se}=await service.from("jsvidey_payment_orders").update({cashi_order_id:String(r.orderId||cashiId),cashi_qr_url:qr,cashi_checkout_url:checkout,cashi_provider_status:"PENDING",cashi_provider_payload:r,updated_at:new Date().toISOString()}).eq("id",o.id).eq("user_id",uid);
 if(se){console.error(se);return json({error:"CASHI_INVOICE_SAVE_FAILED"},500)}
 return json({success:true,order_id:o.id,cashi_order_id:String(r.orderId||cashiId),amount,fee:Number(r.fee||0),qr_url:qr,checkout_url:checkout,status:"PENDING"});
}catch(e){console.error(e);return json({error:e instanceof Error?e.message:"Internal server error"},500)}});
