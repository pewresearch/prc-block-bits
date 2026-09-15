/**
 * Icon grid for the copied Gutenberg custom inserter.
 *
 * Source: Gutenberg 23.7.1 `packages/block-library/src/icon/components/custom-inserter/icon-grid`.
 * Delete this file when WordPress/gutenberg#76787 exports a picker we can import.
 */

import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { useAsyncList } from '@wordpress/compose';
import { RawHTML, useLayoutEffect, useRef } from '@wordpress/element';
import { getScrollContainer } from '@wordpress/dom';

import type { IconRecord } from './icon-types';

const BATCH_SIZE = 20;

interface IconGridProps {
	icons: IconRecord[];
	onChange: (name: string) => void;
	value: string;
}

export function IconGrid({
	icons,
	onChange,
	value,
}: IconGridProps): JSX.Element {
	const shownIcons = useAsyncList(icons, { step: BATCH_SIZE });
	const selectedIconRef = useRef<HTMLButtonElement | null>(null);
	const selectedIndex = icons.findIndex((icon) => icon.name === value);
	const isReadyToScroll =
		selectedIndex >= 0 &&
		(shownIcons.length >= selectedIndex + BATCH_SIZE ||
			shownIcons.length === icons.length);

	useLayoutEffect(() => {
		const node = selectedIconRef.current;
		if (!isReadyToScroll || !node) {
			return;
		}
		if (getScrollContainer(node)?.scrollTop) {
			return;
		}
		node.scrollIntoView({ block: 'center' });
	}, [isReadyToScroll]);

	if (!icons.length) {
		return (
			<div className="wp-block-icon__inserter-grid-no-results">
				<p>{__('No results found.', 'prc-block-bits')}</p>
			</div>
		);
	}

	return (
		<div
			className="wp-block-icon__inserter-grid-icons-list"
			aria-label={__('Icon library', 'prc-block-bits')}
		>
			{shownIcons.map((icon) => (
				<Button
					key={icon.name}
					ref={icon.name === value ? selectedIconRef : undefined}
					className="wp-block-icon__inserter-grid-icons-list-item"
					onClick={() => onChange(icon.name)}
					variant={icon.name === value ? 'primary' : undefined}
					__next40pxDefaultSize
				>
					<span className="wp-block-icon__inserter-grid-icons-list-item-icon">
						<RawHTML>{icon.content}</RawHTML>
					</span>
					<span className="wp-block-icon__inserter-grid-icons-list-item-title">
						{icon.label}
					</span>
				</Button>
			))}
		</div>
	);
}
