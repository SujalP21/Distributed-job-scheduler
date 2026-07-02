module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  env: {
    node: true,
    jest: true,
    es2022: true
  },
  ignorePatterns: ["dist", "node_modules", "coverage", "generated"],
  rules: {
    "@typescript-eslint/no-namespace": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
  }
};
