import { postContent } from '@wordpress/icons';

import type { BitDescriptor } from '../registry';

/**
 * Resolve a bit's display icon. Editor-supplied component takes priority;
 * falls back to the generic `postContent` icon.
 *
 * @param bit Bit descriptor.
 */
export function resolveBitIcon(bit: BitDescriptor): unknown {
	return bit.icon ?? postContent;
}
