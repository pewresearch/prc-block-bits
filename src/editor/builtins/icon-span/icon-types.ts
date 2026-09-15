/**
 * REST entity shapes for `root/icon` and `root/iconCollection`.
 *
 * ALLOWED_REGISTRY_COLLECTIONS must stay in lockstep with
 * Icon_Allowlist::allowed_registry_collections() (`prc`, `core`, `brands`).
 */

export interface IconRecord {
	name: string;
	label: string;
	content: string;
}

export interface IconCollectionRecord {
	slug: string;
	label: string;
}

export const ALL_COLLECTION_TAB = 'all';

export const ALLOWED_REGISTRY_COLLECTIONS: readonly string[] = [
	'prc',
	'core',
	'brands',
];
