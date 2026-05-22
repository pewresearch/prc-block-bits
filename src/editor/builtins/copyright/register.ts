/**
 * Editor-side overlay for the `prc-block-bits/copyright` bit.
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

import { info } from '@wordpress/icons';

import { registerBlockBit } from '../../registry';
import { CopyrightEdit } from './edit';

export const COPYRIGHT_BIT_NAME = 'prc-block-bits/copyright';

export function registerCopyrightBit(): void {
	registerBlockBit(COPYRIGHT_BIT_NAME, {
		icon: info,
		edit: CopyrightEdit,
	});
}
