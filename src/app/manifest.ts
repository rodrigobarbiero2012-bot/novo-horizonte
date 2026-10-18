import type { MetadataRoute } from "next";

// Permite instalar o sistema no celular (ícone na tela inicial, abre sem a barra do navegador).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Novo Horizonte",
    short_name: "Novo Horizonte",
    description: "Gestão financeira, contábil e de produção do Sítio Novo Horizonte",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#1c4332",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ler boleto ou nota", url: "/lancamentos/ler", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "A pagar e receber", url: "/a-pagar-receber", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
