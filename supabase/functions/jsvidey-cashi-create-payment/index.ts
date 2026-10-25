import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CASHI_CREATE_URL = "https://cashi.id/api/create-order";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const orderId = String(body?.order_id ?? "").trim();
    if (!orderId) return json({ error: "order_id is required" }, 400);

    const supabaseUrl = env("SUPABASE_URL");
    const service = createClient(
      supabaseUrl,
      env("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Validate the signed-in buyer; never let one user create invoices for another user's order.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Login required" }, 401);
    }
    const authClient = createClient(
      supabaseUrl,
      env("SUPABASE_ANON_KEY"),
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      },
    );
    const { data: authData, error: authError } = await authClient.auth.getUser();
    const userId = authData.user?.id;
    if (authError || !userId) return json({ error: "Invalid session" }, 401);

    // JSshow uses jsvidey_payment_orders (not Showlink's orders/payments tables).
    const { data: order, error: orderError } = await service
      .from("jsvidey_payment_orders")
      .select("id,user_id,package,amount_idr,status,cashi_order_id,cashi_qr_url,cashi_checkout_url,cashi_provider_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error("JSshow order lookup failed", orderError);
      return json({ error: "ORDER_LOOKUP_FAILED", detail: orderError.message }, 500);
    }
    if (!order) return json({ error: "Order not found" }, 404);
    if (order.user_id !== userId) return json({ error: "ORDER_ACCESS_DENIED" }, 403);

    if (order.status === "approved") {
      return json({ success: true, already_paid: true, order_id: order.id, status: "APPROVED" });
    }
    if (["rejected", "cancelled"].includes(String(order.status))) {
      return json({ error: `Order cannot be paid in status ${order.status}` }, 409);
    }

    if (order.cashi_order_id && (order.cashi_qr_url || order.cashi_checkout_url)) {
      return json({
        success: true,
        order_id: order.id,
        cashi_order_id: order.cashi_order_id,
        amount: Number(order.amount_idr),
        qr_url: order.cashi_qr_url || null,
        checkout_url: order.cashi_checkout_url || null,
        reused: true,
      });
    }

    const amount = Number(order.amount_idr);
    if (!Number.isInteger(amount) || amount <= 0) {
      return json({ error: "INVALID_ORDER_AMOUNT" }, 400);
    }

    const cashiOrderId = `JSV-${order.id}`;
    const response = await fetch(CASHI_CREATE_URL, {
      method: "POST",
      headers: {
        "x-api-key": env("CASHI_API_KEY"),
        "Content-Type": "application/json",
      },
      // Match the working Showlink Cashi request format.
      body: JSON.stringify({ amount, order_id: cashiOrderId }),
    });

    const raw = await response.text();
    let result: any;
    try { result = JSON.parse(raw); }
    catch { result = { raw_response: raw.slice(0, 500) }; }

    if (!response.ok || result?.success !== true) {
      const providerMessage = result?.message || result?.error || `HTTP ${response.status}`;
      console.error("Cashi create-order rejected", {
        status: response.status,
        providerMessage,
        response: result,
      });
      return json({
        error: "CASHI_CREATE_PAYMENT_FAILED",
        detail: String(providerMessage),
        provider_status: response.status,
      }, 502);
    }

    const providerOrderId = String(result.orderId || cashiOrderId);
    const finalAmount = Number(result.amount ?? amount);
    const qrUrl = result.qrUrl ? String(result.qrUrl) : null;
    const checkoutUrl = result.checkout_url ? String(result.checkout_url) : null;

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return json({ error: "CASHI_RETURNED_INVALID_AMOUNT" }, 502);
    }
    if (checkoutUrl && !/^https:\/\//i.test(checkoutUrl)) {
      return json({ error: "CASHI_RETURNED_INVALID_CHECKOUT_URL" }, 502);
    }
    if (qrUrl && !(/^https:\/\//i.test(qrUrl) || /^data:image\/(?:png|jpeg|jpg);base64,/i.test(qrUrl))) {
      return json({ error: "CASHI_RETURNED_INVALID_QR" }, 502);
    }

    const { error: updateError } = await service
      .from("jsvidey_payment_orders")
      .update({
        cashi_order_id: providerOrderId,
        cashi_qr_url: qrUrl,
        cashi_checkout_url: checkoutUrl,
        cashi_provider_status: String(result.status || "PENDING").toUpperCase(),
        cashi_provider_payload: result,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("user_id", userId);

    if (updateError) {
      console.error("JSshow payment order update failed", updateError);
      return json({ error: "PAYMENT_ORDER_SAVE_FAILED", detail: updateError.message }, 500);
    }

    return json({
      success: true,
      order_id: order.id,
      cashi_order_id: providerOrderId,
      amount: finalAmount,
      fee: Number(result.fee ?? 0),
      provider: result.provider || "CASHI",
      qr_url: qrUrl,
      checkout_url: checkoutUrl,
      expires_at: result.expires_at ?? null,
    });
  } catch (error) {
    console.error("jsvidey-cashi-create-payment failed", error);
    return json({
      error: "INTERNAL_SERVER_ERROR",
      detail: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
