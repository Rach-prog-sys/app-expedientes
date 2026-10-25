import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// "base" tiene que coincidir con el nombre del repositorio en GitHub
export default defineConfig({
  base: "/app-expedientes/",
  plugins: [react()],
});
