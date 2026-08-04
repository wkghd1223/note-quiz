import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SITE_URL: "https://note-quiz.com",
  },
  async redirects() {
    return [
      {
        source: "/ads.txt",
        destination:
          "https://adstxt.journeymv.com/sites/5b2560fd-53fe-4920-872c-67302bb9311c/ads.txt",
        permanent: true,
      },
      {
        source: "/game",
        destination: "/practice?mode=note",
        permanent: false,
      },
      {
        source: "/ear-training",
        destination: "/practice?mode=ear",
        permanent: false,
      },
      {
        source: "/leaderboard",
        destination: "/practice?leaderboard=open",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
