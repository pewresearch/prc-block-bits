/**
 * Editor-side overlay for the `prc-block-bits/shareable-text` bit.
 *
 * The PHP-side registration projects label / allowedBlockTypes /
 * attributes / defaultText onto `window.prcBlockBits.bits` for hydration.
 * This module attaches the editor-only descriptors (`icon`, `title`, `edit`)
 * on top of that projection via `registerBlockBit()`.
 *
 * Exposed as a function rather than a side-effect so the editor entry can
 * sequence the call after `hydrateFromWindow()` — registry merge logic
 * preserves `icon`/`edit` either way, but invocation order matches the
 * documented boot sequence.
 */

import { __ } from '@wordpress/i18n';
import { share } from '@wordpress/icons';

import { registerBlockBit } from '../../registry';
import { ShareableTextEdit } from './edit';

export const SHAREABLE_TEXT_BIT_NAME = 'prc-block-bits/shareable-text';

export function registerShareableTextBit(): void {
	registerBlockBit(SHAREABLE_TEXT_BIT_NAME, {
		title: __('Shareable Text', 'prc-block-bits'),
		icon: share,
		edit: ShareableTextEdit,
	});
}
