/**
 * Inline editor for the `prc-block-bits/icon-span` bit.
 *
 * Mounted by `BitsToolbarButton` (fresh insert) or `BitPopover` (edit
 * existing) inside a `Popover` anchored to the rich-text surface. Opens
 * Gutenberg's registry icon modal (copied until #76787 exports one). Per
 * the v1 picker UI, `iconPosition` survives in the saved attributes for
 * forward-compat with `core/button`'s rendering pipeline.
 *
 * RTC anti-pattern note: `useState` is used here strictly for transient
 * pre-commit picker state. We never mirror committed attributes from the
 * rich-text store into local state — those flow in through `attributes`
 * each render.
 */

import { __ } from '@wordpress/i18n';
import { useState, useCallback, RawHTML } from '@wordpress/element';
import { Button, Flex, FlexItem } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';

import type { BitEditProps } from '../../registry';
import { IconPickerModal } from './icon-picker-modal';
import type { IconRecord } from './icon-types';

function registryValue(iconName: string): string {
	return iconName.includes('/') ? iconName : '';
}

export function IconSpanEdit({
	attributes,
	onCommit,
	onCancel,
}: BitEditProps): JSX.Element {
	const [library, setLibrary] = useState<string>(
		attributes.iconLibrary || 'prc'
	);
	const [iconName, setIconName] = useState<string>(attributes.iconName || '');
	const [isModalOpen, setModalOpen] = useState(false);
	const iconColor = attributes.iconColor || '';
	const iconPosition = attributes.iconPosition === 'left' ? 'left' : 'right';
	const selectedName = registryValue(iconName) || iconName;

	const selectedIcon = useSelect(
		(select) => {
			const name = registryValue(iconName);
			if (!name) {
				return null;
			}
			return (
				(select(coreStore).getEntityRecord(
					'root',
					'icon',
					name
				) as IconRecord | null) ?? null
			);
		},
		[iconName]
	);

	const handleSelect = useCallback((name: string) => {
		setIconName(name);
		const slash = name.indexOf('/');
		if (slash > 0) {
			setLibrary(name.slice(0, slash));
		}
		setModalOpen(false);
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
		// frontend. `preview.ts` inlines a live SVG preview into the editor
		// DOM without touching this saved value.
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
			style={{ minWidth: 280, padding: 16, maxWidth: 360 }}
		>
			{selectedIcon?.content ? (
				<div className="prc-block-bit-icon-span__preview">
					<RawHTML>{selectedIcon.content}</RawHTML>
					<p>{selectedIcon.label}</p>
				</div>
			) : (
				<p>
					{iconName
						? iconName
						: __('No icon selected.', 'prc-block-bits')}
				</p>
			)}
			<Button
				variant="secondary"
				__next40pxDefaultSize
				onClick={() => setModalOpen(true)}
				style={{ marginBottom: 12 }}
			>
				{iconName
					? __('Replace icon', 'prc-block-bits')
					: __('Choose icon', 'prc-block-bits')}
			</Button>
			{isModalOpen && (
				<IconPickerModal
					onClose={() => setModalOpen(false)}
					value={selectedName}
					onChange={handleSelect}
				/>
			)}
			<Flex justify="flex-end" gap={2} style={{ marginTop: 12 }}>
				<FlexItem>
					<Button
						variant="tertiary"
						__next40pxDefaultSize
						onClick={onCancel}
					>
						{__('Cancel', 'prc-block-bits')}
					</Button>
				</FlexItem>
				<FlexItem>
					<Button
						variant="primary"
						__next40pxDefaultSize
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
