<?php
/**
 * PRC Block Bits
 *
 * @package           PRC_Block_Bits
 * @author            Seth Rubenstein
 * @copyright         2026 Pew Research Center
 * @license           GPL-2.0-or-later
 *
 * @wordpress-plugin
 * Plugin Name:       PRC Block Bits
 * Plugin URI:        https://github.com/pewresearch/prc-platform
 * Description:       Provides a registry and central render-block walker for inline-RichText "bits" — small pieces of dynamic content embedded inside core/paragraph, core/heading, and other RichText-bearing blocks. Ships an editor toolbar dropdown for inserting bits and a v1 set of built-in bits (icon-span, copyright).
 * Version:           1.0.0
 * Requires at least: 6.7
 * Requires PHP:      8.2
 * Author:            Seth Rubenstein
 * Author URI:        https://pewresearch.org
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       prc-block-bits
 * Requires Plugins:  prc-scripts
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits;

if ( ! defined( 'WPINC' ) ) {
	die;
}
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'DEFAULT_TECHNICAL_CONTACT' ) ) {
	define( 'DEFAULT_TECHNICAL_CONTACT', 'webdev@pewresearch.org' );
}

define( 'PRC_BLOCK_BITS_FILE', __FILE__ );
define( 'PRC_BLOCK_BITS_DIR', __DIR__ );
define( 'PRC_BLOCK_BITS_VERSION', '1.0.0' );

/**
 * The code that runs during plugin activation.
 * This action is documented in includes/class-plugin-activator.php
 */
function activate(): void {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-plugin-activator.php';
	Plugin_Activator::activate();
}

/**
 * The code that runs during plugin deactivation.
 * This action is documented in includes/class-plugin-deactivator.php
 */
function deactivate(): void {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-plugin-deactivator.php';
	Plugin_Deactivator::deactivate();
}

register_activation_hook( __FILE__, '\PRC\Platform\Block_Bits\activate' );
register_deactivation_hook( __FILE__, '\PRC\Platform\Block_Bits\deactivate' );

/**
 * Helper utilities — exposes register_block_bit() etc. to other plugins.
 */
require plugin_dir_path( __FILE__ ) . 'includes/utils.php';

/**
 * The core plugin class that defines the hooks that initialize the various components.
 */
require plugin_dir_path( __FILE__ ) . 'includes/class-plugin.php';

/**
 * Begins execution of the plugin.
 *
 * @since 1.0.0
 */
function run_prc_block_bits(): void {
	$plugin = new Plugin();
	$plugin->run();
}
run_prc_block_bits();
