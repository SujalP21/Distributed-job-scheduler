module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  ignorePatterns: ["dist", "node_modules", "coverage"],
  rules: {
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
  }
};
