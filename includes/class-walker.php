<?php
/**
 * Render-block walker.
 *
 * @package PRC\Platform\Block_Bits
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits;

use Throwable;
use WP_Block;
use WP_HTML_Tag_Processor;

/**
 * Walks rendered block HTML and dispatches each `prc-block-bit` span to its
 * registered strategy. Hooked on `render_block` priority 100.
 *
 * Two-strategy dispatch:
 *
 * - **iAPI** — attribute-only mutations via `WP_HTML_Tag_Processor`. The
 *   walker emits `data-wp-interactive`, `data-wp-text`, `data-wp-bind--*`,
 *   and (optionally) `data-wp-context` onto the span. textContent is left
 *   untouched — the editor's format type writes `default_text` as the
 *   span's literal textContent at save time, which doubles as the
 *   cross-context fallback per R10a.
 * - **callback** — outer-HTML replacement via regex matching on the bit's
 *   marker shape. Each callback is wrapped in try/catch so a failing bit
 *   leaves its span untouched without breaking sibling bits or the page.
 *   Output passes through a central `wp_kses` allowlist before substitution.
 */
class Walker {

	public const MARKER_CLASS = 'prc-block-bit';

	/**
	 * Per-bit data attribute carrying the namespaced bit name.
	 */
	public const NAME_ATTRIBUTE = 'data-prc-block-bit';

	private const NEWRELIC_KEY = 'block_bits/walker';

	private Registry $registry;

	public function __construct( ?Loader $loader = null, ?Registry $registry = null ) {
		$this->registry = $registry ?? Registry::instance();
		if ( null === $loader ) {
			return;
		}
		// Late priority so other render_block filters (block bindings,
		// supports, headings) have already done their attribute work.
		$loader->add_filter( 'render_block', $this, 'handle', 100, 3 );
	}

	/**
	 * `render_block` filter callback.
	 *
	 * @param string         $block_content   The block's rendered HTML.
	 * @param array          $parsed_block    The parsed block.
	 * @param WP_Block|null  $block_instance  Block instance (or null on legacy paths).
	 */
	public function handle( $block_content, $parsed_block, $block_instance = null ) {
		if ( ! is_string( $block_content ) || '' === $block_content ) {
			return $block_content;
		}

		// Mandatory short-circuit (R9). The substring scan is constant-time
		// per block; without it every block on every render would pay the
		// parser-walk cost.
		if ( ! str_contains( $block_content, self::MARKER_CLASS ) ) {
			return $block_content;
		}

		if ( function_exists( '\PRC\Platform\Newrelic\trace' ) ) {
			\PRC\Platform\Newrelic\trace( self::NEWRELIC_KEY, 'invoked' );
		}

		$block_content = $this->emit_iapi_directives( $block_content );
		$block_content = $this->substitute_callback_bits(
			$block_content,
			is_array( $parsed_block ) ? $parsed_block : array(),
			$block_instance instanceof WP_Block ? $block_instance : null
		);

		return $block_content;
	}

	/**
	 * Pass 1 — iAPI directive emission. Attribute-only; never touches
	 * textContent.
	 *
	 * After the attribute pass, any iAPI bit that declares `iapi.tag_name: 'a'`
	 * gets a second targeted regex pass that swaps `<span>` → `<a>` so that
	 * `data-wp-bind--href` bindings create real clickable links. Browsers silently
	 * ignore `href` on `<span>` elements, so bits that need link behaviour must
	 * be wrapped in `<a>`.
	 *
	 * `WP_HTML_Tag_Processor` cannot change the tag name; the regex is anchored
	 * to the specific `data-prc-block-bit` discriminator so it cannot mis-match
	 * unrelated spans.
	 */
	private function emit_iapi_directives( string $block_content ): string {
		$tag             = new WP_HTML_Tag_Processor( $block_content );
		$bits_needing_tag_swap = array();

		while ( $tag->next_tag( array( 'class_name' => self::MARKER_CLASS ) ) ) {
			$bit_name = $tag->get_attribute( self::NAME_ATTRIBUTE );
			if ( ! is_string( $bit_name ) ) {
				continue;
			}
			if ( Settings::is_bit_disabled( $bit_name ) ) {
				continue;
			}
			$bit = $this->registry->get( $bit_name );
			if ( null === $bit || 'iapi' !== $bit['render_strategy'] ) {
				continue;
			}

			$iapi = $bit['iapi'];
			$tag->set_attribute( 'data-wp-interactive', $iapi['namespace'] );

			if ( ! empty( $iapi['text'] ) ) {
				$tag->set_attribute( 'data-wp-text', $iapi['text'] );
			}

			if ( ! empty( $iapi['bind'] ) ) {
				foreach ( $iapi['bind'] as $attr => $state_path ) {
					if ( ! is_string( $attr ) || ! is_string( $state_path ) ) {
						continue;
					}
					$tag->set_attribute( 'data-wp-bind--' . $attr, $state_path );
				}
			}

			if ( ! empty( $iapi['context'] ) ) {
				$tag->set_attribute(
					'data-wp-context',
					(string) wp_json_encode( $iapi['context'] )
				);
			}

			// Track bits that need a tag swap after the attribute pass.
			if ( isset( $iapi['tag_name'] ) && 'span' !== $iapi['tag_name'] ) {
				$bits_needing_tag_swap[ $bit_name ] = $iapi['tag_name'];
			}
		}

		$html = $tag->get_updated_html();

		// Tag-swap pass: replace <span> with the declared tag_name for bits that
		// need it (e.g. <a> for link bits). Anchored to the specific bit name so
		// the regex cannot mis-match unrelated spans. iAPI bit spans carry only
		// plain text as inner content (default_text), so the lazy dotall match
		// stops at the correct closing tag.
		foreach ( $bits_needing_tag_swap as $bit_name => $desired_tag ) {
			$escaped_name = preg_quote( $bit_name, '~' );
			$replaced     = preg_replace(
				'~<span(\b[^>]*\bdata-prc-block-bit="' . $escaped_name . '"[^>]*)>(.*?)</span>~s',
				'<' . $desired_tag . '$1>$2</' . $desired_tag . '>',
				$html
			);
			if ( null === $replaced ) {
				wp_trigger_error(
					__METHOD__,
					sprintf(
						'preg_replace failed during iAPI tag-swap pass (PCRE error %d). Skipping swap for affected bit markup.',
						preg_last_error()
					),
					E_USER_WARNING
				);
				continue;
			}
			$html = $replaced;
		}

		return $html;
	}

