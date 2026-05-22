/**
 * Editor entry for `prc-block-bits`.
 *
 * Boot order:
 *
 * 1. Side-effect imports from `./registry` and `./toolbar` evaluate, so
 *    builtin bit registrations (U5/U6) — when imported here in later units —
 *    have run their `registerBlockBit` overlays.
 * 2. `hydrateFromWindow()` pulls the PHP-projected bits off
 *    `window.prcBlockBits.bits` into the module-level Map.
 * 3. `registerBitFormatType()` snapshots the union of all per-bit `data-*`
 *    attribute keys and registers the single shared rich-text format type.
 *
 * Per the plan's "Open Questions / Resolved" — no `@wordpress/data` store,
 * no auto-opening popovers on insertion. The format type's editor surface
 * (toolbar + popover) is the only entry point for v1.
 */

import { hydrateFromWindow } from './registry';
import { registerBitFormatType } from './format-type';
import { registerIconSpanBit } from './builtins/icon-span/register';
import { initIconSpanEditorPreview } from './builtins/icon-span/preview';
import { registerCopyrightBit } from './builtins/copyright/register';
import { registerShareableTextBit } from './builtins/shareable-text/register';
import '../style/editor.scss';

hydrateFromWindow();
registerIconSpanBit();
registerCopyrightBit();
registerShareableTextBit();
registerBitFormatType();
// Inject sprite-reference SVG previews into icon-span bits in the editor DOM.
// Must run after registerBitFormatType() so the format is registered before
// the observer fires.
initIconSpanEditorPreview();

export {
	registerBlockBit,
	getBlockBit,
	getAllBlockBits,
	getBitsApplicableTo,
} from './registry';
export type {
	BitDescriptor,
	BitEditProps,
	BitAttributeSchema,
} from './registry';
