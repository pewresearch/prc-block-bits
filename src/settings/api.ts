import { select } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { createSettingsClient } from '@prc/components';

import { store } from './store';
import type { BitDescriptor, PersistableSettings, Settings } from './types';

type SettingsStoreSelect = {
	getSettings: () => Settings;
	getBits: () => BitDescriptor[];
	getOrphanDisabledBits: () => string[];
};

/**
 * Convert form `bit_enabled` map (+ orphan names) back to the PHP option shape.
 */
function toPersistableSettings(): PersistableSettings {
	const storeSelect = select(store) as unknown as SettingsStoreSelect;
	const settings = storeSelect.getSettings();
	const bits = storeSelect.getBits();
	const orphans = storeSelect.getOrphanDisabledBits();

	const knownDisabled = bits
		.filter((bit) => settings.bit_enabled[bit.name] === false)
		.map((bit) => bit.name);

	return {
		// eslint-disable-next-line camelcase
		disabled_bits: [...new Set([...knownDisabled, ...orphans])],
	};
}

export const { fetchSettings, saveSettings } = createSettingsClient({
	restPath: '/prc-block-bits/v1/settings',
	store,
	successMessage: __('Settings saved.', 'prc-block-bits'),
	getSaveData: toPersistableSettings,
});
