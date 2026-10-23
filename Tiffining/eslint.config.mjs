import { defineConfig, configs } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";

export default defineConfig([
  ...configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
]);
