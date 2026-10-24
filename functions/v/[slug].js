// Cloudflare Pages route: /v/<slug> -> /watch?slug=<slug>.
// Use the clean URL so Cloudflare Pages can resolve watch.html without redirect loops.
export async function onRequest(context) {
  const { request, params } = context;
  const next = () => context.next();

  try {
    if (request.method !== "GET" && request.method !== "HEAD") return await next();

    const slug = String(params?.slug ?? "").trim();
    if (!slug || slug.length > 80 || slug.includes("/") || slug.includes(".")) {
      return await next();
    }

    const target = new URL("/watch", request.url);
    target.searchParams.set("slug", slug);
    return Response.redirect(target.toString(), 302);
  } catch (error) {
    console.error("Jsvidey /v route error:", error);
    return new Response("Video routing error. Check Cloudflare Pages Function logs.", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
}
