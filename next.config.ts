import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // A antiga aba "Razão" virou "Lançamentos"; links salvos continuam funcionando.
  async redirects() {
    return [{ source: "/razao", destination: "/lancamentos", permanent: true }];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
