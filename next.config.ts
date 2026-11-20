import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { NextConfig } from "next";
import type { webpack as Webpack } from "next/dist/compiled/webpack/webpack";
import { version as pdfVersion } from "pdfjs-dist/package.json";
import { AlphaTabWebPackPlugin } from "@coderline/alphatab-webpack";

// PDF.js loads its codecs and fonts by filename relative to asset directories.
// Emit those directories with the matching worker in the existing Next host.
const pdfAssets = {
  apply(compiler: Webpack.Compiler) {
    const name = "NoteQuizPdfAssets";
    const root = dirname(require.resolve("pdfjs-dist/package.json"));
    compiler.hooks.thisCompilation.tap(
      name,
      (compilation: Webpack.Compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name,
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
          },
          () => {
            const files = ["LICENSE", "legacy/build/pdf.worker.min.mjs"];
            for (const folder of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
              for (const file of readdirSync(join(root, folder)))
                files.push(folder + "/" + file);
            }
            for (const file of files) {
              compilation.emitAsset(
                `static/pdfjs/${pdfVersion}/${file}`,
                new compiler.webpack.sources.RawSource(
                  readFileSync(join(root, file)),
                ),
                { minimized: true },
              );
            }
          },
        );
      },
    );
  },
};

const nextConfig: NextConfig = {
  webpack(config, { isServer }) {
    if (!isServer) {
      // The unminified PDF.js bundle shadows the Next dev runtime's
      // __webpack_exports__ binding. Its matching minified ESM build doesn't.
      config.resolve.alias["pdfjs-dist/legacy/build/pdf.mjs$"] =
        require.resolve("pdfjs-dist/legacy/build/pdf.min.mjs");
      config.plugins.push(pdfAssets);
    }
    config.plugins.push(
      new AlphaTabWebPackPlugin({ assetOutputDir: "public/alphatab" }),
    );
    return config;
  },
  env: {
    NEXT_PUBLIC_SITE_URL: "https://note-quiz.com",
  },
  async redirects() {
    return [
      ...["/melody", "/:locale(en|ko|ja|es|de|fr|zh|pt|ru|ka|eo)/melody"].map(
        (source) => ({
          source,
          destination: source + "/generated",
          permanent: true,
        }),
      ),
      // Permanent URL migration: resolve practice indexes before layout streaming.
      ...[
        "/practice",
        "/:locale(en|ko|ja|es|de|fr|zh|pt|ru|ka|eo)/practice",
      ].flatMap((source) => {
        const base = source.startsWith("/:locale")
          ? "/:locale/practice"
          : "/practice";
        return [
          {
            source,
            destination: `${base}/note`,
            permanent: true,
            missing: [{ type: "query" as const, key: "mode" }],
          },
          ...["note", "ear", "interval", "chord"].map((mode) => ({
            source,
            destination: `${base}/${mode}`,
            permanent: true,
            has: [{ type: "query" as const, key: "mode", value: mode }],
          })),
        ];
      }),
      {
        source: "/game",
        destination: "/practice/note",
        permanent: false,
      },
      {
        source: "/ear-training",
        destination: "/practice/ear",
        permanent: false,
      },
      {
        source: "/leaderboard",
        destination: "/practice/note?leaderboard=open",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
