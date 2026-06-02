<?php
/**
 * Plugin class.
 *
 * @package PRC\Platform\Block_Bits
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits;

/**
 * Bootstraps the prc-block-bits plugin: loader + dependencies.
 *
 * Mirrors the modern `prc-help-center` `Plugin` class shape rather than the
 * older `Bootstrap` shape from `plugins/.plugin-bootstrap-template/`.
 */
class Plugin {

	protected Loader $loader;

	protected string $plugin_name = 'prc-block-bits';

	protected string $version = '1.0.0';

	public function __construct() {
		$this->load_dependencies();
		$this->init_dependencies();
	}

	/**
	 * Load the required dependencies for this plugin.
	 */
	private function load_dependencies(): void {
		require_once plugin_dir_path( __DIR__ ) . 'includes/class-loader.php';
		require_once plugin_dir_path( __DIR__ ) . 'includes/class-registry.php';
		require_once plugin_dir_path( __DIR__ ) . 'includes/class-bit-render-context.php';
		require_once plugin_dir_path( __DIR__ ) . 'includes/class-settings.php';
		require_once plugin_dir_path( __DIR__ ) . 'includes/class-assets.php';
		require_once plugin_dir_path( __DIR__ ) . 'includes/class-walker.php';
		require_once plugin_dir_path( __DIR__ ) . 'includes/bits/class-icon-span.php';
		require_once plugin_dir_path( __DIR__ ) . 'includes/bits/class-copyright.php';
		require_once plugin_dir_path( __DIR__ ) . 'includes/bits/class-shareable-text.php';

		$this->loader = new Loader();
	}

	/**
	 * Initialize the dependencies.
	 *
	 * Built-in bits register on `init` priority 11 — see each bit class
	 * for its hook wiring.
	 */
	private function init_dependencies(): void {
		new Settings( $this->loader );
		new Assets( $this->loader );
		new Walker( $this->loader );
		new Bits\Icon_Span();
		new Bits\Copyright();
		new Bits\Shareable_Text();
		$this->maybe_load_test_fixtures();
	}

	/**
	 * Load test-only bit registrations when running in PRC_PLATFORM_TESTING_MODE.
	 *
	 * The fixture file lives under `tests/prc-block-bits/fixtures/` so test
	 * code stays out of the production plugin's code paths.
	 */
	private function maybe_load_test_fixtures(): void {
		if ( ! defined( 'PRC_PLATFORM_TESTING_MODE' ) || ! PRC_PLATFORM_TESTING_MODE ) {
			return;
		}
		$fixture = dirname( PRC_BLOCK_BITS_DIR, 2 ) . '/tests/prc-block-bits/fixtures/test-bits.php';
		if ( file_exists( $fixture ) ) {
			require_once $fixture;
		}
	}

	public function run(): void {
		$this->loader->run();
	}

	public function get_plugin_name(): string {
		return $this->plugin_name;
	}

	public function get_loader(): Loader {
		return $this->loader;
	}

	public function get_version(): string {
		return $this->version;
	}
}
