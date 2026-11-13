import js from "@eslint/js";
import babelParser from "@babel/eslint-parser";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "dist/**", ".venv/**"],
  },
  js.configs.recommended,
  {
    files: ["eslint.config.js", "vite.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.js"],
    ignores: ["eslint.config.js", "vite.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { plugins: ["@babel/plugin-syntax-typescript"] },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
];
