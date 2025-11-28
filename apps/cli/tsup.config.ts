import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs"],
    clean: true,
    outDir: "dist",
    platform: "node",
    noExternal: [/(.*)/], // Bundle everything
});
