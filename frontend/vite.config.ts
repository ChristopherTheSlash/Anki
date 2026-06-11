import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repository = process.env.GITHUB_REPOSITORY?.split("/").at(-1);
const defaultBase = repository ? `/${repository}/` : "/";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || defaultBase,
  plugins: [react()],
});
