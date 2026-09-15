/**
 * Jest configuration for prc-block-bits unit tests.
 * Unit tests live under monorepo root tests/prc-block-bits/unit/.
 */
const path = require('path');

const unitRoot = path.resolve(__dirname, '../../tests/prc-block-bits/unit');

module.exports = {
	...require('@wordpress/scripts/config/jest-unit.config'),
	rootDir: __dirname,
	roots: [unitRoot],
	testMatch: ['**/*.test.js', '**/*.test.ts'],
	transform: {
		'^.+\\.(js|jsx|ts|tsx)$':
			require.resolve('@wordpress/scripts/config/babel-transform'),
	},
};
