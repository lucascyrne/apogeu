import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@hand-gestures/protocol": path.resolve(
        __dirname,
        "../../packages/protocol/src/index.ts"
      ),
      "@hand-gestures/mapping": path.resolve(
        __dirname,
        "../../packages/mapping/src/index.ts"
      ),
      "@hand-gestures/vision": path.resolve(
        __dirname,
        "../../packages/vision/src/index.ts"
      ),
      "@hand-gestures/audio": path.resolve(
        __dirname,
        "../../packages/audio/src/index.ts"
      ),
    },
  },
  server: { port: 5173 },
});
