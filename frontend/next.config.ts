import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  compress: true,
  // Declarar turbopack vacío para que Next.js 16 no falle al leer el webpack config
  turbopack: {},
  modularizeImports: {
    "date-fns": {
      transform: "date-fns/{{member}}",
    },
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...(config.optimization.splitChunks as any)?.cacheGroups,
          pdflibs: {
            test: /[\/]node_modules[\/](jspdf|jspdf-autotable)[\/]/,
            name: "chunk-pdf",
            chunks: "all",
            priority: 20,
          },
          xlsxlib: {
            test: /[\/]node_modules[\/](xlsx)[\/]/,
            name: "chunk-xlsx",
            chunks: "all",
            priority: 20,
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;


