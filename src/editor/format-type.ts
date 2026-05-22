/**
 * Single shared rich-text format type for all bits.
 *
 * Per the plan's F-3 clarification: one format type, attributes include the
 * discriminator (`data-prc-block-bit`) plus the union of every registered
 * bit's per-attribute `data-*` keys. Serialization is permissive at this
 * level; per-bit validation is strict at the PHP registry level.
 *
 * `object: true` enforces R6 — insertion replaces the selection rather than
 * wrapping. The placeholder character stores `innerHTML` (the bit's
 * `default_text`) so the saved markup is
 *
 *   <span class="prc-block-bit" data-prc-block-bit="…" data-…="…">DEFAULT_TEXT</span>
 *
 * which doubles as the cross-context fallback per R10a.
 */

import { registerFormatType } from '@wordpress/rich-text';
import { __ } from '@wordpress/i18n';
import { createElement, Fragment } from '@wordpress/element';

import { BitsToolbarButton } from './toolbar/bits-toolbar-button';
import { BitPopover } from './toolbar/bit-popover';
import { getAllBlockBits } from './registry';

export const FORMAT_NAME = 'prc-block-bits/bit';
export const FORMAT_CLASS = 'prc-block-bit';
export const NAME_ATTRIBUTE = 'data-prc-block-bit';

function camelToKebab(key: string): string {
	return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Build the union of registered `data-*` attribute keys at format-type
 * registration time. Hydrate must fire first so the server projection is in
 * the registry.
 */
function buildAttributesMap(): Record<string, string> {
	const map: Record<string, string> = {
		bitName: NAME_ATTRIBUTE,
	};
	for (const bit of getAllBlockBits()) {
		for (const attrKey of Object.keys(bit.attributes ?? {})) {
			if (!map[attrKey]) {
				map[attrKey] = `data-${camelToKebab(attrKey)}`;
			}
		}
	}
	return map;
}

/**
 * Register the shared `prc-block-bits/bit` format type.
 *
 * Idempotent in spirit, but `registerFormatType` itself is not — call this
 * exactly once, after `hydrateFromWindow()`.
 */
export function registerBitFormatType(): void {
	// The `WPFormat` type from `@wordpress/rich-text` predates the
	// `object` / `contentEditable` fields the runtime honors (see
	// `to-tree.mjs`), so we widen via `unknown` rather than annotate.
	const settings: unknown = {
		name: FORMAT_NAME,
		title: __('Dynamic content', 'prc-block-bits'),
		tagName: 'span',
		className: FORMAT_CLASS,
		// R6 (insert/replace, never wrap) is enforced by calling
		// `insertObject()` in the toolbar button — NOT by setting
		// `object: true` on the format type. Setting `object: true` here
		// causes `to-html-string`'s `createElementHTML` to emit a void-style
		// opening tag (`<span ...>`) with no children and no close, even
		// when `contentEditable: false` supplies `innerHTML`. The result is
		// post_content like `<p>before <span ...></p><p>after</p>` which
		// the WP HTML processor then mis-balances on render, swallowing
		// every sibling node up to the next implicit boundary. Core's
		// `core/footnote` format uses exactly this pattern (see
		// `@wordpress/block-library/src/footnotes/format.js`) without
		// `object: true` — `insertObject` handles replacement semantics
		// on its own.
		//
		// `contentEditable: false` lets rich-text render the bit's
		// `innerHTML` (server-projected `default_text`) inside the span as
		// a non-editable inline atom. Combined with `insertObject`, this
		// gives us `<span ...>INNER_HTML</span>` on serialize — a properly
		// closed element with the cross-context fallback intact per R10a.
		contentEditable: false,
		attributes: buildAttributesMap(),
		edit: (props: unknown) =>
			createElement(
				Fragment,
				null,
				createElement(BitsToolbarButton, props as never),
				createElement(BitPopover, props as never)
			),
	};

	registerFormatType(
		FORMAT_NAME,
		settings as Parameters<typeof registerFormatType>[1]
	);
}
