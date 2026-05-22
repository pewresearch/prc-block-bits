import type { ReactNode } from 'react';

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

export interface SettingsAccordionProps {
	title: string;
	description: string;
	children: ReactNode;
	contentId?: string;
	headingId?: string;
	descriptionId?: string;
}
