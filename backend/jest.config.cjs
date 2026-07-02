module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  setupFiles: ["<rootDir>/src/tests/setup-env.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  clearMocks: true
};
