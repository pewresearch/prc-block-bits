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
 * `prc-block-bits/icon-span` — inline FontAwesome icon rendered via the
 * platform's sprite-reference shape.
 *
 * Render strategy: `callback`. The walker matches the bit span saved by the
 * editor and substitutes the entire span with the output of
 * {@see Icon_Span::render()}.
 *
 * The icon is emitted as an inline `<svg><use href="…sprites/{lib}.svg#{icon}">
 * </use></svg>` reference, matching the canonical `\PRC\Platform\Icons\render()`
 * shape used throughout the platform (size-constrained via inline style,
 * color via CSS `currentColor` inheritance from the parent span).
 *
 * **Why not inline SVG?** `get_icon_as_svg()` emits a full `<svg>` with the
 * sprite's original `id`, no explicit dimensions, and `viewbox` (lowercase).
 * WP 7's stricter HTML processor trips on that combination mid-`the_content`
 * walk and truncates all content that follows the block.
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
						'default' => 'solid',
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
	 * Render callback. Builds a sprite-reference SVG and returns the full
	 * bit span. Returned markup passes through the walker's central
	 * `wp_kses` allowlist before substitution.
	 *
	 * Color is applied as `style="color:HEX"` on the outer span so the
	 * sprite's `<path>` inherits `currentColor` — matching the canonical
	 * `\PRC\Platform\Icons\render()` pattern.
	 *
	 * @param array         $attributes     Sanitized attribute map (camelCase keys).
	 * @param array         $parsed_block   The parsed parent block.
	 * @param WP_Block|null $block_instance Block instance (or null on legacy paths).
	 */
	public function render( array $attributes, array $parsed_block = array(), ?WP_Block $block_instance = null ): string {
		unset( $parsed_block, $block_instance );

		$library    = $this->coerce_string( $attributes['iconLibrary'] ?? null, 'solid' );
		$icon_name  = $this->coerce_string( $attributes['iconName'] ?? null, '' );
		$icon_color = $this->coerce_string( $attributes['iconColor'] ?? null, '' );
		$position   = $this->coerce_position( $attributes['iconPosition'] ?? null );

		$href = $this->build_use_href( $library, $icon_name );
		if ( '' === $href ) {
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
		// sprite's path picks it up via currentColor.
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

		$svg = sprintf(
			'<svg style="width:1em;height:1em;display:inline-block;vertical-align:-0.125em" focusable="false"><use href="%s"></use></svg>',
			esc_url( $href )
		);

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
	 * Build the sprite `href` for a `<use>` reference.
	 *
	 * Returns empty string when `$icon_name` is blank, when the icon
	 * library plugin constants are not defined, or when the helper
	 * function is unavailable — all of which are safe-miss conditions.
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

	private function coerce_string( $value, string $fallback ): string {
		if ( ! is_string( $value ) || '' === $value ) {
			return $fallback;
		}
		return $value;
	}

	private function coerce_position( $value ): string {
		if ( is_string( $value ) && in_array( $value, self::VALID_POSITIONS, true ) ) {
			return $value;
		}
		return 'right';
	}
}
