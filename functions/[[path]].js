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

    // Extensionless aliases for real application pages must never become video slugs.
    const reservedRoutes = {
      "watch": "/watch.html",
      "login": "/login.html",
      "register": "/register.html",
      "dashboard": "/dashboard.html",
      "upload": "/upload.html",
      "settings": "/settings.html",
      "search": "/search.html",
      "categories": "/categories.html",
      "admin": "/admin.html"
    };
    if (reservedRoutes[path]) {
      const target = new URL(reservedRoutes[path], url.origin);
      // Preserve query/hash only as query is available on the incoming request.
      target.search = url.search;
      return Response.redirect(target.toString(), 302);
    }

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
