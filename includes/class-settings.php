<?php
/**
 * Settings page for Block Bits.
 *
 * @package PRC\Platform\Block_Bits
 */

declare( strict_types=1 );

namespace PRC\Platform\Block_Bits;

use PRC\Platform\Settings_Page_Boot;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the Block Bits settings page under Settings > Block Bits and
 * exposes GET/POST REST routes backed by `wp_options`.
 *
 * Admin page:  Settings > Block Bits
 * REST GET:    /prc-block-bits/v1/settings → { settings, bits }
 * REST POST:   /prc-block-bits/v1/settings { disabled_bits: string[] }
 * Option key:  prc_block_bits_settings
 */
class Settings {

	const OPTION_KEY      = 'prc_block_bits_settings';
	const REST_NAMESPACE  = 'prc-block-bits/v1';
	const ADMIN_PAGE_SLUG = 'prc-block-bits-settings';

	/**
	 * Default settings — bits are enabled by default, opt-out via disabled_bits.
	 *
	 * @var array<string, mixed>
	 */
	private static array $defaults = array(
		'disabled_bits' => array(),
	);

	private Registry $registry;

	public function __construct( Loader $loader, ?Registry $registry = null ) {
		$this->registry = $registry ?? Registry::instance();
		$loader->add_action( 'admin_menu', $this, 'register_admin_page' );
		$loader->add_action( 'admin_enqueue_scripts', $this, 'enqueue_admin_assets' );
		$loader->add_action( 'rest_api_init', $this, 'register_routes' );
	}

	/**
	 * Return the merged settings (stored + defaults).
	 *
	 * Public static so `Assets` and `Walker` can read the disabled list
	 * without instantiating this class.
	 *
	 * @return array<string, mixed>
	 */
	public static function get_settings(): array {
		$stored = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}
		$merged = array_merge( self::$defaults, $stored );

		// Ensure disabled_bits is always a clean indexed array of strings.
		if ( ! is_array( $merged['disabled_bits'] ) ) {
			$merged['disabled_bits'] = array();
		}
		$merged['disabled_bits'] = array_values(
			array_filter( $merged['disabled_bits'], 'is_string' )
		);

		return $merged;
	}

	/**
	 * Check whether a given bit name is currently disabled.
	 */
	public static function is_bit_disabled( string $bit_name ): bool {
		return in_array( $bit_name, self::get_settings()['disabled_bits'], true );
	}

	/** @hook admin_menu */
	public function register_admin_page(): void {
		add_submenu_page(
			'options-general.php',
			__( 'Block Bits Settings', 'prc-block-bits' ),
			__( 'Block Bits', 'prc-block-bits' ),
			'manage_options',
			self::ADMIN_PAGE_SLUG,
			array( $this, 'render_admin_page' )
		);
	}

	public function render_admin_page(): void {
		Settings_Page_Boot::render( 'prc-block-bits-settings-admin' );
	}

	/** @hook admin_enqueue_scripts */
	public function enqueue_admin_assets( string $hook_suffix ): void {
		if ( 'settings_page_' . self::ADMIN_PAGE_SLUG !== $hook_suffix ) {
			return;
		}

		$asset_file = plugin_dir_path( __DIR__ ) . 'build/settings/index.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset  = require $asset_file;
		$handle = 'prc-block-bits-settings';

		wp_enqueue_script(
			$handle,
			plugins_url( 'build/settings/index.js', PRC_BLOCK_BITS_FILE ),
			$asset['dependencies'],
			$asset['version'],
			true
		);

		// style-index.css is emitted when the entry has a .scss import.
		$style_path = plugin_dir_path( __DIR__ ) . 'build/settings/style-index.css';
		if ( file_exists( $style_path ) ) {
			$style_deps = array( 'wp-components' );
			if ( in_array( 'prc-components', $asset['dependencies'], true ) ) {
				$style_deps[] = 'prc-components';
			}

			wp_enqueue_style(
				$handle,
				plugins_url( 'build/settings/style-index.css', PRC_BLOCK_BITS_FILE ),
				$style_deps,
				$asset['version']
			);
		}

		Settings_Page_Boot::enqueue(
			$handle,
			(string) $asset['version'],
			'prc-block-bits-settings-admin'
		);
	}

	/** @hook rest_api_init */
	public function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/settings',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_settings_endpoint' ),
					'permission_callback' => fn(): bool => current_user_can( 'manage_options' ),
				),
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'save_settings_endpoint' ),
					'permission_callback' => fn(): bool => current_user_can( 'manage_options' ),
				),
			)
		);
	}

	public function get_settings_endpoint(): \WP_REST_Response {
		return rest_ensure_response(
			array(
				'settings' => self::get_settings(),
				'bits'     => $this->get_bits_for_response(),
			)
		);
	}

	public function save_settings_endpoint( \WP_REST_Request $request ): \WP_REST_Response {
		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			return new \WP_REST_Response( array( 'error' => 'Invalid payload.' ), 400 );
		}
		$sanitized = $this->sanitize_settings( $body );
		update_option( self::OPTION_KEY, $sanitized );
		return rest_ensure_response(
			array(
				'settings' => self::get_settings(),
				'bits'     => $this->get_bits_for_response(),
			)
		);
	}

	/**
	 * Sanitize the posted settings payload.
	 *
	 * @param array<string, mixed> $input Raw request body.
	 * @return array<string, mixed>
	 */
	private function sanitize_settings( array $input ): array {
		$sanitized = self::$defaults;

		if ( isset( $input['disabled_bits'] ) && is_array( $input['disabled_bits'] ) ) {
			$sanitized['disabled_bits'] = array_values(
				array_filter(
					array_map( 'sanitize_text_field', $input['disabled_bits'] ),
					'is_string'
				)
			);
		}

		return $sanitized;
	}

	/**
	 * Project all registered bits to a safe summary for the REST response.
	 *
	 * Returns only the metadata fields the settings UI needs — no PHP
	 * callbacks or server-only fields.
	 *
	 * @return array<array{name: string, label: string, category: string|null}>
	 */
	private function get_bits_for_response(): array {
		$bits = array();
		foreach ( $this->registry->all() as $name => $args ) {
			$bits[] = array(
				'name'     => $name,
				'label'    => $args['label'],
				'category' => $args['category'] ?? null,
			);
		}
		return $bits;
	}
}
