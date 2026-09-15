<?php
/**
 * `icon-span` built-in bit.
 *
 * @package PRC\Platform\Block_Bits\Bits
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits\Bits;

use WP_Block;

use function PRC\Platform\Block_Bits\register_block_bit;
use function PRC\Platform\Block_Bits\get_block_bit;

/**
 * `prc-block-bits/icon-span` — inline icon rendered via the platform icon
 * facade ({@see \PRC\Platform\Icons\render()}).
 *
 * Render strategy: `callback`. The walker matches the bit span saved by the
 * editor and substitutes the entire span with the output of
 * {@see Icon_Span::render()}.
 *
 * Namespaced `iconName` values (`core/plus`, `prc/arrow-right`,
 * `brands/google`) call `wp_get_icon()` with the registry key. Unnamespaced
 * curated glyphs still prefer `wp_get_icon( 'prc/{name}' )` via the PHP
 * facade. Approved brands prefer `wp_get_icon( 'brands/{name}' )` when
 * registered. Missing names return an empty bit span — no Font Awesome Pro
 * sprite `<use>` path.
 *
 * Sprite-era `get_icon_as_svg()` output (sprite `id`, no dimensions, lowercase
 * `viewbox`) still truncates mid-`the_content` on WP 7's HTML processor.
 * Registry fill SVGs are a different shape; this bit only inlines those.
 *
 * Per R8c: decorative-by-default (`aria-hidden="true"`); if the bit
 * registration carries an `aria_label`, drop `aria-hidden` and emit
 * `aria-label` instead.
 */
class Icon_Span {

	public const NAME = 'prc-block-bits/icon-span';

	private const ALLOWED_BLOCK_TYPES = array(
		'core/paragraph',
		'core/heading',
		'core/list-item',
	);

	private const VALID_POSITIONS = array( 'left', 'right' );

	private const SPRITE_LIBRARIES = array(
		'prc',
		'brands',
	);

	/**
	 * Hook registration.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'register' ), 11 );
	}

	/**
	 * Register the bit on the platform-wide registry.
	 *
	 * @hook init priority 11
	 */
	public function register(): void {
		register_block_bit(
			self::NAME,
			array(
				'label'               => __( 'Icon', 'prc-block-bits' ),
				'allowed_block_types' => self::ALLOWED_BLOCK_TYPES,
				'attributes'          => array(
					'iconLibrary'  => array(
						'type'    => 'icon_name',
						'default' => 'prc',
					),
					'iconName'     => array(
						'type'    => 'icon_name',
						'default' => '',
					),
					'iconColor'    => array(
						'type'    => 'hex_color',
						'default' => '',
					),
					'iconPosition' => array(
						'type'    => 'enum',
						'enum'    => self::VALID_POSITIONS,
						'default' => 'right',
					),
				),
				'render_strategy'     => 'callback',
				'render_callback'     => array( $this, 'render' ),
				// Empty — the icon SVG is the entire payload; baking content
				// into the editor-saved span is unnecessary.
				'default_text'        => '',
			)
		);
	}

	/**
	 * Render callback. Prefers registry SVG for curated names, otherwise a
	 * sprite `<use>` reference. Returned markup passes through the walker's
	 * central `wp_kses` allowlist before substitution.
	 *
	 * Color is applied as `style="color:HEX"` on the outer span so the
	 * glyph inherits `currentColor` — matching `\PRC\Platform\Icons\render()`.
	 *
	 * @param array         $attributes     Sanitized attribute map (camelCase keys).
	 * @param array         $parsed_block   The parsed parent block.
	 * @param WP_Block|null $block_instance Block instance (or null on legacy paths).
	 * @return string Bit span HTML.
	 */
	public function render( array $attributes, array $parsed_block = array(), ?WP_Block $block_instance = null ): string {
		unset( $parsed_block, $block_instance );

		$library    = $this->coerce_string( $attributes['iconLibrary'] ?? null, 'prc' );
		$icon_name  = $this->coerce_string( $attributes['iconName'] ?? null, '' );
		$icon_color = $this->coerce_string( $attributes['iconColor'] ?? null, '' );
		$position   = $this->coerce_position( $attributes['iconPosition'] ?? null );

		$svg = $this->build_icon_svg( $library, $icon_name );
		if ( '' === $svg ) {
			// Missing icon or library not loaded — return an empty bit span.
			return sprintf(
				'<span class="prc-block-bit prc-block-bit-icon-span prc-block-bit-icon-span--position-%s" data-prc-block-bit="%s" data-icon-library="%s" data-icon-name="%s" data-icon-color="%s" aria-hidden="true"></span>',
				esc_attr( $position ),
				esc_attr( self::NAME ),
				esc_attr( $library ),
				esc_attr( $icon_name ),
				esc_attr( $icon_color )
			);
		}

		$classes = sprintf(
			'prc-block-bit prc-block-bit-icon-span prc-block-bit-icon-span--position-%s',
			$position
		);

		// Color flows through CSS inheritance — set it on the span so the
		// glyph picks it up via currentColor.
		$color_style = '' !== $icon_color
			? sprintf( ' style="color:%s"', esc_attr( $icon_color ) )
			: '';

		$registration = get_block_bit( self::NAME );
		$aria_label   = is_array( $registration ) && ! empty( $registration['aria_label'] )
			? (string) $registration['aria_label']
			: null;
		$a11y_attrs   = null !== $aria_label
			? sprintf( ' aria-label="%s"', esc_attr( $aria_label ) )
			: ' aria-hidden="true"';

		return sprintf(
			'<span class="%1$s" data-prc-block-bit="%2$s" data-icon-library="%3$s" data-icon-name="%4$s" data-icon-color="%5$s"%6$s%7$s>%8$s</span>',
			esc_attr( $classes ),
			esc_attr( self::NAME ),
			esc_attr( $library ),
			esc_attr( $icon_name ),
			esc_attr( $icon_color ),
			$color_style,
			$a11y_attrs,
			$svg
		);
	}

