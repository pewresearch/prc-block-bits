/**
 * Inline editor for the `prc-block-bits/icon-span` bit.
 *
 * Mounted by `BitsToolbarButton` (fresh insert) or `BitPopover` (edit
 * existing) inside a `Popover` anchored to the rich-text surface. Wraps
 * `IconPicker` from `@prc/components` and an `Insert` / `Cancel` action
 * pair. Per the v1 picker UI, the position toggle is hidden
 * (`showPosition={false}`); `iconPosition` survives in the saved
 * attributes for forward-compat with `core/button`'s rendering pipeline.
 *
 * RTC anti-pattern note: `useState` is used here strictly for transient
 * pre-commit picker state. We never mirror committed attributes from the
 * rich-text store into local state — those flow in through `attributes`
 * each render.
 */

import { __ } from '@wordpress/i18n';
import { useState, useCallback } from '@wordpress/element';
import { Button, Flex, FlexItem } from '@wordpress/components';
import { IconPicker } from '@prc/components';

import type { BitEditProps } from '../../registry';

interface PickerChange {
	library?: string;
	icon?: string;
	position?: 'left' | 'right';
}

export function IconSpanEdit({
	attributes,
	onCommit,
	onCancel,
}: BitEditProps): JSX.Element {
	const [library, setLibrary] = useState<string>(
		attributes.iconLibrary || 'solid'
	);
	const [iconName, setIconName] = useState<string>(attributes.iconName || '');
	const iconColor = attributes.iconColor || '';
	const iconPosition = attributes.iconPosition === 'left' ? 'left' : 'right';

	const handleChange = useCallback((next: PickerChange) => {
		if (typeof next.library === 'string') {
			setLibrary(next.library);
			setIconName('');
		}
		if (typeof next.icon === 'string') {
			setIconName(next.icon);
		}
	}, []);

	const handleCommit = useCallback(() => {
		if (!iconName) {
			return;
		}
		// '%icon%' is a stable, opaque placeholder. It is non-empty so the
		// rich-text format survives `to-tree` serialization (which silently
		// drops `contentEditable: false` formats with empty innerHTML at save
		// time). The PHP walker's callback strategy replaces the entire outer
		// span with the rendered icon SVG, so `%icon%` never reaches the
		// frontend. A MutationObserver in `preview.ts` injects the live sprite
		// preview into the editor DOM without touching this saved value.
		onCommit({
			attributes: {
				iconLibrary: library,
				iconName,
				iconColor,
				iconPosition,
			},
			innerHTML: '%icon%',
		});
	}, [iconName, library, iconColor, iconPosition, onCommit]);

	return (
		<div
			className="prc-block-bit-icon-span__editor"
			style={{ minWidth: 320, padding: 16, maxWidth: 360 }}
		>
			<IconPicker
				library={library}
				icon={iconName || undefined}
				showPosition={false}
				onChange={handleChange}
			/>
			<Flex justify="flex-end" gap={2} style={{ marginTop: 12 }}>
				<FlexItem>
					<Button variant="tertiary" onClick={onCancel}>
						{__('Cancel', 'prc-block-bits')}
					</Button>
				</FlexItem>
				<FlexItem>
					<Button
						variant="primary"
						onClick={handleCommit}
						disabled={!iconName}
					>
						{__('Insert icon', 'prc-block-bits')}
					</Button>
				</FlexItem>
			</Flex>
		</div>
	);
}
