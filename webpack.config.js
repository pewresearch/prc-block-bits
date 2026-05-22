const config = require('../../webpack.config');

module.exports = {
	...config,
	entry: {
		'editor/index': './src/editor/index.ts',
	},
	output: {
		...config.output,
		// Expose the editor entry's exports (`registerBlockBit`,
		// `getBlockBit`, `getAllBlockBits`, `getBitsApplicableTo`) as
		// `window.prcBlockBitsEditor` so consumer plugins (PT-2026 in U7,
		// future bit consumers) can resolve `@prc/block-bits` imports via
		// the platform-wide externalization in `dependency-extraction.js`.
		//
		// Distinct from `window.prcBlockBits.bits` — that's the localized
		// payload set in `Assets::enqueue_editor_assets()` before this
		// script runs. Keeping the names distinct avoids the inline-script
		// payload being clobbered when this bundle assigns to window.
		library: { name: 'prcBlockBitsEditor', type: 'window' },
	},
};
