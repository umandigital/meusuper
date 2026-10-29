import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      // o leitor de PDF (pdf.js) e pesado: nao entra na instalacao; baixa na 1a vez que um PDF e usado e fica guardado
      injectManifest: { globIgnores: ["**/pdf*"] },
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "MeuSuper",
        short_name: "MeuSuper",
        description: "MeuSuper",
        lang: "pt-BR",
        start_url: "/",
        orientation: "portrait",
        display: "standalone",
        background_color: "#f8faf9",
        theme_color: "#10b981",
        // "Compartilhar > MeuSuper" no Android (app instalado): recebe o PDF do cupom
        share_target: {
          action: "/share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            title: "title",
            text: "text",
            url: "url",
            files: [{ name: "cupom", accept: ["application/pdf", ".pdf", "text/xml", "application/xml", ".xml", "text/plain"] }],
          },
        },
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      }
    })
  ]
});
