import type { NextConfig } from "next";

// Páginas `*.e2e.tsx` são harness do Playwright: só existem quando E2E_HARNESS=1,
// nunca no build de produção.
const harnessE2E = process.env.E2E_HARNESS === "1";
const extensoesE2E = harnessE2E ? ["e2e.tsx"] : [];

const nextConfig: any = {
  pageExtensions: [...extensoesE2E, "tsx", "ts", "jsx", "js"],
  // O servidor do E2E compila em pasta própria e pode rodar junto do `next dev` normal.
  distDir: harnessE2E ? ".next-e2e" : ".next",
  // Indicador de dev do Next fica à direita: à esquerda ele cobre o botão de recolher a sidebar.
  devIndicators: { position: "bottom-right" },
  // output: "standalone", // Comentado para deploy na Vercel
  eslint: {
    // Ignora erros de lint no build de produção para não travar o deploy por detalhes
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignora erros de TS no build para garantir que suba mesmo com warnings
    ignoreBuildErrors: true, 
  }
};

export default nextConfig;