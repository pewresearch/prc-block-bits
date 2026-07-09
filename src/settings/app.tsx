import { __ } from '@wordpress/i18n';
import { SettingsPage } from '@prc/components';

import './style.scss';
import './store';
import { fetchSettings } from './api';
import BitsSection from './components/bits-section';

const TEXT_DOMAIN = 'prc-block-bits';

export default function SettingsApp() {
	return (
		<SettingsPage
			title={__('Block Bits Settings', TEXT_DOMAIN)}
			description={__(
				'Enable or disable registered block bits. Disabled bits are hidden from the editor toolbar and are not rendered on the frontend.',
				TEXT_DOMAIN
			)}
			textDomain={TEXT_DOMAIN}
			idPrefix="prc-block-bits-settings"
			sections={[
				{
					slug: 'registered-bits',
					title: __('Registered Bits', TEXT_DOMAIN),
					description: __(
						'Toggle bits on or off. Changes take effect immediately after saving.',
						TEXT_DOMAIN
					),
					render: () => <BitsSection />,
				},
			]}
			onLoad={fetchSettings}
		/>
	);
}
