/**
 * Editor-side overlay for the `prc-block-bits/icon-span` bit.
 *
 * The PHP-side registration projects label / allowedBlockTypes /
 * attributes / defaultText onto `window.prcBlockBits.bits` for hydration.
 * This module attaches the editor-only descriptors (`icon`, `edit`) on
 * top of that projection via `registerBlockBit()`.
 *
 * Exposed as a function rather than a side-effect so the editor entry can
 * sequence the call after `hydrateFromWindow()` — registry merge logic
 * preserves `icon`/`edit` either way, but invocation order matches the
 * documented boot sequence.
 */

import { image } from '@wordpress/icons';

import { registerBlockBit } from '../../registry';
import { IconSpanEdit } from './edit';

export const ICON_SPAN_BIT_NAME = 'prc-block-bits/icon-span';

export function registerIconSpanBit(): void {
	registerBlockBit(ICON_SPAN_BIT_NAME, {
		icon: image,
		edit: IconSpanEdit,
	});
}
