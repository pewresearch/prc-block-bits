export interface BitDescriptor {
	name: string;
	label: string;
	category: string | null;
}

export interface Settings {
	disabled_bits: string[];
}

export interface ApiResponse {
	settings: Settings;
	bits: BitDescriptor[];
}

export interface SettingsStoreState {
	settings: Settings;
	bits: BitDescriptor[];
	isLoaded: boolean;
}
