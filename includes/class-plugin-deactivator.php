<?php
/**
 * Fired during plugin deactivation.
 *
 * @package PRC\Platform\Block_Bits
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits;

/**
 * The plugin deactivator class.
 */
class Plugin_Deactivator {

	public static function deactivate(): void {
		flush_rewrite_rules();

		wp_mail(
			DEFAULT_TECHNICAL_CONTACT,
			'PRC Block Bits Deactivated',
			'The PRC Block Bits plugin has been deactivated on ' . get_site_url()
		);
	}
}
