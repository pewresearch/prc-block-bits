/**
 * Editor canvas preview helpers for icon-span.
 *
 * `prc`, `brands`, and `core` prefer the WordPress `root/icon` registry.
 * Fill-sheet URLs remain only for the fetch-and-inline fallback (never an
 * external `<use href>` in the editor canvas iframe).
 *
 * Fill sheets (`prc.svg`, `brands.svg`) live at `…/build/icons/`.
 * `window.prcBlockBits.iconSpritesUrl` is `PRC_PLATFORM_ICONS_URL` (that
 * directory). A trailing `sprites/` is stripped only for older payloads.
 */

import { ALLOWED_REGISTRY_COLLECTIONS } from './icon-types';

export const CORE_REGISTRY_COLLECTION = 'core';

export interface PreviewSpriteSource {
	kind: 'prc' | 'brands' | 'missing';
	spriteLibrary: string;
	icon: string;
}

export interface FillSheetPreviewRef {
	sheetUrl: string;
	symbolId: string;
}

export interface IconIdentity {
	collection: string;
	glyph: string;
	namespaced: boolean;
}

/**
 * Parent of the sprite directory (`…/build/icons/`).
 *
 * @param spritesBase Localized `iconSpritesUrl` (`…/build/icons/` today;
 *                    older payloads may still end in `sprites/`).
 */
export function getIconFillsBase(spritesBase: string): string {
	const normalized = spritesBase.endsWith('/')
		? spritesBase
		: `${spritesBase}/`;
	if (normalized.endsWith('sprites/')) {
		return normalized.slice(0, -'sprites/'.length);
	}
	return normalized;
}

export function normalizeSpritesBase(spritesBase: string): string {
	return spritesBase.endsWith('/') ? spritesBase : `${spritesBase}/`;
}

/**
 * Split `data-icon-name` / `data-icon-library` into a collection + glyph.
 *
 * Namespaced values (`prc/card`, `core/plus`) win over the library attr.
 * Unnamespaced names use the library, defaulting to `prc` to match PHP.
 *
 * @param iconName    Glyph or `collection/name` registry key.
 * @param iconLibrary `data-icon-library` value, or null when the attr is absent.
 */
export function parseIconIdentity(
	iconName: string,
	iconLibrary: string | null
): IconIdentity {
	const slash = iconName.indexOf('/');
	if (slash > 0) {
		return {
			collection: iconName.slice(0, slash),
			glyph: iconName.slice(slash + 1),
			namespaced: true,
		};
	}
	const collection = iconLibrary && iconLibrary !== '' ? iconLibrary : 'prc';
	return {
		collection,
		glyph: iconName,
		namespaced: false,
	};
}

export function isRegistryPreviewCollection(collection: string): boolean {
	return ALLOWED_REGISTRY_COLLECTIONS.includes(collection);
}

export function registryIconName(identity: IconIdentity): string {
	return `${identity.collection}/${identity.glyph}`;
}

/**
 * Fragment URL for a fill-sheet fetch (sheet + `#` + symbol id).
 *
 * Used only to split a fetch-inline ref. Do not inject this as
 * `<use href>` in the editor canvas.
 *
 * @param spritesBase Localized fill-sheet directory URL.
 * @param source      Kind, library slug, and resolved icon name.
 */
export function getPreviewUseHref(
	spritesBase: string,
	source: PreviewSpriteSource
): string {
	const fillsBase = getIconFillsBase(normalizeSpritesBase(spritesBase));
	switch (source.kind) {
		case 'prc':
			return `${fillsBase}prc.svg#${source.icon}`;
		case 'brands':
			return `${fillsBase}brands.svg#${source.icon}`;
		case 'missing':
			return '';
		default: {
			const exhaustive: never = source.kind;
			return exhaustive;
		}
	}
}

/**
 * Sheet URL + symbol id for the fetch-inline fallback.
 *
 * @param spritesBase Localized fill-sheet directory URL.
 * @param source      Kind, library slug, and resolved icon name.
 */
export function getFillSheetPreviewRef(
	spritesBase: string,
	source: PreviewSpriteSource
): FillSheetPreviewRef | null {
	const href = getPreviewUseHref(spritesBase, source);
	if (!href) {
		return null;
	}
	const hash = href.lastIndexOf('#');
	if (hash <= 0 || hash === href.length - 1) {
		return null;
	}
	return {
		sheetUrl: href.slice(0, hash),
		symbolId: href.slice(hash + 1),
	};
}

/**
 * Pull a `<symbol>` out of a fill sheet for inlining.
 *
 * @param sheetText Fill-sheet SVG text.
 * @param symbolId  Symbol `id` (resolved icon name).
 */
export function extractFillSymbol(
	sheetText: string,
	symbolId: string
): Element | null {
	if (!sheetText || !symbolId || typeof DOMParser === 'undefined') {
		return null;
	}
	const doc = new DOMParser().parseFromString(sheetText, 'image/svg+xml');
	const byId = doc.getElementById(symbolId);
	if (byId) {
		return byId;
	}
	const escaped =
		typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
			? CSS.escape(symbolId)
			: symbolId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return doc.querySelector(`[id="${escaped}"]`);
}
