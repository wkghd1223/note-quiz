import type { NextConfig } from "next";
import { AlphaTabWebPackPlugin } from "@coderline/alphatab-webpack";

const nextConfig: NextConfig = {
  webpack(config) {
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
