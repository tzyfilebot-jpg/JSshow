// Cloudflare Pages catch-all: let Pages resolve clean URLs to their .html files.
// Redirecting /login -> /login.html can loop because Pages canonicalizes .html
// back to /login. Known page aliases must pass through to the static asset resolver.
export async function onRequest(context) {
  const { request } = context;
  const next = () => context.next();

  try {
    if (request.method !== "GET" && request.method !== "HEAD") return await next();

    const url = new URL(request.url);
    let rawPath;
    try {
      rawPath = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ""));
    } catch (_) {
      return new Response("Invalid URL path", { status: 400 });
    }

    // Root, multi-segment paths, file paths and long values are not short-link slugs.
    if (!rawPath || rawPath.includes("/") || rawPath.includes(".") || rawPath.length > 80) {
      return await next();
    }

    const path = rawPath.toLowerCase();

    // Retired pages go to the clean dashboard URL, never to a .html URL.
    if (path === "withdraw" || path === "my-file") {
      return Response.redirect(new URL("/dashboard", url.origin).toString(), 302);
    }

    // These routes correspond to static .html files. Pass through so Cloudflare Pages
    // resolves them; do not redirect to .html because that can create redirect loops.
    const pageAliases = new Set([
      "index", "watch", "download", "login", "register", "dashboard", "upload",
      "settings", "search", "categories", "admin", "my-favorites", "my-downloads",
      "leaderboard", "top-10-videos", "vip", "payment"
    ]);
    if (pageAliases.has(path)) return await next();

    // Unknown one-segment paths remain short video links. Use the clean /watch URL.
    const target = new URL("/watch", url.origin);
    target.searchParams.set("slug", rawPath);
    return Response.redirect(target.toString(), 302);
  } catch (error) {
    console.error("Jsvidey short-link routing error:", error);
    return new Response("Routing error. Check Cloudflare Pages Function logs.", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
}
