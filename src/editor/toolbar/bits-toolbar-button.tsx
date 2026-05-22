/**
 * Single rich-text toolbar button + dropdown of applicable bits.
 *
 * Reads the selected block's name from `blockEditorStore`, queries
 * `getBitsApplicableTo(blockName)`, and renders one menu item per applicable
 * bit. On click:
 *
 * - if the bit declares an `edit` component (attribute-bearing — e.g.
 *   `icon-span` in U5), open a Popover and mount it. On commit it calls
 *   `insertObject` with the user-supplied attributes.
 * - if the bit has no `edit` component (state-driven, e.g. PT-2026's
 *   `selectedGroupName`), call `insertObject` immediately with the bit's
 *   default attribute payload + `defaultText` as `innerHTML`.
 *
 * No auto-open of the BitPopover — per the RTC anti-patterns audit.
 */

import { __, sprintf } from '@wordpress/i18n';
import { useSelect } from '@wordpress/data';
import {
	RichTextToolbarButton,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { MenuGroup, MenuItem, Popover } from '@wordpress/components';
import { plus } from '@wordpress/icons';
import { speak } from '@wordpress/a11y';
import { insertObject, useAnchor } from '@wordpress/rich-text';
import { useState, useCallback, useMemo } from '@wordpress/element';

import { FORMAT_NAME } from '../format-type';
import {
	getBitsApplicableTo,
	getBitsGroupedByCategory,
	type BitDescriptor,
	type BitEditProps,
} from '../registry';
import { BitsPickerModal } from './bits-picker-modal';
import { resolveBitIcon } from './resolve-bit-icon';

/**
 * When the number of applicable bits exceeds this threshold the toolbar button
 * opens a Modal instead of the inline Popover, enabling category grouping for
 * larger registries.
 */
const MODAL_THRESHOLD = 5;

interface ToolbarProps {
	value: unknown;
	onChange: (next: unknown) => void;
	isObjectActive?: boolean;
	contentRef?: { current: HTMLElement | null };
}

interface InsertPayload {
	attributes: Record<string, string>;
	innerHTML?: string;
}

function buildInsertAttributes(
	bit: BitDescriptor,
	override: Record<string, string> = {}
): Record<string, string> {
	const attrs: Record<string, string> = { bitName: bit.name };
	for (const [key, def] of Object.entries(bit.attributes ?? {})) {
		if (
			def &&
			'default' in def &&
			def.default !== undefined &&
			def.default !== null
		) {
			attrs[key] = String(def.default);
		}
	}
	for (const [key, val] of Object.entries(override)) {
		attrs[key] = val;
	}
	return attrs;
}

export function BitsToolbarButton({
	value,
	onChange,
	isObjectActive,
	contentRef,
}: ToolbarProps): JSX.Element | null {
	const blockName = useSelect(
		(select) =>
			(
				select(blockEditorStore) as {
					getSelectedBlock: () => { name: string } | null;
				}
			).getSelectedBlock()?.name ?? null,
		[]
	);

	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [editingBit, setEditingBit] = useState<BitDescriptor | null>(null);

	const applicable = useMemo<BitDescriptor[]>(
		() => (blockName ? getBitsApplicableTo(blockName) : []),
		[blockName]
	);

	const useModal = applicable.length > MODAL_THRESHOLD;

	const bitGroups = useMemo(
		() =>
			useModal && blockName ? getBitsGroupedByCategory(blockName) : null,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[blockName, useModal]
	);

	// Anchor the menu Popover to the active rich-text region, matching the
	// pattern used by core's text-color and link formats. Avoids the empty
	// `div.components-dropdown` wrapper that `<Dropdown>` would otherwise
	// leave in the editable tree once `RichTextToolbarButton` slots its
	// button up to the format toolbar.
	const popoverAnchor = useAnchor({
		editableContentElement: contentRef?.current ?? null,
		settings: {
			name: FORMAT_NAME,
			tagName: 'span',
			className: 'prc-block-bit',
		} as never,
	} as never);

	const insertBit = useCallback(
		(bit: BitDescriptor, payload: InsertPayload = { attributes: {} }) => {
			const attrs = buildInsertAttributes(bit, payload.attributes);
			// Empty `innerHTML` causes `@wordpress/rich-text`'s `to-tree` to
			// silently drop object formats whose `formatType.contentEditable
			// === false` at save time (the `if ( innerHTML || isEditableTree )`
			// branch in `to-tree.js`). Falsy-coalesce ensures we always carry
			// something serializable; per-bit `edit` components should pass
			// rich preview HTML so authors see what they inserted.
			const innerHTML =
				payload.innerHTML || bit.defaultText || bit.title || '\u00A0';
			const next = insertObject(
				value as never,
				{
					type: FORMAT_NAME,
					attributes: attrs,
					innerHTML,
				} as never
			);
			onChange(next as never);
			speak(
				sprintf(
					/* translators: %s: bit title. */
					__('%s inserted', 'prc-block-bits'),
					bit.title
				),
				'polite'
			);
		},
		[onChange, value]
	);

	const handleMenuToggle = useCallback(() => {
		setIsMenuOpen((open) => !open);
	}, []);

	const handleMenuClose = useCallback(() => {
		setIsMenuOpen(false);
	}, []);

	const handlePick = useCallback(
		(bit: BitDescriptor) => {
			setIsMenuOpen(false);
			if (bit.edit) {
				setEditingBit(bit);
				return;
			}
			insertBit(bit);
		},
		[insertBit]
	);

	const handleEditCommit = useCallback(
		(bit: BitDescriptor, payload: InsertPayload) => {
			insertBit(bit, payload);
			setEditingBit(null);
		},
		[insertBit]
	);

	const handleEditCancel = useCallback(() => {
		setEditingBit(null);
	}, []);

	if (!blockName || applicable.length === 0) {
		return null;
	}

	const editProps: BitEditProps | null = editingBit
		? {
				bit: editingBit,
				attributes: buildInsertAttributes(editingBit),
				innerHTML: editingBit.defaultText ?? '',
				onCommit: (payload) => handleEditCommit(editingBit, payload),
				onCancel: handleEditCancel,
			}
		: null;

	const EditComponent = editingBit?.edit ?? null;

	return (
		<>
			<RichTextToolbarButton
				icon={plus}
				title={__('Insert dynamic content', 'prc-block-bits')}
				onClick={handleMenuToggle}
				isActive={!!isObjectActive}
				aria-label={__('Insert dynamic content', 'prc-block-bits')}
				aria-expanded={isMenuOpen}
				aria-haspopup="true"
			/>
			{isMenuOpen && useModal && bitGroups ? (
				<BitsPickerModal
					groups={bitGroups}
					onPick={handlePick}
					onClose={handleMenuClose}
				/>
			) : null}
			{isMenuOpen && !useModal ? (
				<Popover
					anchor={popoverAnchor}
					placement="bottom-start"
					onClose={handleMenuClose}
					onFocusOutside={handleMenuClose}
				>
					<MenuGroup label={__('Bits', 'prc-block-bits')}>
						{applicable.map((bit) => (
							<MenuItem
								key={bit.name}
								icon={resolveBitIcon(bit) as never}
								onClick={() => handlePick(bit)}
							>
								{bit.title}
							</MenuItem>
						))}
					</MenuGroup>
				</Popover>
			) : null}
			{EditComponent && editProps ? (
				<Popover
					anchor={popoverAnchor}
					placement="bottom-start"
					onClose={handleEditCancel}
					focusOnMount="firstElement"
				>
					<EditComponent {...editProps} />
				</Popover>
			) : null}
		</>
	);
}
