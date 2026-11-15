import { isPracticeMode } from "@/lib/practice/routing";
import { stripLocale } from "@/lib/i18n/locale";

/** Decide legacy HTTP status outside the persistent layout's RSC stream. */
export function GET(request: Request): Response {
  const url = new URL(request.url);
  // Next custom redirect matching uses the last value for a repeated query key.
  const mode = url.searchParams.getAll("mode").at(-1) ?? "note";
  if (stripLocale(url.pathname) !== "/practice" || !isPracticeMode(mode)) {
    return new Response(null, {
      status: 404,
      headers: { "X-Robots-Tag": "noindex" },
    });
  }
  url.pathname = `${url.pathname}/${mode}`;
  return Response.redirect(url, 308);
}
