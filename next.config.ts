import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SITE_URL: "https://note-quiz.com",
  },
  async redirects() {
    return [
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
