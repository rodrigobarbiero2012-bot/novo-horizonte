import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // Leitura de boletos/notas: fotos são comprimidas no navegador, mas PDFs
    // vão como estão. 4 MB fica abaixo do teto de 4,5 MB das funções da Vercel.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async redirects() {
    return [
      // A antiga aba "Razão" virou "Lançamentos"; links salvos continuam funcionando.
      { source: "/razao", destination: "/lancamentos", permanent: true },
      // "Cronograma" no menu é só o título do grupo; o endereço sem atividade abre o café.
      { source: "/cronograma", destination: "/cronograma/cafe", permanent: false },
      { source: "/producao", destination: "/producao/cafe", permanent: false },
      // Vendas virou uma aba de "Produção e vendas".
      {
        source: "/vendas",
        has: [{ type: "query", key: "atividade", value: "(?<atividade>cafe|maracuja|milho|pecuaria)" }],
        destination: "/producao/:atividade?aba=vendas",
        permanent: false,
      },
      { source: "/vendas", destination: "/producao/cafe?aba=vendas", permanent: false },
    ];
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
