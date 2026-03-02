import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  compress: true,
  // Mejorar tree-shaking de date-fns (solo importar locales usados)
  modularizeImports: {
    "date-fns": {
      transform: "date-fns/{{member}}",
    },
  },
  webpack(config, { isServer }) {
    // Separar jsPDF y xlsx en chunks separados (lazy cargados solo cuando se usan)
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...(config.optimization.splitChunks as any)?.cacheGroups,
          pdflibs: {
            test: /[\\/]node_modules[\\/](jspdf|jspdf-autotable)[\\/]/,
            name: "chunk-pdf",
            chunks: "all",
            priority: 20,
          },
          xlsxlib: {
            test: /[\\/]node_modules[\\/](xlsx)[\\/]/,
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


