/**
 * Jest configuration — uses sucrase for TypeScript transformation.
 *
 * sucrase is available as a transitive dependency  (no install required).
 */

const { writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');

// Custom transform using sucrase (faster than ts-jest, no full type-check)
const { transform } = require('sucrase');

module.exports = {
  testEnvironment: 'node',

  transform: {
    '^.+\\.tsx?$': [path.resolve(__dirname, 'jest-transform.js'), {}],
  },

  // Ignore Next.js build output and node_modules
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],

  // Allow importing from @/ (matching tsconfig paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
