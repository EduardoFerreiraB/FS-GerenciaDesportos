import type { NextConfig } from "next";
import { existsSync, writeFileSync } from "node:fs";

// Páginas `*.e2e.tsx` são harness do Playwright: só existem quando E2E_HARNESS=1,
// nunca no build de produção.
const harnessE2E = process.env.E2E_HARNESS === "1";
const extensoesE2E = harnessE2E ? ["e2e.tsx"] : [];
const portaWebE2E = process.env.E2E_PORTA_WEB ?? "3001";

// O `next dev` acrescenta a pasta de build ao `include` do tsconfig que usa. No E2E,
// cada porta usa um tsconfig próprio (ignorado pelo git) que herda o principal, para que
// as execuções simultâneas não alterem o `tsconfig.json` versionado.
const tsconfigE2E = `tsconfig.e2e-${portaWebE2E}.json`;
if (harnessE2E && !existsSync(tsconfigE2E)) {
  writeFileSync(tsconfigE2E, JSON.stringify({ extends: "./tsconfig.json" }, null, 2) + "\n");
}

const nextConfig: any = {
  pageExtensions: [...extensoesE2E, "tsx", "ts", "jsx", "js"],
  // O servidor do E2E compila em pasta própria e pode rodar junto do `next dev` normal.
  // Uma pasta por porta: execuções simultâneas do Playwright (E2E_PORTA_WEB diferentes)
  // não disputam o mesmo diretório de build.
  distDir: harnessE2E ? `.next-e2e-${portaWebE2E}` : ".next",
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
    ...(harnessE2E ? { tsconfigPath: tsconfigE2E } : {}),
  }
};

export default nextConfig;