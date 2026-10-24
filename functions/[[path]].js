// Cloudflare Pages catch-all: keep application routes out of short-link slug handling.
export async function onRequest(context) {
  const { request } = context;
  const next = () => context.next();
  try {
    if (request.method !== "GET" && request.method !== "HEAD") return await next();
    const url = new URL(request.url);
    let rawPath;
    try { rawPath = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, "")); }
    catch (_) { return new Response("Invalid URL path", { status: 400 }); }
    if (!rawPath || rawPath.includes("/") || rawPath.includes(".") || rawPath.length > 80) return await next();
    const path = rawPath.toLowerCase();

    // These legacy pages are intentionally retired.
    if (path === "withdraw" || path === "my-file") {
      return Response.redirect(new URL("/dashboard.html", url.origin).toString(), 302);
    }
    const aliases = {
      "index": "/index.html", "watch": "/watch.html", "download": "/download.html",
      "login": "/login.html", "register": "/register.html", "dashboard": "/dashboard.html",
      "upload": "/upload.html", "settings": "/settings.html", "search": "/search.html",
      "categories": "/categories.html", "admin": "/admin.html", "my-favorites": "/my-favorites.html",
      "my-downloads": "/my-downloads.html", "leaderboard": "/leaderboard.html",
      "top-10-videos": "/top-10-videos.html", "vip": "/vip.html", "payment": "/payment.html"
    };
    if (aliases[path]) {
      const target = new URL(aliases[path], url.origin);
      target.search = url.search;
      return Response.redirect(target.toString(), 302);
    }
    // Unknown one-segment paths remain short video links.
    const target = new URL("/watch.html", url.origin);
    target.searchParams.set("slug", rawPath);
    return Response.redirect(target.toString(), 302);
  } catch (error) {
    console.error("Jsvidey short-link routing error:", error);
    return new Response("Routing error. Check Cloudflare Pages Function logs.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
