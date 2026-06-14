import { createReadStream, cpSync, existsSync, rmSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";

const root = dirname(fileURLToPath(import.meta.url));
const cesiumBuild = resolve(root, "../../node_modules/cesium/Build/Cesium");
const cesiumFolders = ["Assets", "ThirdParty", "Workers", "Widgets"];

export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify("/cesium")
  },
  plugins: [react(), cesiumAssets()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787"
    }
  }
});

function cesiumAssets(): Plugin {
  return {
    name: "terrafuse-cesium-assets",
    configureServer(server) {
      server.middlewares.use("/cesium", (request, response, next) => {
        const pathname = decodeURIComponent((request.url ?? "").split("?")[0]).replace(/^\/+/, "");
        const filePath = resolve(cesiumBuild, pathname);

        if (!isInside(filePath, cesiumBuild) || !existsSync(filePath) || !statSync(filePath).isFile()) {
          next();
          return;
        }

        response.setHeader("Content-Type", mimeType(filePath));
        createReadStream(filePath).pipe(response);
      });
    },
    closeBundle() {
      const output = resolve(root, "dist/cesium");
      rmSync(output, { recursive: true, force: true });

      for (const folder of cesiumFolders) {
        cpSync(resolve(cesiumBuild, folder), resolve(output, folder), { recursive: true });
      }
    }
  };
}

function isInside(pathname: string, parent: string) {
  const offset = relative(parent, pathname);
  return offset === "" || (!offset.startsWith("..") && !isAbsolute(offset));
}

function mimeType(filePath: string) {
  switch (extname(filePath).toLowerCase()) {
    case ".css":
      return "text/css";
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".js":
    case ".mjs":
      return "text/javascript";
    case ".json":
      return "application/json";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".wasm":
      return "application/wasm";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}
