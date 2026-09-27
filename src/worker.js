/**
 * Sarkar Sahayak — Cloudflare Worker
 *
 * The app itself is 100% static (HTML/CSS/JS in /public) and is served
 * directly by Cloudflare's asset layer via the [assets] binding declared
 * in wrangler.toml. This worker is intentionally thin: it exists so the
 * project has a real Worker entry point (as required for the GitHub ->
 * Cloudflare Worker sync flow), and it's the place to extend later with
 * things like security headers, redirects, or a small API.
 */

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

export default {
  async fetch(request, env, ctx) {
    // Hand off to the static asset binding. Because
    // not_found_handling = "single-page-application" is set in
    // wrangler.toml, unknown paths automatically fall back to
    // index.html instead of a bare 404.
    const response = await env.ASSETS.fetch(request);

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
