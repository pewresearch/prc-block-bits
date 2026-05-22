import { useState, useRef } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import {
	Button,
	ToggleControl,
	__experimentalVStack as VStack,
	__experimentalText as Text,
} from '@wordpress/components';
import { store as settingsStore } from '../store';
import { saveSettings } from '../api';
import type { BitDescriptor } from '../types';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Group bits by their namespace prefix (the part before the slash).
 *
 * @param {BitDescriptor[]} bits All registered bit descriptors.
 * @return {Map<string, BitDescriptor[]>} Bits keyed by namespace.
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

export default function BitsSection() {
	const [saveState, setSaveState] = useState<SaveState>('idle');
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const { bits } = useSelect((sel) => {
		return {
			bits: sel(settingsStore).getBits(),
		};
	}, []);

	const { toggleBit } = useDispatch(settingsStore);

	const disabledBits = useSelect(
		(sel) => sel(settingsStore).getSettings().disabled_bits,
		[]
	);

	async function handleSave() {
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}
		setSaveState('saving');
		try {
			await saveSettings();
			setSaveState('saved');
		} catch {
			setSaveState('error');
		} finally {
			saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
		}
	}

	if (bits.length === 0) {
		return (
			<Text>
				{__('No bits are currently registered.', 'prc-block-bits')}
			</Text>
		);
	}

	const grouped = groupByNamespace(bits);

	return (
		<VStack spacing={4}>
			{Array.from(grouped.entries()).map(([namespace, nsBits]) => (
				<div
					key={namespace}
					className="block-bits-settings__namespace-group"
				>
					{grouped.size > 1 && (
						<p className="block-bits-settings__namespace-label">
							{namespace}
						</p>
					)}
					<VStack spacing={2}>
						{nsBits.map((bit) => (
							<div
								key={bit.name}
								className="block-bits-settings__bit-row"
							>
								<ToggleControl
									label={bit.label}
									help={bit.name}
									checked={!disabledBits.includes(bit.name)}
									onChange={() => toggleBit(bit.name)}
									__nextHasNoMarginBottom
								/>
							</div>
						))}
					</VStack>
				</div>
			))}
			<div className="block-bits-settings__form-actions">
				<Button
					variant="primary"
					onClick={handleSave}
					isBusy={saveState === 'saving'}
					disabled={saveState === 'saving'}
				>
					{saveState === 'saving' && __('Saving…', 'prc-block-bits')}
					{saveState === 'saved' && __('Saved', 'prc-block-bits')}
					{saveState === 'error' &&
						__('Error — try again', 'prc-block-bits')}
					{saveState === 'idle' &&
						__('Save Changes', 'prc-block-bits')}
				</Button>
			</div>
		</VStack>
	);
}
