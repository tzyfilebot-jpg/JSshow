import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const URL="https://cashi.id/api/check-status",json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json; charset=utf-8"}});
const env=(n:string)=>{const v=Deno.env.get(n);if(!v)throw new Error(`${n} is not configured`);return v};
function equal(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
async function hmac(raw:string,secret:string){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const s=await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(raw));return [...new Uint8Array(s)].map(b=>b.toString(16).padStart(2,"0")).join("")}
Deno.serve(async req=>{if(req.method!=="POST")return json({error:"Method not allowed"},405);try{
 const raw=await req.text(),sig=req.headers.get("x-gateway-signature")||"";if(!sig)return json({error:"Missing signature"},401);
 if(!equal((await hmac(raw,env("CASHI_SECRET_KEY"))).toLowerCase(),sig.trim().toLowerCase()))return json({error:"Invalid signature"},401);
 const p=JSON.parse(raw),d=p?.data||{},id=String(d.order_id||p.order_id||"").trim();
 if(String(p.event||"")!=="PAYMENT_SETTLED"||String(d.status||"").toUpperCase()!=="SETTLED")return json({ok:true,ignored:true});
 if(!id)return json({error:"Missing order_id"},400);if(id.startsWith("TEST-"))return json({ok:true,test:true});
 const resp=await fetch(`${URL}/${encodeURIComponent(id)}`,{headers:{"x-api-key":env("CASHI_API_KEY")}}),v=await resp.json().catch(()=>({}));
 if(!resp.ok||v?.success!==true||String(v.status||"").toUpperCase()!=="SETTLED")return json({error:"Cashi payment not verified"},409);
 const db=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:o,error}=await db.from("jsvidey_payment_orders").select("id,status").eq("cashi_order_id",id).maybeSingle();
 if(error)return json({error:"Order lookup failed"},500);if(!o)return json({error:"Order not found"},404);if(o.status==="approved")return json({ok:true,status:"APPROVED"});
 const {error:ue}=await db.from("jsvidey_payment_orders").update({status:"pending_review",cashi_provider_status:"SETTLED",cashi_provider_payload:v,cashi_paid_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",o.id);
 if(ue)return json({error:"Order status update failed"},500);
 return json({ok:true,order_id:o.id,status:"SETTLED",membership_status:"pending_admin_review"});
}catch(e){console.error(e);return json({error:e instanceof Error?e.message:"Webhook error"},500)}});