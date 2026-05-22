import { createReduxStore, register } from '@wordpress/data';
import type {
	Settings,
	BitDescriptor,
	SettingsStoreState,
	ApiResponse,
} from './types';

export const STORE_NAME = 'prc/block-bits-settings';

const DEFAULT_STATE: SettingsStoreState = {
	settings: {
		// eslint-disable-next-line camelcase
		disabled_bits: [],
	},
	bits: [],
	isLoaded: false,
};

type Action =
	| { type: 'SET_FROM_RESPONSE'; payload: ApiResponse }
	| { type: 'TOGGLE_BIT'; payload: string };

const store = createReduxStore(STORE_NAME, {
	reducer(
		state: SettingsStoreState = DEFAULT_STATE,
		action: Action
	): SettingsStoreState {
		switch (action.type) {
			case 'SET_FROM_RESPONSE':
				return {
					...state,
					settings: action.payload.settings,
					bits: action.payload.bits,
					isLoaded: true,
				};
			case 'TOGGLE_BIT': {
				const bitName = action.payload;
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
			default:
				return state;
		}
	},

	actions: {
		setFromResponse(response: ApiResponse) {
			return { type: 'SET_FROM_RESPONSE' as const, payload: response };
		},
		toggleBit(bitName: string) {
			return { type: 'TOGGLE_BIT' as const, payload: bitName };
		},
	},

	selectors: {
		getSettings(state: SettingsStoreState): Settings {
			return state.settings;
		},
		getBits(state: SettingsStoreState): BitDescriptor[] {
			return state.bits;
		},
		isLoaded(state: SettingsStoreState): boolean {
			return state.isLoaded;
		},
	},
});

register(store);
export { store };
