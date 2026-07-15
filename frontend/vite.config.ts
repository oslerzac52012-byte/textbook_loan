import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
  ],

  test: {
    environment: "jsdom",
    setupFiles: [
      "./src/test/setup.ts",
    ],
    css: true,
    clearMocks: true,
    restoreMocks: true,
  },

  build: {
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,

        codeSplitting: {
          groups: [
            {
              name: "react-vendor",

              test:
                /node_modules[\\/](react|react-dom|scheduler)[\\/]/,

              priority: 30,
            },

            {
              name: "stellar-vendor",

              test:
                /node_modules[\\/]@stellar[\\/]/,

              priority: 20,
            },

            {
              name: "contract-client",

              test:
                /node_modules[\\/]textbook_loan[\\/]/,

              priority: 15,
            },

            {
              name: "vendor",
              test: /node_modules/,
              priority: 10,
              maxSize: 350_000,
            },
          ],
        },
      },
    },
  },
});
