import { createSettingsStore } from '@prc/components';
import type {
	Settings,
	BitDescriptor,
	SettingsStoreState,
	ApiResponse,
} from './types';

export const STORE_NAME = 'prc/block-bits-settings';

/**
 * Map REST `{ disabled_bits }` + registered bits → `{ bit_enabled }` for DataForm.
 *
 * @param response
 */
function settingsFromResponse(response: ApiResponse): {
	settings: Settings;
	orphanDisabledBits: string[];
} {
	const disabled = new Set(response.settings?.disabled_bits ?? []);
	const bits = response.bits ?? [];
	const knownNames = new Set(bits.map((bit) => bit.name));
	const bitEnabled: Record<string, boolean> = {};

	for (const bit of bits) {
		bitEnabled[bit.name] = !disabled.has(bit.name);
	}

	const orphanDisabledBits = [...disabled].filter(
		(name) => !knownNames.has(name)
	);

	return {
		settings: {
			// eslint-disable-next-line camelcase -- mirrors form field path prefix
			bit_enabled: bitEnabled,
		},
		orphanDisabledBits,
	};
}

export const store = createSettingsStore<
	Settings,
	SettingsStoreState,
	ApiResponse
>({
	name: STORE_NAME,
	defaultState: {
		settings: {
			// eslint-disable-next-line camelcase
			bit_enabled: {},
		},
		bits: [],
		orphanDisabledBits: [],
		isLoaded: false,
	},
	getSettingsFromResponse: (response) =>
		settingsFromResponse(response).settings,
	mapResponseToState: (_state, response) => {
		const mapped = settingsFromResponse(response);
		return {
			bits: response.bits ?? [],
			orphanDisabledBits: mapped.orphanDisabledBits,
		};
	},
	extraSelectors: {
		getBits(state: SettingsStoreState): BitDescriptor[] {
			return state.bits;
		},
		getOrphanDisabledBits(state: SettingsStoreState): string[] {
			return state.orphanDisabledBits;
		},
	},
});