	/**
	 * Build inner SVG: registry fill markup when available, else fill-sheet `<use>`.
	 *
	 * Namespaced keys (`prc/arrow-right`, `core/plus`, `brands/google`) call
	 * `wp_get_icon()` with the stored identity. Unnamespaced curated names
	 * and approved brands still go through the PHP facade. Historical FA
	 * weight slugs remap to `prc` for `<use href>`.
	 *
	 * @param string $library   Sprite library or collection slug.
	 * @param string $icon_name Glyph or `collection/name` registry key.
	 * @return string Inner SVG markup, or empty string.
	 */
	private function build_icon_svg( string $library, string $icon_name ): string {
		if ( '' === $icon_name ) {
			return '';
		}

		$inline_style = 'display:inline-block;vertical-align:-0.125em';

		$namespaced = $this->registry_svg_for_namespaced_name( $icon_name, $inline_style );
		if ( '' !== $namespaced ) {
			return $namespaced;
		}

		$glyph = $this->glyph_from_icon_name( $icon_name );

		if (
			function_exists( '\\PRC\\Platform\\Icons\\has_registry_icon' )
			&& \PRC\Platform\Icons\has_registry_icon( $library, $glyph )
		) {
			$collection = function_exists( '\\PRC\\Platform\\Icons\\registry_collection_for_library' )
				? \PRC\Platform\Icons\registry_collection_for_library( $library )
				: 'prc';
			$svg        = (string) \PRC\Platform\Icons\get_registry_icon_svg( $glyph, array(), $collection );
			if ( '' !== $svg ) {
				return \PRC\Platform\Icons\apply_svg_size_style( $svg, '1em', $inline_style );
			}
		}

		$sprite_lib = in_array( $library, self::SPRITE_LIBRARIES, true ) ? $library : 'prc';
		$href       = $this->build_use_href( $sprite_lib, $glyph );
		if ( '' === $href ) {
			return '';
		}

		return sprintf(
			'<svg style="width:1em;height:1em;%s" focusable="false"><use href="%s"></use></svg>',
			$inline_style,
			esc_url( $href )
		);
	}

	/**
	 * Inline a namespaced registry SVG (`collection/name`).
	 *
	 * @param string $icon_name    Glyph or registry key.
	 * @param string $inline_style Extra CSS on the root svg.
	 * @return string SVG markup, or empty string.
	 */
	private function registry_svg_for_namespaced_name( string $icon_name, string $inline_style ): string {
		if ( ! str_contains( $icon_name, '/' ) || ! function_exists( 'wp_get_icon' ) ) {
			return '';
		}

		$candidate = (string) wp_get_icon(
			$icon_name,
			array(
				'size'  => null,
				'label' => '',
			)
		);
		if ( '' === $candidate ) {
			return '';
		}

		if ( function_exists( '\\PRC\\Platform\\Icons\\apply_svg_size_style' ) ) {
			return \PRC\Platform\Icons\apply_svg_size_style( $candidate, '1em', $inline_style );
		}

		return $candidate;
	}

	/**
	 * Return the unnamespaced glyph from a registry key.
	 *
	 * @param string $icon_name Glyph or `collection/name` registry key.
	 * @return string Glyph used for sprite `#id` lookups.
	 */
	private function glyph_from_icon_name( string $icon_name ): string {
		if ( ! str_contains( $icon_name, '/' ) ) {
			return $icon_name;
		}
		$parts = explode( '/', $icon_name, 2 );
		return $parts[1];
	}

	/**
	 * Build the sprite `href` for a `<use>` reference.
	 *
	 * Returns empty string when `$icon_name` is blank, when the icon
	 * library plugin constants are not defined, or when the helper
	 * function is unavailable — all of which are safe-miss conditions.
	 *
	 * @param string $library   Sprite library slug.
	 * @param string $icon_name Unnamespaced glyph.
	 * @return string Sprite fragment URL, or empty string.
	 */
	private function build_use_href( string $library, string $icon_name ): string {
		if ( '' === $icon_name ) {
			return '';
		}
		if ( ! function_exists( '\\PRC\\Platform\\Icons\\get_icon_as_url' ) ) {
			return '';
		}

		$url = (string) \PRC\Platform\Icons\get_icon_as_url( $library, $icon_name );

		// `get_icon_as_url` returns an HTML comment when PRC_PLATFORM_ICONS_URL
		// is not defined (e.g. icon-library plugin inactive).
		$trimmed = trim( $url );
		if ( '' === $trimmed || str_starts_with( $trimmed, '<!--' ) ) {
			return '';
		}

		return $url;
	}

	/**
	 * Coerce a harvested value to a non-empty string.
	 *
	 * @param mixed  $value    Raw attribute value.
	 * @param string $fallback Value when `$value` is not a non-empty string.
	 * @return string
	 */
	private function coerce_string( $value, string $fallback ): string {
		if ( ! is_string( $value ) || '' === $value ) {
			return $fallback;
		}
		return $value;
	}

	/**
	 * Coerce a harvested position to `left` or `right`.
	 *
	 * @param mixed $value Raw attribute value.
	 * @return string
	 */
	private function coerce_position( $value ): string {
		if ( is_string( $value ) && in_array( $value, self::VALID_POSITIONS, true ) ) {
			return $value;
		}
		return 'right';
	}
}
