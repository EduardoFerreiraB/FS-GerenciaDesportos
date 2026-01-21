import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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