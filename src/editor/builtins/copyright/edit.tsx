/**
 * Inline editor for the `prc-block-bits/copyright` bit.
 *
 * Mounted by `BitsToolbarButton` (fresh insert) or `BitPopover` (edit
 * existing) inside a `Popover` anchored to the rich-text surface. Two
 * inputs — `startYear` (optional numeric — empty means "no range") and
 * `holder` (optional text — empty falls back to "Pew Research Center" at
 * render time) — plus an Insert / Cancel action pair.
 *
 * The committed `innerHTML` carries an editor-time preview string
 * (`© YYYY <holder>`) so authors see what they inserted AND so the
 * format survives `@wordpress/rich-text`'s `to-tree` serialization
 * (which drops `contentEditable: false` object formats whose innerHTML
 * is empty). PHP's render callback rebuilds the span outer HTML at
 * request time using `gmdate( 'Y' )` and the saved attributes, so the
 * editor preview's year only matters until next render — drift between
 * editor and final HTML is corrected automatically.
 *
 * RTC anti-pattern note: `useState` is used here strictly for transient
 * pre-commit form state. We never mirror committed attributes from the
 * rich-text store into local state — those flow in through `attributes`
 * each render.
 */

import { __ } from '@wordpress/i18n';
import { useState, useCallback } from '@wordpress/element';
import { Button, Flex, FlexItem, TextControl } from '@wordpress/components';

import type { BitEditProps } from '../../registry';

const DEFAULT_HOLDER = 'Pew Research Center';

function normalizeStartYearForCommit(raw: string): string {
	const trimmed = raw.trim();
	if ('' === trimmed) {
		return '0';
	}
	const parsed = Number.parseInt(trimmed, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return '0';
	}
	return String(parsed);
}

function escapeHtml(input: string): string {
	return input
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/**
 * Compute the editor-time preview string. Mirrors PHP's
 * `Bits\Copyright::render()` logic exactly so the editor preview matches
 * the rendered output until midnight UTC on the next year boundary.
 */
function buildCopyrightPreviewHTML(
	startYearRaw: string,
	holderRaw: string
): string {
	const currentYear = new Date().getUTCFullYear();
	const trimmedStart = startYearRaw.trim();
	const startYear = Number.parseInt(trimmedStart, 10);
	const yearText =
		Number.isFinite(startYear) && startYear > 0 && startYear < currentYear
			? `${startYear} - ${currentYear}`
			: `${currentYear}`;
	const trimmedHolder = holderRaw.trim();
	const holder = '' !== trimmedHolder ? trimmedHolder : DEFAULT_HOLDER;
	return `© ${yearText} ${escapeHtml(holder)}`;
}

export function CopyrightEdit({
	attributes,
	onCommit,
	onCancel,
}: BitEditProps): JSX.Element {
	const initialStartYear =
		attributes.startYear && attributes.startYear !== '0'
			? attributes.startYear
			: '';
	const initialHolder = attributes.holder ?? '';

	const [startYear, setStartYear] = useState<string>(initialStartYear);
	const [holder, setHolder] = useState<string>(initialHolder);

	const handleCommit = useCallback(() => {
		onCommit({
			attributes: {
				startYear: normalizeStartYearForCommit(startYear),
				holder: holder.trim(),
			},
			innerHTML: buildCopyrightPreviewHTML(startYear, holder),
		});
	}, [startYear, holder, onCommit]);

	return (
		<div
			className="prc-block-bit-copyright__editor"
			style={{ minWidth: 280, padding: 16, maxWidth: 360 }}
		>
			<TextControl
				label={__('Start year (optional)', 'prc-block-bits')}
				type="number"
				value={startYear}
				onChange={setStartYear}
				help={__(
					'When set to a past year, the copyright renders as a range (e.g. 2018 – 2026). Leave blank for the current year only.',
					'prc-block-bits'
				)}
				min={1900}
				step={1}
				__nextHasNoMarginBottom
			/>
			<TextControl
				label={__('Copyright holder (optional)', 'prc-block-bits')}
				value={holder}
				onChange={setHolder}
				help={__(
					'Defaults to "Pew Research Center" when left blank.',
					'prc-block-bits'
				)}
				__nextHasNoMarginBottom
			/>
			<Flex justify="flex-end" gap={2} style={{ marginTop: 12 }}>
				<FlexItem>
					<Button variant="tertiary" onClick={onCancel}>
						{__('Cancel', 'prc-block-bits')}
					</Button>
				</FlexItem>
				<FlexItem>
					<Button variant="primary" onClick={handleCommit}>
						{__('Insert copyright', 'prc-block-bits')}
					</Button>
				</FlexItem>
			</Flex>
		</div>
	);
}
