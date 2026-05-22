<?php
/**
 * `shareable-text` built-in bit.
 *
 * @package PRC\Platform\Block_Bits\Bits
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits\Bits;

use WP_Block;

use function PRC\Platform\Block_Bits\register_block_bit;

/**
 * `prc-block-bits/shareable-text` — inline text that, when clicked, opens a
 * social-media post-creation window pre-filled with the author-supplied share
 * text and the current page URL.
 *
 * Render strategy: `callback`. The walker substitutes the span saved by the
 * editor with an `<a>` element whose `href` is the platform-specific share URL
 * computed server-side from the saved `shareText` attribute and the current
 * page permalink. Optional `displayText` controls the visible link label; when
 * empty it falls back to `shareText` (backward compatible with older bits).
 * A decorative brand icon precedes the label on the frontend when
 * `\PRC\Platform\Icons\render()` is available.
 *
 * Supported platforms: twitter (Twitter / X), facebook, threads, bluesky.
 *
 * Cache safety note: `get_permalink()` is request-deterministic (page URL does
 * not change per request for a given post). Output is safe for edge caching.
 */
class Shareable_Text {

	public const NAME = 'prc-block-bits/shareable-text';

	private const PLATFORMS = array(
		'twitter',
		'facebook',
		'threads',
		'bluesky',
	);

	public function __construct() {
		add_action( 'init', array( $this, 'register' ), 11 );
	}

	/**
	 * Register the bit on the platform-wide registry.
	 *
	 * Empty `allowed_block_types` means the bit is available in all
	 * RichText-bearing blocks.
	 *
	 * @hook init priority 11
	 */
	public function register(): void {
		register_block_bit(
			self::NAME,
			array(
				'label'               => __( 'Shareable Text', 'prc-block-bits' ),
				'allowed_block_types' => array(),
				'attributes'          => array(
					'displayText' => array(
						'type'    => 'string',
						'default' => '',
					),
					'shareText'   => array(
						'type'    => 'string',
						'default' => '',
					),
					'platform'    => array(
						'type'    => 'enum',
						'enum'    => self::PLATFORMS,
						'default' => 'twitter',
					),
				),
				'render_strategy'     => 'callback',
				'render_callback'     => array( $this, 'render' ),
				'default_text'        => '',
			)
		);
	}

	/**
	 * Render callback. Builds a platform-specific share URL using the saved
	 * `shareText` attribute and the current page permalink, then returns an
	 * `<a>` element wrapping the display text (or `shareText` when display is unset).
	 *
	 * Falls back to plain escaped text if `shareText` is empty (e.g. on a
	 * legacy span whose attribute was not populated).
	 *
	 * @param array         $attributes     Sanitized attribute map (camelCase keys).
	 * @param array         $parsed_block   The parsed parent block.
	 * @param WP_Block|null $block_instance Block instance, or null on legacy paths.
	 */
	public function render( array $attributes, array $parsed_block = array(), ?WP_Block $block_instance = null ): string {
		unset( $parsed_block, $block_instance );

		$share_text = isset( $attributes['shareText'] ) ? (string) $attributes['shareText'] : '';
		if ( '' === $share_text ) {
			return '';
		}

		$display_text = isset( $attributes['displayText'] ) ? (string) $attributes['displayText'] : '';
		if ( '' === $display_text ) {
			$display_text = $share_text;
		}

		$platform = isset( $attributes['platform'] ) ? (string) $attributes['platform'] : 'twitter';
		if ( ! in_array( $platform, self::PLATFORMS, true ) ) {
			$platform = 'twitter';
		}

		$permalink = (string) get_permalink();
		$href      = $this->build_share_url( $platform, $share_text, $permalink );

		if ( '' === $href ) {
			return esc_html( $display_text );
		}

		$icon_html = $this->render_platform_icon( $platform );
		$label     = sprintf(
			'<span class="prc-block-bit-shareable-text__label">%s</span>',
			esc_html( $display_text )
		);
		$inner     = ( '' !== $icon_html ? $icon_html . ' ' : '' ) . $label;

		return sprintf(
			'<a class="prc-block-bit prc-block-bit-shareable-text prc-block-bit-shareable-text--%1$s" data-prc-block-bit="%2$s" data-platform="%1$s" href="%3$s" target="_blank" rel="noopener noreferrer">%4$s</a>',
			esc_attr( $platform ),
			esc_attr( self::NAME ),
			esc_url( $href ),
			$inner
		);
	}

	/**
	 * Map a bit `platform` value to a Font Awesome **brands** sprite id.
	 *
	 * IDs must exist in `prc-icon-library` `brands.svg`.
	 */
	private function icon_name_for_platform( string $platform ): string {
		return match ( $platform ) {
			'twitter'  => 'x-twitter',
			'facebook' => 'facebook',
			'threads'  => 'threads',
			'bluesky'  => 'bluesky',
			default    => '',
		};
	}

	/**
	 * Decorative platform icon via `\PRC\Platform\Icons\render()` (prc-scripts).
	 *
	 * Wrapped with `aria-hidden="true"` so the link text remains the sole
	 * accessible name. Returns empty string when icons are unavailable.
	 */
	private function render_platform_icon( string $platform ): string {
		$icon_name = $this->icon_name_for_platform( $platform );
		if ( '' === $icon_name ) {
			return '';
		}
		if ( ! function_exists( '\PRC\Platform\Icons\render' ) ) {
			return '';
		}

		$markup = (string) \PRC\Platform\Icons\render( 'brands', $icon_name, 1 );
		$trimmed = trim( $markup );
		if ( '' === $trimmed || str_starts_with( $trimmed, '<!--' ) ) {
			return '';
		}

		return sprintf(
			'<span class="prc-block-bit-shareable-text__icon" aria-hidden="true">%s</span>',
			$markup
		);
	}

	/**
	 * Build the platform-specific share URL.
	 *
	 * - Twitter / X: tweet intent with `text` + `url` query params.
	 * - Facebook:    sharer with `u` (page URL) + `quote` (share text).
	 * - Threads:     post intent with `text` = share text + space + page URL.
	 * - Bluesky:     compose intent with `text` = share text + space + page URL.
	 *
	 * @param string $platform   One of `self::PLATFORMS`.
	 * @param string $share_text The text to pre-fill in the share dialog.
	 * @param string $permalink  The current page URL.
	 * @return string The share URL, or empty string if the platform is unknown.
	 */
	private function build_share_url( string $platform, string $share_text, string $permalink ): string {
		switch ( $platform ) {
			case 'twitter':
				return add_query_arg(
					array(
						'text' => $share_text,
						'url'  => $permalink,
					),
					'https://twitter.com/intent/tweet'
				);

			case 'facebook':
				return add_query_arg(
					array(
						'u'     => $permalink,
						'quote' => $share_text,
					),
					'https://www.facebook.com/sharer/sharer.php'
				);

			case 'threads':
				return add_query_arg(
					array(
						'text' => $share_text . ' ' . $permalink,
					),
					'https://www.threads.net/intent/post'
				);

			case 'bluesky':
				return add_query_arg(
					array(
						'text' => $share_text . ' ' . $permalink,
					),
					'https://bsky.app/intent/compose'
				);

			default:
				return '';
		}
	}
}
