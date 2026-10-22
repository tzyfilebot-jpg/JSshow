// Cloudflare Pages catch-all: handle short links without touching real files/assets.
// Keep this function deliberately simple: no unsupported asset binding and no recursive fetch.
export async function onRequest(context) {
  const { request } = context;
  const next = () => context.next();
  try {
    if (request.method !== "GET" && request.method !== "HEAD") return await next();

    const url = new URL(request.url);
    let path;
    try {
      path = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ""));
    } catch (_) {
      return new Response("Invalid URL path", { status: 400 });
    }

    // Root, nested paths, files, and assets must be served normally.
    if (!path || path.includes("/") || path.includes(".") || path.length > 80) {
      return await next();
    }

    // Explicit static pages are excluded from this Function by _routes.json.
    // Keep this handler only for extensionless short-video slugs.

    // One-segment extensionless paths are short video IDs.
    const target = new URL("/watch.html", url.origin);
    target.searchParams.set("slug", path);
    return Response.redirect(target.toString(), 302);
  } catch (error) {
    // Log the real cause to Cloudflare Workers/Pages logs and return a useful
    // response instead of surfacing a generic Worker exception page.
    console.error("Jsvidey short-link routing error:", error);
    return new Response("Routing error. Check Cloudflare Pages Function logs.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
