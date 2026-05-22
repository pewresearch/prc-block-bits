/**
 * Selection-anchored popover with Edit + Remove actions on an existing bit
 * (R6a). Shown only when the cursor sits on a registered `prc-block-bits/bit`
 * object format.
 *
 * Reads attributes directly from the active object (no `useState` mirror per
 * the RTC anti-patterns audit). Edit re-mount uses the
 * `removeFormat` + `insertObject` recipe per F-4. All three actions
 * (Edit-commit / Edit-cancel / Remove) emit an `aria-live="polite"`
 * announcement and return focus to the rich-text content surface so
 * keyboard / screen-reader users land back at the bit anchor (R8e).
 */

import { __, sprintf } from '@wordpress/i18n';
import { Button, Popover, Flex, FlexItem } from '@wordpress/components';
import { speak } from '@wordpress/a11y';
import { useState, useCallback, useMemo } from '@wordpress/element';
import { remove, insertObject, useAnchor } from '@wordpress/rich-text';

import { FORMAT_NAME, NAME_ATTRIBUTE } from '../format-type';
import {
	getBlockBit,
	type BitDescriptor,
	type BitEditProps,
} from '../registry';

interface PopoverProps {
	value: any;
	onChange: (next: unknown) => void;
	isObjectActive?: boolean;
	activeObjectAttributes?: Record<string, string>;
	contentRef?: { current: HTMLElement | null };
}

interface RichTextValue {
	start?: number;
	end?: number;
	replacements?: Array<
		{ type?: string; attributes?: Record<string, string> } | undefined
	>;
}

/**
 * Find the active bit at the cursor.
 *
 * For object-formats, the active replacement lives on `value.replacements`
 * at the start position. We avoid `getActiveFormat` here — that helper is
 * keyed on character-level format arrays, which don't carry replacements
 * for object formats.
 *
 * @param value Current rich-text value.
 */
function getActiveBitDescriptor(
	value: RichTextValue
): { bit: BitDescriptor; attributes: Record<string, string> } | null {
	if (!value || typeof value.start !== 'number') {
		return null;
	}
	const replacement = value.replacements?.[value.start];
	if (!replacement || replacement.type !== FORMAT_NAME) {
		return null;
	}
	const attrs = replacement.attributes ?? {};
	const name = attrs.bitName ?? attrs[NAME_ATTRIBUTE];
	if (!name) {
		return null;
	}
	const bit = getBlockBit(name);
	if (!bit) {
		return null;
	}
	return { bit, attributes: attrs };
}

export function BitPopover({
	value,
	onChange,
	isObjectActive,
	contentRef,
}: PopoverProps): JSX.Element | null {
	const [isEditing, setIsEditing] = useState(false);

	const active = useMemo(
		() =>
			isObjectActive
				? getActiveBitDescriptor(value as RichTextValue)
				: null,
		[value, isObjectActive]
	);

	const popoverAnchor = useAnchor({
		editableContentElement: contentRef?.current ?? null,
		settings: {
			name: FORMAT_NAME,
			tagName: 'span',
			className: 'prc-block-bit',
			object: true,
		} as never,
	});

	const focusContent = useCallback(() => {
		contentRef?.current?.focus();
	}, [contentRef]);

	const handleRemove = useCallback(() => {
		if (!active) return;
		const start = (value as RichTextValue).start ?? 0;
		const next = remove(value as never, start, start + 1);
		onChange(next as never);
		speak(
			sprintf(
				/* translators: %s: bit title. */
				__('%s removed', 'prc-block-bits'),
				active.bit.title
			),
			'polite'
		);
		focusContent();
	}, [active, onChange, value, focusContent]);

	const handleEditOpen = useCallback(() => {
		if (!active?.bit.edit) {
			return;
		}
		setIsEditing(true);
	}, [active]);

	const handleEditCommit = useCallback(
		(payload: {
			attributes: Record<string, string>;
			innerHTML?: string;
		}) => {
			if (!active) return;
			const start = (value as RichTextValue).start ?? 0;
			const stripped = remove(value as never, start, start + 1);
			const mergedAttrs: Record<string, string> = {
				...active.attributes,
				...payload.attributes,
				bitName: active.bit.name,
			};
			// See `bits-toolbar-button.tsx` — empty innerHTML + format-type
			// `contentEditable: false` causes `@wordpress/rich-text` to drop
			// the format on save. Falsy-coalesce always yields something
			// serializable.
			const innerHTML =
				payload.innerHTML ||
				active.bit.defaultText ||
				active.bit.title ||
				'\u00A0';
			const next = insertObject(
				stripped as never,
				{
					type: FORMAT_NAME,
					attributes: mergedAttrs,
					innerHTML,
				} as never
			);
			onChange(next as never);
			speak(
				sprintf(
					/* translators: %s: bit title. */
					__('%s attributes updated', 'prc-block-bits'),
					active.bit.title
				),
				'polite'
			);
			setIsEditing(false);
			focusContent();
		},
		[active, onChange, value, focusContent]
	);

	const handleEditCancel = useCallback(() => {
		setIsEditing(false);
		focusContent();
	}, [focusContent]);

	if (!active) {
		return null;
	}

	const EditComponent = active.bit.edit ?? null;

	if (isEditing && EditComponent) {
		const editProps: BitEditProps = {
			bit: active.bit,
			attributes: active.attributes,
			innerHTML: active.bit.defaultText ?? '',
			onCommit: handleEditCommit,
			onCancel: handleEditCancel,
		};
		return (
			<Popover
				anchor={popoverAnchor}
				onClose={handleEditCancel}
				placement="bottom"
				focusOnMount="firstElement"
			>
				<EditComponent {...editProps} />
			</Popover>
		);
	}

	return (
		<Popover anchor={popoverAnchor} placement="bottom" focusOnMount={false}>
			<Flex
				gap={2}
				justify="flex-start"
				className="prc-block-bits__bit-popover"
			>
				{EditComponent ? (
					<FlexItem>
						<Button
							size="compact"
							variant="tertiary"
							onClick={handleEditOpen}
						>
							{__('Edit', 'prc-block-bits')}
						</Button>
					</FlexItem>
				) : null}
				<FlexItem>
					<Button
						size="compact"
						variant="tertiary"
						isDestructive
						onClick={handleRemove}
					>
						{__('Remove', 'prc-block-bits')}
					</Button>
				</FlexItem>
			</Flex>
		</Popover>
	);
}
