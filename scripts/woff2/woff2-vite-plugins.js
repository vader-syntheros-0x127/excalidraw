// define `EXCALIDRAW_ASSET_PATH` as a SSOT
const OSS_FONTS_CDN = "https://excalidraw.nyc3.cdn.digitaloceanspaces.com/oss/";
const OSS_FONTS_FALLBACK = "/";

/**
 * Custom vite plugin for auto-prefixing `EXCALIDRAW_ASSET_PATH` woff2 fonts in `excalidraw-app`.
 *
 * @returns {import("vite").PluginOption}
 */
module.exports.woff2BrowserPlugin = () => {
  let isDev;
  // STRL: when building the desktop app (`--mode desktop`) we serve the bundled
  // fonts locally (no excalidraw.com CDN phone-home) so the packaged app stays
  // offline / private and can run under a strict `self`-only CSP.
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
        // STRL desktop: only Assistant-Regular ships in the build (the heavier
        // weights are CDN-only upstream). Point a single @font-face at the
        // bundled file via an absolute app-root path and let the browser
        // synthesize the 500/600/700 weights — fully local, no CDN.
        if (isDesktop) {
          return `/* WARN: The following content is generated during excalidraw-app build */

      @font-face {
        font-family: "Assistant";
        src: url(/Assistant-Regular.woff2) format("woff2");
        font-weight: 400 700;
        style: normal;
        display: swap;
      }`;
        }
        const assistantFace = (weight, file) =>
          `@font-face {
        font-family: "Assistant";
        src: url(${OSS_FONTS_CDN}fonts/Assistant/${file})
            format("woff2"),
          url(./${file}) format("woff2");
        font-weight: ${weight};
        style: normal;
        display: swap;
      }`;
        return `/* WARN: The following content is generated during excalidraw-app build */

      ${assistantFace(400, "Assistant-Regular.woff2")}

      ${assistantFace(500, "Assistant-Medium.woff2")}

      ${assistantFace(600, "Assistant-SemiBold.woff2")}

      ${assistantFace(700, "Assistant-Bold.woff2")}`;
      }

      if (!isDev && id.endsWith("excalidraw-app/index.html")) {
        // STRL desktop: resolve fonts from the app's own origin (bundled under
        // app://-/fonts/...), and emit no cross-origin CDN preloads.
        if (isDesktop) {
          return code.replace(
            "<!-- PLACEHOLDER:EXCALIDRAW_APP_FONTS -->",
            `<script>
        // STRL desktop: load bundled fonts locally (no CDN phone-home).
        window.EXCALIDRAW_ASSET_PATH = window.origin;
      </script>`,
          );
        }
        return code.replace(
          "<!-- PLACEHOLDER:EXCALIDRAW_APP_FONTS -->",
          `<script>
        // point into our CDN in prod, fallback to root (excalidraw.com) domain in case of issues
        window.EXCALIDRAW_ASSET_PATH = [
          "${OSS_FONTS_CDN}",
          "${OSS_FONTS_FALLBACK}",
        ];
      </script>

      <!-- Preload all default fonts to avoid swap on init -->
      <link
        rel="preload"
        href="${OSS_FONTS_CDN}fonts/Excalifont/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2"
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
      <!-- For Nunito only preload the latin range, which should be good enough for now -->
      <link
        rel="preload"
        href="${OSS_FONTS_CDN}fonts/Nunito/Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTQ3j6zbXWjgeg.woff2"
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
      <link
        rel="preload"
        href="${OSS_FONTS_CDN}fonts/Assistant/Assistant-SemiBold.woff2"
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
      <link
        rel="preload"
        href="${OSS_FONTS_CDN}fonts/ComicShanns/ComicShanns-Regular-279a7b317d12eb88de06167bd672b4b4.woff2"
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
