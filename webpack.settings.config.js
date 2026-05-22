const path = require('path');
const config = require('../../webpack.config');

module.exports = {
	...config,
	entry: {
		index: path.resolve(__dirname, 'src/settings/index.tsx'),
	},
	output: {
		...config.output,
		path: path.resolve(__dirname, 'build/settings'),
		// No `library` window export — the settings page is a self-contained
		// React app, not a shared module.
		library: undefined,
	},
};
