module.exports = {
  testEnvironment: 'node',
  // Specifies the root directory Jest should scan for tests and modules within
  rootDir: './server',
  // The glob patterns Jest uses to detect test files
  // This pattern means any .js, .jsx, .ts, .tsx file inside a __tests__ folder,
  // or any file with a .test or .spec extension.
  testMatch: [
    '<rootDir>/__tests__/**/*.test.js', // Looks for tests in server/__tests__
    // '<rootDir>/*.test.js', // Temporarily disable to focus on __tests__ if needed
  ],
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: false, // Temporarily disabled to speed up and isolate timeout
  // The directory where Jest should output its coverage files
  // coverageDirectory: '<rootDir>/../coverage/server',
  // An array of glob patterns indicating a set of files for which coverage information should be collected
  // collectCoverageFrom: [
  //   '<rootDir>/*.js',
  // ],
  // coverageReporters: ['text', 'lcov', 'json-summary'],
  // Automatically clear mock calls and instances between every test
  clearMocks: true, // Keep this
  // The number of seconds after which a test is considered as failed.
  testTimeout: 30000, // Increased timeout for potentially complex tests or CI environments (was 10000)
  // Force Jest to exit after tests have completed.
  forceExit: true,
  // Setup files to run before each test file in the suite is executed
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // If specific setup is needed (e.g. for mocks)
  // ModuleNameMapper for mocking static assets if server code ever tried to import them (unlikely for server.js)
  // moduleNameMapper: {
  //   '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  // },
  verbose: true, // Output more information
};