	/**
	 * Pass 2 — callback strategy outer-HTML substitution.
	 *
	 * Regex-driven because `WP_HTML_Tag_Processor` exposes no public
	 * outer-HTML mutation API and `WP_HTML_Processor`'s mutation surface is
	 * still too thin in WP 6.7+ for fragment-level swaps. The marker shape
	 * is well-controlled by our editor format type — see U4 — so a
	 * targeted regex is reliable here.
	 *
	 * Nested bit markers are handled defensively: callback bits forbid
	 * emitting marker substrings in their output, and the editor's format
	 * type's `object: true` flag prevents wrapping insertions. If nesting
	 * sneaks in via paste, the regex's lazy `.*?` matches the nearest
	 * `</span>` and the outer span is rewritten first; the inner span is
	 * carried inside the outer span's match boundaries and gets dropped
	 * along with the rest of the outer span's content. We log
	 * `_doing_it_wrong()` once per request when nesting is detected.
	 */
	private function substitute_callback_bits( string $block_content, array $parsed_block, ?WP_Block $block_instance ): string {
		// Anchored on both `prc-block-bit` class and the discriminator
		// attribute. Attribute order in the source HTML is not guaranteed
		// (the editor format type ordering may vary), so we use lookahead
		// to match either order.
		$pattern = '~<span\b'
			. '(?=[^>]*\sclass=(["\'])[^"\']*\b' . self::MARKER_CLASS . '\b[^"\']*\1)'
			. '(?=[^>]*\s' . self::NAME_ATTRIBUTE . '=(["\'])([^"\']+)\2)'
			. '([^>]*)>(.*?)</span>~s';

		$registry      = $this->registry;
		$nested_logged = false;

		$result = preg_replace_callback(
			$pattern,
			function ( array $match ) use ( $registry, $parsed_block, $block_instance, &$nested_logged ): string {
				$original    = $match[0];
				$bit_name    = $match[3];
				$attr_blob   = $match[4];
				$inner_html  = $match[5];

				$bit = $registry->get( $bit_name );
				if ( null === $bit || 'callback' !== $bit['render_strategy'] ) {
					return $original;
				}

				if ( Settings::is_bit_disabled( $bit_name ) ) {
					return $original;
				}

				if ( ! $nested_logged && str_contains( $inner_html, self::MARKER_CLASS ) ) {
					$nested_logged = true;
					_doing_it_wrong(
						__CLASS__ . '::handle',
						esc_html( sprintf(
							'Nested `%s` markers detected for bit "%s". Bits cannot wrap or contain other bits; the editor format type is `object: true` to prevent this. Inner span content will be dropped.',
							self::MARKER_CLASS,
							$bit_name
						) ),
						'1.0.0'
					);
				}

				$attributes = $this->harvest_attributes( $bit, $attr_blob );

				try {
					$rendered = call_user_func(
						$bit['render_callback'],
						$attributes,
						$parsed_block,
						$block_instance
					);
				} catch ( Throwable $e ) {
					wp_trigger_error(
						__CLASS__ . '::handle',
						sprintf(
							'Bit "%s" callback threw %s: %s',
							$bit_name,
							get_class( $e ),
							$e->getMessage()
						),
						E_USER_WARNING
					);
					return $original;
				}

				if ( ! is_string( $rendered ) || '' === $rendered ) {
					return $original;
				}

				return wp_kses( $rendered, self::allowed_html() );
			},
			$block_content
		);

		if ( null === $result ) {
			wp_trigger_error(
				__METHOD__,
				sprintf(
					'preg_replace_callback failed for callback bit substitution (PCRE error %d). Returning original block content unchanged.',
					preg_last_error()
				),
				E_USER_WARNING
			);
			return $block_content;
		}

		return $result;
	}

