/**
 * Modal bit picker — shown when `applicable.length > MODAL_THRESHOLD`.
 *
 * Renders a `@wordpress/components` Modal with one `MenuGroup` per category.
 * Bits without a declared `category` are grouped under "General" (appended
 * last). Picking a bit calls the same `onPick` handler as the inline Popover
 * path, so `insertBit` / `setEditingBit` behaviour is identical.
 */

import { __ } from '@wordpress/i18n';
import {
	Modal,
	MenuGroup,
	MenuItem,
	SearchControl,
} from '@wordpress/components';
import { useState, useMemo, useEffect } from '@wordpress/element';

import type { BitDescriptor } from '../registry';
import { filterBitGroups } from './filter-bit-groups';
import { resolveBitIcon } from './resolve-bit-icon';

interface BitsPickerModalProps {
	/** Bits grouped by category (ordered Map). */
	groups: Map<string, BitDescriptor[]>;
	onPick: (bit: BitDescriptor) => void;
	onClose: () => void;
}

export function BitsPickerModal({
	groups,
	onPick,
	onClose,
}: BitsPickerModalProps): JSX.Element {
	const [searchQuery, setSearchQuery] = useState('');

	useEffect(
		() => () => {
			setSearchQuery('');
		},
		[]
	);

	const filteredGroups = useMemo(
		() => filterBitGroups(groups, searchQuery),
		[groups, searchQuery]
	);

	const handleClose = () => {
		setSearchQuery('');
		onClose();
	};

	const hasResults = filteredGroups.size > 0;

	return (
		<Modal
			title={__('Insert dynamic content', 'prc-block-bits')}
			onRequestClose={handleClose}
			className="prc-block-bits-modal"
			size="medium"
		>
			<div className="prc-block-bits-modal__search">
				<SearchControl
					__nextHasNoMarginBottom
					label={__('Search bits', 'prc-block-bits')}
					placeholder={__('Search', 'prc-block-bits')}
					value={searchQuery}
					onChange={setSearchQuery}
				/>
			</div>
			{hasResults ? (
				<div className="prc-block-bits-modal__groups">
					{Array.from(filteredGroups.entries()).map(
						([category, bits]) => (
							<MenuGroup
								key={category}
								label={category}
								className="prc-block-bits-modal__group"
							>
								{bits.map((bit) => (
									<MenuItem
										key={bit.name}
										icon={resolveBitIcon(bit) as never}
										onClick={() => onPick(bit)}
									>
										{bit.title}
									</MenuItem>
								))}
							</MenuGroup>
						)
					)}
				</div>
			) : (
				<p className="prc-block-bits-modal__empty">
					{__('No bits match your search.', 'prc-block-bits')}
				</p>
			)}
		</Modal>
	);
}
