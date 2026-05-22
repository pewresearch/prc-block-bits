<?php
/**
 * Fired during plugin activation.
 *
 * @package PRC\Platform\Block_Bits
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits;

/**
 * The plugin activator class.
 */
class Plugin_Activator {

	public static function activate(): void {
		flush_rewrite_rules();

		wp_mail(
			DEFAULT_TECHNICAL_CONTACT,
			'PRC Block Bits Activated',
			'The PRC Block Bits plugin has been activated on ' . get_site_url()
		);
	}
}
