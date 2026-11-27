import { defineConfig } from "oxlint";

export default defineConfig({
  jsPlugins: [
    {
      name: "landmines",
      specifier: "../../packages/fence/plugins/landmines/index.ts",
    },
  ],
  rules: {
    "landmines/no-fixed-sleep": "warn",
    "landmines/no-flake-masking-timeout": ["warn", { check: "timeout" }],
    "landmines/no-test-doubles": "warn",
  },
});
