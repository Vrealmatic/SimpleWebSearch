import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/client.ts", "src/cli.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  noExternal: ["minisearch"],
  clean: true,
  sourcemap: true,
});
