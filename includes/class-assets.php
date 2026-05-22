<?php
/**
 * Asset registration and enqueue.
 *
 * @package PRC\Platform\Block_Bits
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits;

/**
 * Register and enqueue the editor-side bits surface.
 *
 * The build emits `build/editor/index.{js,asset.php,css}` from
 * `src/editor/index.ts`. The script handle is `prc-block-bits-editor`.
 *
 * Localizes the registered bits to the editor as `window.prcBlockBits.bits`
 * via an explicit allowlist projection (`project_bit_for_editor()`).
 * `render_callback`, `iapi`, and any other PHP-only fields are stripped at
 * projection time so the editor never sees server-only state.
 */
class Assets {

	private const SCRIPT_HANDLE = 'prc-block-bits-editor';

	private Registry $registry;

	public function __construct( ?Loader $loader = null, ?Registry $registry = null ) {
		$this->registry = $registry ?? Registry::instance();
		if ( null === $loader ) {
			return;
		}
		$loader->add_action( 'enqueue_block_editor_assets', $this, 'enqueue_editor_assets' );
		// `enqueue_block_editor_assets` only fires on the outer admin page.
		// The editor content area lives inside an iframe; styles need to be
		// forwarded there via `enqueue_block_assets`, which fires inside the
		// iframe context as well. `is_admin()` guard keeps them off the
		// public frontend.
		$loader->add_action( 'enqueue_block_assets', $this, 'enqueue_iframe_styles' );
	}

	/**
	 * @hook enqueue_block_editor_assets
	 */
	public function enqueue_editor_assets(): void {
		$asset_path = PRC_BLOCK_BITS_DIR . '/build/editor/index.asset.php';
		if ( ! file_exists( $asset_path ) ) {
			return;
		}

		$asset_file = include $asset_path;

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			plugins_url( 'build/editor/index.js', PRC_BLOCK_BITS_FILE ),
			$asset_file['dependencies'],
			$asset_file['version'],
			true
		);

		// Inject the projected bits payload as `window.prcBlockBits.bits`
		// before the editor script runs so the registry can hydrate
		// synchronously at module-eval time.
		wp_add_inline_script(
			self::SCRIPT_HANDLE,
			'window.prcBlockBits = ' . wp_json_encode( $this->build_localized_payload() ) . ';',
			'before'
		);

		// `wp-components` carries the Popover / Dropdown / MenuItem chrome
		// our toolbar uses. The asset.php usually picks it up via webpack
		// dependency extraction, but we enqueue it explicitly so the editor
		// stylesheet load order is deterministic.
		wp_enqueue_style( 'wp-components' );

		$style_path = PRC_BLOCK_BITS_DIR . '/build/editor/index.css';
		if ( file_exists( $style_path ) ) {
			wp_enqueue_style(
				self::SCRIPT_HANDLE,
				plugins_url( 'build/editor/index.css', PRC_BLOCK_BITS_FILE ),
				array( 'wp-components' ),
				$asset_file['version']
			);
		}
	}

	/**
	 * Enqueue the editor stylesheet inside the block editor iframe.
	 *
	 * `enqueue_block_editor_assets` loads assets on the outer admin page only.
	 * The editor content area is iframed (WP 6.0+), so the token-pill CSS for
	 * `.prc-block-bit` spans must be forwarded via `enqueue_block_assets`,
	 * which fires inside the iframe context. The `is_admin()` guard prevents
	 * the stylesheet from loading on the public frontend — the token treatment
	 * is editor-only.
	 *
	 * @hook enqueue_block_assets
	 */
	public function enqueue_iframe_styles(): void {
		if ( ! is_admin() ) {
			return;
		}

		$asset_path = PRC_BLOCK_BITS_DIR . '/build/editor/index.asset.php';
		if ( ! file_exists( $asset_path ) ) {
			return;
		}

		$asset_file = include $asset_path;
		$style_path = PRC_BLOCK_BITS_DIR . '/build/editor/index.css';

		if ( ! file_exists( $style_path ) ) {
			return;
		}

		// Use a distinct handle so this registration doesn't conflict with the
		// outer-page enqueue in `enqueue_editor_assets()`.
		wp_enqueue_style(
			self::SCRIPT_HANDLE . '-iframe',
			plugins_url( 'build/editor/index.css', PRC_BLOCK_BITS_FILE ),
			array(),
			$asset_file['version']
		);
	}

	/**
	 * Build the `window.prcBlockBits` payload — `{ bits: { [name]: ... } }`.
	 *
	 * Disabled bits (as configured in Settings) are excluded so the editor
	 * toolbar never shows them and the format-type union attributes stay lean.
	 *
	 * @return array<string, mixed>
	 */
	private function build_localized_payload(): array {
		$disabled = Settings::get_settings()['disabled_bits'];
		$bits     = array();
		foreach ( $this->registry->all() as $name => $args ) {
			if ( in_array( $name, $disabled, true ) ) {
				continue;
			}
			$bits[ $name ] = $this->project_bit_for_editor( $args );
		}
		$payload = array( 'bits' => $bits );

		// Expose the sprite base URL so editor-side code can build
		// <use href="...sprites/{lib}.svg#{icon}"> references without
		// hard-coding the plugin path (important on subdirectory installs).
		if ( defined( 'PRC_PLATFORM_ICONS_URL' ) ) {
			$payload['iconSpritesUrl'] = PRC_PLATFORM_ICONS_URL;
		}

		return $payload;
	}

	/**
	 * Project a bit's normalized PHP registration onto the explicit editor
	 * allowlist. Anything not in this projection stays server-side.
	 *
	 * Allowlist: `label`, `title`, `iconSlug`, `allowedBlockTypes`,
	 * `attributes` (camelCase keys), `defaultText`.
	 *
	 * @param array $args Normalized registration from `Registry::all()`.
	 * @return array<string, mixed>
	 */
	private function project_bit_for_editor( array $args ): array {
		$attributes = array();
		foreach ( $args['attributes'] as $attr_key => $attr_def ) {
			$projected = array(
				'type' => $attr_def['type'],
			);
			if ( array_key_exists( 'default', $attr_def ) ) {
				$projected['default'] = $attr_def['default'];
			}
			if ( 'enum' === $attr_def['type'] && isset( $attr_def['enum'] ) ) {
				$projected['enum'] = array_values( $attr_def['enum'] );
			}
			$attributes[ $attr_key ] = $projected;
		}

		$default_text = '';
		if ( ! empty( $args['default_text'] ) ) {
			$default_text = $args['default_text'];
		} elseif ( isset( $args['iapi']['default_text'] ) && is_string( $args['iapi']['default_text'] ) ) {
			$default_text = $args['iapi']['default_text'];
		}

		return array(
			'label'             => $args['label'],
			'title'             => $args['label'],
			'iconSlug'          => $args['icon_slug'] ?? null,
			'category'          => $args['category'] ?? null,
			'allowedBlockTypes' => array_values( $args['allowed_block_types'] ),
			'attributes'        => $attributes,
			'defaultText'       => $default_text,
		);
	}
}
