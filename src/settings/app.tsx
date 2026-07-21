import { useMemo } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import { __experimentalText as Text } from '@wordpress/components';
import {
	SettingsPage,
	type SettingsFieldConfig,
	type SettingsSectionConfig,
} from '@prc/components';

import './style.scss';
import { fetchSettings, saveSettings } from './api';
import { store as settingsStore } from './store';
import type { BitDescriptor } from './types';

/**
 * Group bits by their namespace prefix (the part before the slash).
 *
 * @param bits
 */
function groupByNamespace(bits: BitDescriptor[]): Map<string, BitDescriptor[]> {
	const groups = new Map<string, BitDescriptor[]>();
	for (const bit of bits) {
		const namespace = bit.name.split('/')[0];
		if (!groups.has(namespace)) {
			groups.set(namespace, []);
		}
		groups.get(namespace)!.push(bit);
	}
	return groups;
}

function bitFields(bits: BitDescriptor[]): SettingsFieldConfig[] {
	return bits.map((bit) => ({
		id: `bit_enabled.${bit.name}`,
		type: 'boolean' as const,
		label: bit.label,
		description: bit.name,
	}));
}

export default function SettingsApp() {
	const bits = useSelect(
		(sel) => sel(settingsStore).getBits() as BitDescriptor[],
		[]
	);

	const sections = useMemo((): SettingsSectionConfig[] => {
		if (bits.length === 0) {
			return [
				{
					slug: 'registered-bits',
					title: __('Registered Bits', 'prc-block-bits'),
					description: __(
						'Toggle bits on or off. Changes save automatically.',
						'prc-block-bits'
					),
					render: () => (
						<Text>
							{__(
								'No bits are currently registered.',
								'prc-block-bits'
							)}
						</Text>
					),
				},
			];
		}

		const grouped = groupByNamespace(bits);
		const multiNamespace = grouped.size > 1;

		return Array.from(grouped.entries()).map(([namespace, nsBits]) => ({
			slug: `bits-${namespace}`,
			title: multiNamespace
				? namespace
				: __('Registered Bits', 'prc-block-bits'),
			description: multiNamespace
				? sprintf(
						/* translators: %s: bit namespace prefix (e.g. prc-block-bits) */
						__(
							'Toggle bits in the %s namespace. Changes save automatically.',
							'prc-block-bits'
						),
						namespace
					)
				: __(
						'Toggle bits on or off. Disabled bits are hidden from the editor toolbar and are not rendered on the frontend. Changes save automatically.',
						'prc-block-bits'
					),
			fields: bitFields(nsBits),
		}));
	}, [bits]);

	return (
		<SettingsPage
			title={__('Block Bits Settings', 'prc-block-bits')}
			description={__(
				'Enable or disable registered block bits. Disabled bits are hidden from the editor toolbar and are not rendered on the frontend.',
				'prc-block-bits'
			)}
			textDomain="prc-block-bits"
			idPrefix="prc-block-bits-settings"
			store={settingsStore}
			saveSettings={saveSettings}
			sections={sections}
			onLoad={fetchSettings}
		/>
	);
}
