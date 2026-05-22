import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	Spinner,
	Notice,
	__experimentalVStack as VStack,
	__experimentalText as Text,
} from '@wordpress/components';

import './style.scss';
import './store';
import { fetchSettings } from './api';
import SettingsAccordion from './components/settings-accordion';
import BitsSection from './components/bits-section';

export default function SettingsApp() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetchSettings()
			.then(() => setError(null))
			.catch((e: Error) => setError(e.message))
			.finally(() => setLoading(false));
	}, []);

	return (
		<div className="block-bits-settings">
			{error && (
				<Notice status="error" isDismissible={false}>
					<VStack spacing={2}>
						<span>
							{__('Error loading settings:', 'prc-block-bits')}{' '}
							{error}
						</span>
					</VStack>
				</Notice>
			)}
			<VStack spacing={2} className="block-bits-settings__header">
				<h1>{__('Block Bits Settings', 'prc-block-bits')}</h1>
				<Text className="block-bits-settings__header-description">
					{__(
						'Enable or disable registered block bits. Disabled bits are hidden from the editor toolbar and are not rendered on the frontend.',
						'prc-block-bits'
					)}
				</Text>
			</VStack>
			{loading ? (
				<div className="block-bits-settings__loading">
					<Spinner />
				</div>
			) : (
				!error && (
					<VStack
						spacing={4}
						className="block-bits-settings__content"
					>
						<ul className="block-bits-settings__list">
							<li className="block-bits-settings__list-item">
								<SettingsAccordion
									title={__(
										'Registered Bits',
										'prc-block-bits'
									)}
									description={__(
										'Toggle bits on or off. Changes take effect immediately after saving.',
										'prc-block-bits'
									)}
									contentId="block-bits-settings-registered-bits"
									headingId="block-bits-settings-registered-bits-heading"
									descriptionId="block-bits-settings-registered-bits-description"
								>
									<BitsSection />
								</SettingsAccordion>
							</li>
						</ul>
					</VStack>
				)
			)}
		</div>
	);
}
