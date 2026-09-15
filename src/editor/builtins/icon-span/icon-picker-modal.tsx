/**
 * Registry icon picker for `prc-block-bits/icon-span`.
 *
 * Rebuild of Gutenberg 23.7.1 `CustomInserterModal` on public components.
 * `Tabs` is not a public `@wordpress/components` export. Do not
 * `unlock(privateApis)`. Delete this file when WordPress/gutenberg#76787
 * exports a picker we can import.
 */

import { __ } from '@wordpress/i18n';
import { Modal, SearchControl, Spinner, TabPanel } from '@wordpress/components';
import { useDebounce } from '@wordpress/compose';
import { useMemo, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';

import { IconGrid } from './icon-grid';
import {
	ALL_COLLECTION_TAB,
	ALLOWED_REGISTRY_COLLECTIONS,
	type IconCollectionRecord,
	type IconRecord,
} from './icon-types';

interface IconPickerModalProps {
	onClose: () => void;
	value: string;
	onChange: (name: string) => void;
}

function normalizeSearchInput(input = ''): string {
	return input.trim().toLowerCase();
}

export function IconPickerModal({
	onClose,
	value,
	onChange,
}: IconPickerModalProps): JSX.Element {
	const [searchInput, setSearchInput] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [currentCollection, setCurrentCollection] = useState<string | null>(
		null
	);
	const debouncedSetSearchQuery = useDebounce(setSearchQuery, 300);

	const onSearchChange = (next: string) => {
		setSearchInput(next);
		debouncedSetSearchQuery(next);
	};

	const collections = useSelect((select) => {
		const records =
			(select(coreStore).getEntityRecords('root', 'iconCollection') as
				| IconCollectionRecord[]
				| null) ?? null;
		if (!records) {
			return records;
		}
		return records.filter((collection) =>
			ALLOWED_REGISTRY_COLLECTIONS.includes(collection.slug)
		);
	}, []);

	const selectedCollection = value?.split('/')[0];
	const collectionTab =
		currentCollection ??
		(collections?.some(({ slug }) => slug === selectedCollection)
			? selectedCollection
			: ALL_COLLECTION_TAB);

	const { icons, hasResolvedIcons } = useSelect(
		(select) => {
			const query =
				collectionTab === ALL_COLLECTION_TAB || collectionTab === ''
					? {}
					: { collection: collectionTab };
			const { getEntityRecords, hasFinishedResolution } =
				select(coreStore);
			return {
				icons:
					(getEntityRecords('root', 'icon', query) as
						| IconRecord[]
						| null) ?? null,
				hasResolvedIcons: hasFinishedResolution('getEntityRecords', [
					'root',
					'icon',
					query,
				]),
			};
		},
		[collectionTab]
	);

	const filteredIcons = useMemo(() => {
		if (!icons) {
			return [];
		}
		if (!searchQuery) {
			return icons;
		}
		const input = normalizeSearchInput(searchQuery);
		return icons.filter((icon) => {
			const iconName = normalizeSearchInput(icon.name);
			const iconLabel = normalizeSearchInput(icon.label);
			return iconName.includes(input) || iconLabel.includes(input);
		});
	}, [searchQuery, icons]);

	const tabs = [
		{ name: ALL_COLLECTION_TAB, title: __('All', 'prc-block-bits') },
		...(collections ?? []).map((collection) => ({
			name: collection.slug,
			title: collection.label,
		})),
	];

	return (
		<Modal
			className="wp-block-icon__inserter-modal"
			title={__('Icon library', 'prc-block-bits')}
			onRequestClose={onClose}
			isFullScreen
		>
			<div className="wp-block-icon__inserter">
				<div className="wp-block-icon__inserter-sidebar">
					<SearchControl
						__nextHasNoMarginBottom
						value={searchInput}
						onChange={onSearchChange}
					/>
				</div>
				<TabPanel
					className="wp-block-icon__inserter-panel"
					orientation="vertical"
					initialTabName={collectionTab}
					tabs={tabs}
					onSelect={setCurrentCollection}
				>
					{() =>
						!hasResolvedIcons ? (
							<div
								className="wp-block-icon__inserter-loading"
								role="status"
								aria-label={__('Loading…', 'prc-block-bits')}
							>
								<Spinner />
							</div>
						) : (
							<IconGrid
								icons={filteredIcons}
								onChange={onChange}
								value={value}
							/>
						)
					}
				</TabPanel>
			</div>
		</Modal>
	);
}