	/**
	 * Harvest the bit's registered attributes from the span's `data-*`
	 * attribute blob. Unregistered `data-*` keys are ignored. Each value
	 * passes through type-specific sanitization.
	 *
	 * @param array  $bit       Normalized bit registration.
	 * @param string $attr_blob The chunk of HTML between `<span` and `>`.
	 * @return array<string, mixed> Sanitized attribute map keyed by the
	 *                              schema's camelCase key.
	 */
	private function harvest_attributes( array $bit, string $attr_blob ): array {
		$out = array();
		foreach ( $bit['attributes'] as $key => $def ) {
			$html_attr = 'data-' . $this->camel_to_kebab( $key );
			$pattern   = '~\s' . preg_quote( $html_attr, '~' ) . '=(["\'])([^"\']*)\1~i';
			if ( ! preg_match( $pattern, $attr_blob, $m ) ) {
				$out[ $key ] = $this->default_for_type( $def );
				continue;
			}
			$raw         = html_entity_decode( $m[2], ENT_QUOTES | ENT_HTML5, 'UTF-8' );
			$out[ $key ] = $this->sanitize_for_type( $raw, $def );
		}
		return $out;
	}

	private function sanitize_for_type( string $raw, array $def ): mixed {
		switch ( $def['type'] ) {
			case 'string':
				return sanitize_text_field( $raw );
			case 'int':
				return is_numeric( $raw ) ? (int) $raw : ( $def['default'] ?? 0 );
			case 'hex_color':
				return preg_match( '/^#[0-9a-fA-F]{3,8}$/', $raw ) ? $raw : ( $def['default'] ?? '' );
			case 'icon_name':
				return preg_match( '/^[a-z0-9_-]+$/i', $raw ) ? $raw : ( $def['default'] ?? '' );
			case 'enum':
				return in_array( $raw, $def['enum'], true ) ? $raw : ( $def['default'] ?? '' );
			default:
				return '';
		}
	}

	private function default_for_type( array $def ): mixed {
		if ( array_key_exists( 'default', $def ) ) {
			return $def['default'];
		}
		return match ( $def['type'] ) {
			'int'                                  => 0,
			'string', 'hex_color', 'icon_name', 'enum' => '',
			default                                => '',
		};
	}

	private function camel_to_kebab( string $key ): string {
		return strtolower( (string) preg_replace( '/([a-z0-9])([A-Z])/', '$1-$2', $key ) );
	}

	/**
	 * Central kses allowlist for callback bit output. Documented in
	 * `plugins/prc-block-bits/README.md`.
	 *
	 * Allows inline-text formatting + the SVG subset needed for the
	 * `icon-span` bit's rendered FontAwesome glyphs. Excludes scripts,
	 * event handlers, iframes, forms, and anything else that has no
	 * place inside a RichText surface.
	 */
	private static function allowed_html(): array {
		$global_attrs = array(
			'class'       => true,
			'id'          => true,
			'style'       => true,
			'aria-label'  => true,
			'aria-hidden' => true,
			'role'        => true,
			'title'       => true,
			'data-*'      => true,
		);

		$svg_global = array_merge(
			$global_attrs,
			array(
				'xmlns'     => true,
				'viewbox'   => true,
				'fill'      => true,
				'stroke'    => true,
				'width'     => true,
				'height'    => true,
				'd'         => true,
				'focusable' => true,
				'version'   => true,
			)
		);

		return array(
			'span'   => $global_attrs,
			'i'      => $global_attrs,
			'em'     => $global_attrs,
			'strong' => $global_attrs,
			'b'      => $global_attrs,
			'sup'    => $global_attrs,
			'sub'    => $global_attrs,
			'code'   => $global_attrs,
			'br'     => array(),
			'a'      => array_merge(
				$global_attrs,
				array(
					'href'   => true,
					'rel'    => true,
					'target' => true,
				)
			),
			'svg'    => $svg_global,
			'path'   => $svg_global,
			'circle' => array_merge( $svg_global, array( 'cx' => true, 'cy' => true, 'r' => true ) ),
			'rect'   => array_merge( $svg_global, array( 'x' => true, 'y' => true, 'rx' => true, 'ry' => true ) ),
			'line'   => array_merge( $svg_global, array( 'x1' => true, 'y1' => true, 'x2' => true, 'y2' => true ) ),
			'polygon' => array_merge( $svg_global, array( 'points' => true ) ),
			'polyline' => array_merge( $svg_global, array( 'points' => true ) ),
			'ellipse' => array_merge( $svg_global, array( 'cx' => true, 'cy' => true, 'rx' => true, 'ry' => true ) ),
			'g'      => $svg_global,
			'defs'   => $svg_global,
			'use'    => array_merge( $svg_global, array( 'href' => true, 'xlink:href' => true ) ),
			'title'  => $global_attrs,
		);
	}
}
