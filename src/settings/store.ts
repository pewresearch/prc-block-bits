import { createSettingsStore } from '@prc/components';
import type {
	Settings,
	BitDescriptor,
	SettingsStoreState,
	ApiResponse,
} from './types';

export const STORE_NAME = 'prc/block-bits-settings';

export const store = createSettingsStore<
	Settings,
	SettingsStoreState,
	ApiResponse
>({
	name: STORE_NAME,
	defaultState: {
		settings: {
			// eslint-disable-next-line camelcase
			disabled_bits: [],
		},
		bits: [],
		isLoaded: false,
	},
	mapResponseToState: (_state, response) => ({
		bits: response.bits,
	}),
	extraActions: {
		toggleBit(bitName: string) {
			return { type: 'TOGGLE_BIT', payload: bitName };
		},
	},
	extraReducer: (state, action) => {
		if (action.type === 'TOGGLE_BIT') {
			const bitName = action.payload as string;
			// eslint-disable-next-line camelcase
			const currentDisabled = state.settings.disabled_bits;
			const isCurrentlyDisabled = currentDisabled.includes(bitName);
			const nextDisabled = isCurrentlyDisabled
				? currentDisabled.filter((n) => n !== bitName)
				: [...currentDisabled, bitName];
			return {
				...state,
				settings: {
					...state.settings,
					// eslint-disable-next-line camelcase
					disabled_bits: nextDisabled,
				},
			};
		}
		return null;
	},
	extraSelectors: {
		getBits(state: SettingsStoreState): BitDescriptor[] {
			return state.bits;
		},
	},
});
