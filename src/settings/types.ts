export interface BitDescriptor {
	name: string;
	label: string;
	category: string | null;
}

/**
 * Form-friendly settings shape for DataForm boolean fields.
 * Persisted to wp_options as `{ disabled_bits: string[] }` via getSaveData.
 */
export interface Settings {
	bit_enabled: Record<string, boolean>;
}

/** Payload posted to / returned from the REST settings endpoint. */
export interface PersistableSettings {
	disabled_bits: string[];
}

export interface ApiResponse {
	settings: PersistableSettings;
	bits: BitDescriptor[];
}

export interface SettingsStoreState {
	settings: Settings;
	bits: BitDescriptor[];
	/** Disabled bit names not in the current registry (preserved on save). */
	orphanDisabledBits: string[];
	isLoaded: boolean;
}
