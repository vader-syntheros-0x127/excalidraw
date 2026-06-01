// STRL: self-host every woff2 font from the app's own origin for BOTH the web
// and desktop builds — no excalidraw.com CDN phone-home. The fonts are bundled
// in the build (editor fonts under /fonts/..., the Assistant UI font as
// /Assistant-Regular.woff2), so this keeps the app fully local/private and lets
// it run under a strict `font-src 'self'` CSP. Upstream points the *web* build
// at its shared CDN for cache reuse; this fork is local-first, so we diverge and
// serve fonts locally on web too (the desktop build already did).

/**
 * Custom vite plugin for self-hosting `EXCALIDRAW_ASSET_PATH` woff2 fonts in `excalidraw-app`.
 *
 * @returns {import("vite").PluginOption}
 */
module.exports.woff2BrowserPlugin = () => {
  let isDev;
  // Desktop loads instantly from disk, so it skips the preload hints the web
  // build emits; both resolve fonts from their own origin (no CDN).
  let isDesktop;

  return {
    name: "woff2BrowserPlugin",
    enforce: "pre",
    config(_, { command, mode }) {
      isDev = command === "serve";
      isDesktop = mode === "desktop";
    },
    transform(code, id) {
      // using copy / replace as fonts defined in the `.css` don't have to be manually copied over (vite/rollup does this automatically),
      // but at the same time can't be easily prefixed with the `EXCALIDRAW_ASSET_PATH` only for the `excalidraw-app`
      if (!isDev && id.endsWith("/excalidraw/fonts/fonts.css")) {
        // STRL: only Assistant-Regular ships in the build (the heavier weights
        // are CDN-only upstream). Point a single @font-face at the bundled file
        // and let the browser synthesize the 500/600/700 weights — fully local,
        // no CDN, for both web and desktop.
        return `/* WARN: The following content is generated during excalidraw-app build */

      @font-face {
        font-family: "Assistant";
        src: url(/Assistant-Regular.woff2) format("woff2");
        font-weight: 400 700;
        style: normal;
        display: swap;
      }`;
      }

      if (!isDev && id.endsWith("excalidraw-app/index.html")) {
        // STRL: resolve all fonts from the app's own origin (bundled under
        // /fonts/...) and emit no cross-origin CDN preloads — keeps the strict
        // `font-src 'self'` CSP working and avoids any phone-home.
        const assetPathScript = `<script>
        // STRL: load bundled fonts locally (no CDN phone-home).
        window.EXCALIDRAW_ASSET_PATH = window.origin;
      </script>`;

        if (isDesktop) {
          return code.replace(
            "<!-- PLACEHOLDER:EXCALIDRAW_APP_FONTS -->",
            assetPathScript,
          );
        }

        return code.replace(
          "<!-- PLACEHOLDER:EXCALIDRAW_APP_FONTS -->",
          `${assetPathScript}

      <!-- Preload the default fonts (self-hosted) to avoid swap on init -->
      <link
        rel="preload"
        href="/fonts/Excalifont/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2"
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
      <!-- For Nunito only preload the latin range, which should be good enough for now -->
      <link
        rel="preload"
        href="/fonts/Nunito/Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTQ3j6zbXWjgeg.woff2"
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
      <link
        rel="preload"
        href="/Assistant-Regular.woff2"
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
      <link
        rel="preload"
        href="/fonts/ComicShanns/ComicShanns-Regular-279a7b317d12eb88de06167bd672b4b4.woff2"
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
    `,
        );
      }
    },
  };
};
