import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CASHI_CREATE_URL = "https://cashi.id/api/create-order";
const CASHI_STATUS_URL = "https://cashi.id/api/check-status";
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

function normalizeCashiQr(value: unknown): string | null {
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    value = v.data_url ?? v.dataUrl ?? v.url ?? v.qrUrl ?? v.qr_url ?? v.base64 ?? v.content ?? null;
  }
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate) return null;
  // Cashi may return a hosted image URL instead of an inline QR image.
  if (/^https:\/\//i.test(candidate)) return candidate;

  // Normalize data:image/* URIs. Some responses contain line breaks/spaces in
  // base64 or whitespace around the media type, which strict regexes reject.
  if (/^data:image\//i.test(candidate)) {
    const comma = candidate.indexOf(",");
    if (comma < 0) return null;
    const metadata = candidate.slice(0, comma).replace(/\s+/g, "").toLowerCase();
    let payload = candidate.slice(comma + 1).trim();
    if (/^data:image\/(?:png|jpeg|jpg|webp);base64$/.test(metadata) === false) {
      // Accept percent-encoded image data URIs returned by some gateways.
      if (/^data:image\/(?:svg\+xml|png|jpeg|jpg|webp);charset=utf-8$/.test(metadata) && /%[0-9a-f]{2}/i.test(payload)) return candidate;
      return null;
    }
    payload = payload.replace(/\s+/g, "");
    // Accept URL-safe base64 and normalize it for HTML image rendering.
    payload = payload.replace(/-/g, "+").replace(/_/g, "/");
    if (!payload || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) return null;
    payload = payload.replace(/=+$/, "");
    payload += "=".repeat((4 - payload.length % 4) % 4);
    return `${metadata},${payload}`;
  }

  // Some gateways return raw base64 PNG data without a data-URI prefix.
  const compact = candidate.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (compact.length > 100 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    const payload = compact.replace(/=+$/, "");
    return `data:image/png;base64,${payload}${"=".repeat((4 - payload.length % 4) % 4)}`;
  }
  return null;
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function recoverExistingCashiOrder(orderId: string, amount: number) {
  try {
    const response = await fetch(`${CASHI_STATUS_URL}/${encodeURIComponent(orderId)}`, {
      headers: { "x-api-key": env("CASHI_API_KEY") },
    });
    const raw = await response.text();
    let result: any;
    try { result = JSON.parse(raw); } catch { result = { raw_response: raw.slice(0, 500) }; }
    if (!response.ok || result?.success !== true) {
      console.error("Cashi existing-order recovery failed", { status: response.status, response: result });
      return null;
    }
    const payload = result?.data && typeof result.data === "object" ? result.data : result;
    const nestedPayment = payload.payment && typeof payload.payment === "object" ? payload.payment : {};
    const qr = payload.qrUrl ?? payload.qr_url ?? payload.qr_url_base64 ?? payload.qr_image_url ?? payload.qr_code_url ?? payload.qr_data_url ?? payload.qr ?? nestedPayment.qrUrl ?? nestedPayment.qr_url ?? nestedPayment.qr_code_url ?? result?.qrUrl ?? result?.qr_url ?? result?.qr_code_url ?? null;
    const checkout = payload.checkout_url ?? payload.checkoutUrl ?? payload.payment_url ?? payload.paymentUrl ?? nestedPayment.checkout_url ?? nestedPayment.checkoutUrl ?? result?.checkout_url ?? result?.checkoutUrl ?? null;
    const qrUrl = normalizeCashiQr(qr);
    const checkoutCandidate = checkout ? String(checkout).trim() : null;
    let checkoutUrl = checkoutCandidate && /^https:\/\//i.test(checkoutCandidate) ? checkoutCandidate : null;
    if (!qrUrl && !checkoutUrl) return null;
    return {
      qr_url: qrUrl,
      checkout_url: checkoutUrl,
      provider_status: String(payload.status || "PENDING").toUpperCase(),
      payload: { ...payload, recovery_amount: amount },
    };
  } catch (error) {
    console.error("Cashi existing-order recovery exception", error);
    return null;
  }
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

    // Recover an existing provider transaction instead of creating another one.
    if (order.cashi_order_id) {
      const recovered = await recoverExistingCashiOrder(order.cashi_order_id, Number(order.amount_idr));
      if (recovered) {
        const { error: saveRecoveredError } = await service.from("jsvidey_payment_orders").update({
          cashi_qr_url: recovered.qr_url,
          cashi_checkout_url: recovered.checkout_url,
          cashi_provider_status: recovered.provider_status,
          cashi_provider_payload: recovered.payload,
          updated_at: new Date().toISOString(),
        }).eq("id", order.id).eq("user_id", userId);
        if (saveRecoveredError) {
          console.error("Cashi recovery save failed", saveRecoveredError);
          return json({ error: "PAYMENT_ORDER_SAVE_FAILED", detail: saveRecoveredError.message }, 500);
        }
        return json({ success: true, order_id: order.id, cashi_order_id: order.cashi_order_id,
          amount: Number(order.amount_idr), qr_url: recovered.qr_url, checkout_url: recovered.checkout_url,
          recovery_required: !recovered.qr_url && !recovered.checkout_url, reused: true });
      }
      return json({ error: "CASHI_ORDER_EXISTS_NO_CHECKOUT",
        detail: "Cashi sudah mengenali transaksi ini, tetapi tidak mengembalikan QR atau tautan checkout. Jangan buat transaksi ulang; minta Cashi memulihkan checkout untuk Ref transaksi yang sama.",
        provider_order_id: order.cashi_order_id }, 409);
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
      // Recover the existing Cashi order after a duplicate-ID response.
      if (response.status === 409 && (result?.code === "DUPLICATE_ORDER_ID" || /duplicate order_id/i.test(String(providerMessage)))) {
        const recovered = await recoverExistingCashiOrder(cashiOrderId, amount);
        if (recovered) {
          const { error: recoverySaveError } = await service.from("jsvidey_payment_orders").update({
            cashi_order_id: cashiOrderId,
            cashi_qr_url: recovered.qr_url,
            cashi_checkout_url: recovered.checkout_url,
            cashi_provider_status: recovered.provider_status,
            cashi_provider_payload: recovered.payload,
            updated_at: new Date().toISOString(),
          }).eq("id", order.id).eq("user_id", userId);
          if (recoverySaveError) {
            console.error("Cashi duplicate recovery save failed", recoverySaveError);
            return json({ error: "PAYMENT_ORDER_SAVE_FAILED", detail: recoverySaveError.message }, 500);
          }
          return json({ success: true, order_id: order.id, cashi_order_id: cashiOrderId,
            amount, qr_url: recovered.qr_url, checkout_url: recovered.checkout_url,
            recovery_required: !recovered.qr_url && !recovered.checkout_url, reused: true });
        }
        // Save the provider ID so future clicks cannot create a duplicate.
        const { error: idSaveError } = await service.from("jsvidey_payment_orders").update({
          cashi_order_id: cashiOrderId,
          cashi_provider_status: "PENDING",
          cashi_provider_payload: result,
          updated_at: new Date().toISOString(),
        }).eq("id", order.id).eq("user_id", userId);
        if (idSaveError) {
          console.error("Cashi duplicate ID save failed", idSaveError);
          return json({ error: "PAYMENT_ORDER_SAVE_FAILED", detail: idSaveError.message }, 500);
        }
        return json({ error: "CASHI_ORDER_EXISTS_NO_CHECKOUT",
          detail: "Cashi sudah mencatat transaksi ini tetapi QR/checkout tidak bisa dipulihkan otomatis. Jangan membuat transaksi baru. Hubungi dukungan Cashi dengan Ref transaksi yang sama.",
          provider_order_id: cashiOrderId }, 409);
      }
      console.error("Cashi create-order rejected", { status: response.status, providerMessage, response: result });
      return json({ error: "CASHI_CREATE_PAYMENT_FAILED", detail: String(providerMessage), provider_status: response.status }, 502);
    }

    // Cashi normally returns these fields at the top level; tolerate a nested data object too.
    const providerData = result?.data && typeof result.data === "object" ? result.data : result;
    const providerOrderId = String(providerData.orderId || providerData.order_id || result.orderId || result.order_id || cashiOrderId);
    const finalAmount = Number(providerData.amount ?? result.amount ?? amount);
    const nestedPayment = providerData.payment && typeof providerData.payment === "object" ? providerData.payment : {};
    const qrValue = providerData.qrUrl ?? providerData.qr_url ?? providerData.qr_url_base64 ?? providerData.qr_image_url ?? providerData.qr_code_url ?? providerData.qr_data_url ?? providerData.qr ?? nestedPayment.qrUrl ?? nestedPayment.qr_url ?? nestedPayment.qr_code_url ?? result.qrUrl ?? result.qr_url ?? result.qr_code_url ?? null;
    const checkoutValue = providerData.checkout_url ?? providerData.checkoutUrl ?? providerData.payment_url ?? providerData.paymentUrl ?? nestedPayment.checkout_url ?? nestedPayment.checkoutUrl ?? result.checkout_url ?? result.checkoutUrl ?? null;
    let qrUrl = normalizeCashiQr(qrValue);
    const checkoutCandidate = checkoutValue ? String(checkoutValue).trim() : null;
    let checkoutUrl = checkoutCandidate && /^https:\/\//i.test(checkoutCandidate) ? checkoutCandidate : null;

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return json({ error: "CASHI_RETURNED_INVALID_AMOUNT" }, 502);
    }
    if (finalAmount !== amount) {
      console.error("Cashi amount mismatch", { orderId: order.id, expected: amount, received: finalAmount });
      return json({ error: "CASHI_AMOUNT_MISMATCH", detail: "Nominal yang dikembalikan Cashi tidak sama dengan nominal paket. Jangan membayar QR ini; hubungi admin." }, 502);
    }
    // If the create response's QR field is malformed, query the same provider order
    // once. Never create a second order to work around a missing QR.
    if (!qrUrl && !checkoutUrl) {
      const recovered = await recoverExistingCashiOrder(providerOrderId, finalAmount);
      if (recovered) {
        qrUrl = recovered.qr_url;
        checkoutUrl = recovered.checkout_url;
      }
    }

    // A usable checkout URL is enough if the QR field is malformed.
    if (!qrUrl && !checkoutUrl) {
      // Remember the provider order ID and payload so retry can recover this same order.
      const { error: persistError } = await service.from("jsvidey_payment_orders").update({
        cashi_order_id: providerOrderId,
        cashi_provider_status: String(providerData.status || result.status || "PENDING").toUpperCase(),
        cashi_provider_payload: result,
        updated_at: new Date().toISOString(),
      }).eq("id", order.id).eq("user_id", userId);
      if (persistError) console.error("Cashi invalid QR payload could not be persisted", persistError);
      const qrWasReturned = qrValue !== null && qrValue !== undefined && String(qrValue).trim() !== "";
      console.error("Cashi create-order returned no renderable QR/checkout", {
        providerFields: Object.keys(providerData || {}),
        qrField: qrValue == null ? null : (typeof qrValue === "string" ? qrValue.slice(0, 40).replace(/[^a-zA-Z0-9:;/+._-]/g, "?") : typeof qrValue),
        qrLength: typeof qrValue === "string" ? qrValue.length : null,
        checkoutPresent: Boolean(checkoutValue),
        providerOrderId,
      });
      return json({
        success: true,
        order_id: order.id,
        cashi_order_id: providerOrderId,
        amount: finalAmount,
        provider: providerData.provider || result.provider || "CASHI",
        qr_url: null,
        checkout_url: null,
        recovery_required: true,
        provider_error: qrWasReturned ? "CASHI_RETURNED_INVALID_QR" : "CASHI_RETURNED_NO_QR_OR_CHECKOUT",
        provider_fields: Object.keys(providerData || {}),
        message: "Order tersimpan, tetapi Cashi belum memberikan QR atau checkout yang bisa ditampilkan. Status akan diperiksa otomatis; jangan membuat order kedua.",
      }, 200);
    }

    const { error: updateError } = await service
      .from("jsvidey_payment_orders")
      .update({
        cashi_order_id: providerOrderId,
        cashi_qr_url: qrUrl,
        cashi_checkout_url: checkoutUrl,
        cashi_provider_status: String(providerData.status || result.status || "PENDING").toUpperCase(),
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
      fee: Number(providerData.fee ?? result.fee ?? 0),
      provider: providerData.provider || result.provider || "CASHI",
      qr_url: qrUrl,
      checkout_url: checkoutUrl,
      expires_at: providerData.expires_at ?? result.expires_at ?? null,
      recovery_required: !qrUrl && !checkoutUrl,
    });
  } catch (error) {
    console.error("jsvidey-cashi-create-payment failed", error);
    return json({
      error: "INTERNAL_SERVER_ERROR",
      detail: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
