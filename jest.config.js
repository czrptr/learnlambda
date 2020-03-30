module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	moduleDirectories: [
		"node_modules",
		"<rootDir>/src",
	],
	testMatch: [
		"<rootDir>/src/tests/**/*.test.ts",
	],
};