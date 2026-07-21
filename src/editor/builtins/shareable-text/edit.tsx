/**
 * Inline editor for the `prc-block-bits/shareable-text` bit.
 *
 * Mounted by `BitsToolbarButton` (fresh insert) or `BitPopover` (re-edit on
 * an existing bit) inside a `Popover` anchored to the rich-text surface.
 *
 * Inputs: platform select; optional link text (article label); required share
 * text (pre-filled in the share dialog). The committed `innerHTML` is the
 * link label when set, otherwise the share text, so the editor preview matches
 * the frontend when `displayText` is empty.
 *
 * RTC anti-pattern note: `useState` is used here strictly for transient
 * pre-commit form state. We never mirror committed attributes from the
 * rich-text store into local state — those flow in through `attributes`
 * each render.
 */

import { __ } from '@wordpress/i18n';
import { useState, useCallback } from '@wordpress/element';
import {
	Button,
	Flex,
	FlexItem,
	SelectControl,
	TextControl,
	TextareaControl,
} from '@wordpress/components';

import type { BitEditProps } from '../../registry';

const PLATFORM_OPTIONS = [
	{ label: __('Twitter / X', 'prc-block-bits'), value: 'twitter' },
	{ label: __('Facebook', 'prc-block-bits'), value: 'facebook' },
	{ label: __('Threads', 'prc-block-bits'), value: 'threads' },
	{ label: __('Bluesky', 'prc-block-bits'), value: 'bluesky' },
];

export function ShareableTextEdit({
	bit,
	attributes,
	innerHTML,
	onCommit,
	onCancel,
}: BitEditProps): JSX.Element {
	const [shareText, setShareText] = useState<string>(
		attributes.shareText ?? innerHTML ?? ''
	);
	const [displayText, setDisplayText] = useState<string>(
		attributes.displayText ?? ''
	);
	const [platform, setPlatform] = useState<string>(
		attributes.platform ?? 'twitter'
	);

	const handleCommit = useCallback(() => {
		const trimmedShare = shareText.trim();
		const trimmedDisplay = displayText.trim();
		onCommit({
			attributes: {
				shareText: trimmedShare,
				displayText: trimmedDisplay,
				platform,
			},
			innerHTML: trimmedDisplay || trimmedShare || bit.title || '\u00A0',
		});
	}, [bit.title, displayText, shareText, platform, onCommit]);

	const isValid = shareText.trim().length > 0;

	return (
		<div
			className="prc-block-bit-shareable-text__editor"
			style={{ minWidth: 300, padding: 16, maxWidth: 400 }}
		>
			<SelectControl
				label={__('Platform', 'prc-block-bits')}
				value={platform}
				options={PLATFORM_OPTIONS}
				onChange={(next) => setPlatform(next)}
				__nextHasNoMarginBottom
			/>
			<div style={{ marginTop: 12 }}>
				<TextControl
					label={__('Link text', 'prc-block-bits')}
					value={displayText}
					onChange={setDisplayText}
					help={__(
						'The text shown in the article. Leave empty to use the share text.',
						'prc-block-bits'
					)}
					__nextHasNoMarginBottom
				/>
			</div>
			<div style={{ marginTop: 12 }}>
				<TextareaControl
					label={__('Share text', 'prc-block-bits')}
					value={shareText}
					onChange={setShareText}
					help={__(
						'The current page URL is appended automatically.',
						'prc-block-bits'
					)}
					rows={3}
					__nextHasNoMarginBottom
				/>
			</div>
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
						disabled={!isValid}
					>
						{__('Insert', 'prc-block-bits')}
					</Button>
				</FlexItem>
			</Flex>
		</div>
	);
}
