// Cloudflare Pages catch-all: reserve application routes before handling short links.
// This prevents /watch from being mistaken for a video slug (slug=watch).
export async function onRequest(context) {
  const { request } = context;
  const next = () => context.next();
  try {
    if (request.method !== "GET" && request.method !== "HEAD") return await next();

    const url = new URL(request.url);
    let path;
    try {
      path = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, "")).toLowerCase();
    } catch (_) {
      return new Response("Invalid URL path", { status: 400 });
    }

    // Root, nested paths, and file/assets must be served normally.
    if (!path || path.includes("/") || path.includes(".") || path.length > 80) {
      return await next();
    }

    // Never redirect reserved application paths. In particular, /watch must not
    // become /watch.html?slug=watch, and /login must not enter a redirect chain.
    const reservedRoutes = new Set([
      "watch", "login", "register", "dashboard", "upload",
      "settings", "search", "categories", "admin", "my-downloads"
    ]);
    if (path === "withdraw" || path === "my-file") {
      return Response.redirect(new URL("/dashboard.html", url.origin).toString(), 302);
    }
    if (reservedRoutes.has(path)) return await next();

    // Only non-reserved, one-segment extensionless paths are short video IDs.
    const target = new URL("/watch.html", url.origin);
    target.searchParams.set("slug", path);
    return Response.redirect(target.toString(), 302);
  } catch (error) {
    console.error("Jsvidey short-link routing error:", error);
    return new Response("Routing error. Check Cloudflare Pages Function logs.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
