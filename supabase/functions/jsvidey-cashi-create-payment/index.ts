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
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id || "").trim();
    const guestToken = String(body.guest_access_token || "").trim();
    if (!orderId) return json({ error: "order_id is required" }, 400);

    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

    // Service-role client is used only for trusted DB reads/writes.
    const supabase = createClient(
      supabaseUrl,
      serviceKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Authenticate the caller separately. The previous implementation only
    // used the service-role client, so anyone who knew an order UUID could
    // attempt to create a Cashi invoice for another buyer's order.
    let callerUserId: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const authClient = createClient(
        supabaseUrl,
        env("SUPABASE_ANON_KEY"),
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader } },
        },
      );
      const { data: userData } = await authClient.auth.getUser();
      callerUserId = userData.user?.id || null;
    }

    if (!callerUserId && !guestToken) {
      return json({ error: "AUTH_OR_GUEST_TOKEN_REQUIRED" }, 401);
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,order_number,amount,currency,status,payment_reference,provider_order_id,buyer_id,guest_access_token")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return json({ error: "Order not found" }, 404);
    }

    const ownsAsUser = !!callerUserId && order.buyer_id === callerUserId;
    const ownsAsGuest = !callerUserId && !!guestToken && order.guest_access_token === guestToken;
    if (!ownsAsUser && !ownsAsGuest) {
      return json({ error: "ORDER_ACCESS_DENIED" }, 403);
    }

    if (["paid", "completed"].includes(String(order.status))) {
      return json({
        success: true,
        already_paid: true,
        order_id: order.id,
      });
    }

    if (!["pending", "waiting_payment", "processing"].includes(String(order.status))) {
      return json({
        error: `Order cannot be paid in status ${order.status}`,
      }, 409);
    }

    // Reuse an existing pending Cashi payment to avoid duplicate invoices.
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("provider_payment_id,invoice_id,checkout_url,qr_string,status,amount")
      .eq("order_id", order.id)
      .eq("provider", "CASHI")
      .in("status", ["pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPayment?.checkout_url || existingPayment?.qr_string) {
      return json({
        success: true,
        order_id: order.id,
        provider: "CASHI",
        checkout_url: existingPayment.checkout_url || null,
        qr_url: existingPayment.qr_string || null,
        reused: true,
      });
    }

    const cashiOrderId = `SL-${order.id}`;

    const response = await fetch(CASHI_CREATE_URL, {
      method: "POST",
      headers: {
        "x-api-key": env("CASHI_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Number(order.amount),
        order_id: cashiOrderId,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result?.success !== true) {
      const providerMessage =
        result?.message ||
        result?.error ||
        result?.errors ||
        `HTTP ${response.status}`;
      console.error("Cashi create-order rejected", {
        status: response.status,
        providerMessage,
        result,
      });
      return json({
        error: `CASHI_CREATE_ORDER_FAILED: ${String(providerMessage)}`,
        provider_status: response.status,
        provider_response: result,
      }, 502);
    }

    const providerId = String(result.orderId || cashiOrderId);
    const amount = Number(result.amount ?? order.amount);
    const fee = Number(result.fee ?? 0);
    const checkoutUrl = result.checkout_url ? String(result.checkout_url) : null;
    const qrUrl = result.qrUrl ? String(result.qrUrl) : null;

    // The live database uses a PARTIAL unique index on
    // (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL.
    // PostgREST upsert/onConflict cannot reliably infer that partial index.
    // Do an explicit lookup, then UPDATE or INSERT instead.
    if (!Number.isFinite(amount) || amount < 0) {
      return json({ error: "Invalid Cashi amount" }, 502);
    }
    if (!Number.isFinite(fee) || fee < 0) {
      return json({ error: "Invalid Cashi fee" }, 502);
    }
    const netAmount = amount - fee;
    if (netAmount < 0) {
      return json({ error: "Invalid Cashi net amount" }, 502);
    }

    const paymentPayload = {
      order_id: order.id,
      provider: "CASHI",
      payment_method: "CASHI",
      provider_payment_id: providerId,
      invoice_id: providerId,
      amount,
      fee,
      net_amount: netAmount,
      status: "pending",
      checkout_url: checkoutUrl,
      qr_string: qrUrl,
      provider_payload: result,
      updated_at: new Date().toISOString(),
    };

    const { data: existingByProviderId, error: lookupError } = await supabase
      .from("payments")
      .select("id")
      .eq("provider", "CASHI")
      .eq("provider_payment_id", providerId)
      .maybeSingle();

    if (lookupError) {
      console.error("payments lookup failed", lookupError);
      return json({
        error: "Payment record could not be checked",
        db_error: lookupError.message,
        db_details: lookupError.details || null,
        db_hint: lookupError.hint || null,
      }, 500);
    }

    let paymentError = null;

    if (existingByProviderId?.id) {
      const { error } = await supabase
        .from("payments")
        .update(paymentPayload)
        .eq("id", existingByProviderId.id);
      paymentError = error;
    } else {
      const { error } = await supabase
        .from("payments")
        .insert(paymentPayload);
      paymentError = error;

      // Two fast clicks can race between the lookup and INSERT. If the
      // partial unique index catches that race, fetch the row and update it
      // instead of returning a false payment-save failure.
      if (paymentError) {
        const duplicate = /duplicate key|unique constraint/i.test(paymentError.message || "");
        if (duplicate) {
          const { data: racedPayment, error: racedLookupError } = await supabase
            .from("payments")
            .select("id")
            .eq("provider", "CASHI")
            .eq("provider_payment_id", providerId)
            .maybeSingle();

          if (!racedLookupError && racedPayment?.id) {
            const { error: racedUpdateError } = await supabase
              .from("payments")
              .update(paymentPayload)
              .eq("id", racedPayment.id);
            paymentError = racedUpdateError;
          }
        }
      }
    }

    if (paymentError) {
      console.error("payments save failed", paymentError);
      return json({
        error: "Payment record could not be saved",
        db_error: paymentError.message,
        db_details: paymentError.details || null,
        db_hint: paymentError.hint || null,
        provider_payment_id: providerId,
        order_id: order.id,
      }, 500);
    }

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        provider: "CASHI",
        provider_order_id: providerId,
        payment_reference: providerId,
        status: "waiting_payment",
      })
      .eq("id", order.id);

    if (orderUpdateError) {
      console.error("order update failed", orderUpdateError);
      return json({ error: "Order could not be updated" }, 500);
    }

    return json({
      success: true,
      order_id: order.id,
      provider: "CASHI",
      cashi_order_id: providerId,
      amount,
      fee,
      checkout_url: checkoutUrl,
      qr_url: qrUrl,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
