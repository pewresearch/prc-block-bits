<?php
/**
 * `copyright` built-in bit.
 *
 * @package PRC\Platform\Block_Bits\Bits
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits\Bits;

use WP_Block;

use function PRC\Platform\Block_Bits\register_block_bit;

/**
 * `prc-block-bits/copyright` — inline copyright statement rendered at request
 * time so the year tracks `gmdate( 'Y' )` without baking a stale year into
 * the editor-saved markup.
 *
 * Render strategy: `callback`. The walker substitutes the empty bit span
 * saved by the editor with the output of {@see Copyright::render()}.
 *
 * Behavior is lifted verbatim from the legacy
 * `\PRC\Platform\Blocks\Copyright::copyright()` static method (see
 * `plugins/prc-block-library/includes/block-bits/class-block-bits.php:53-69`).
 *
 * Cache safety note: `gmdate( 'Y' )` is request-deterministic at year-level
 * resolution — output only flips at midnight UTC on a year boundary, which
 * is acceptable for edge-cached pages. `default_text` stays `''` so no stale
 * year is captured in editor-saved HTML.
 */
class Copyright {

	public const NAME = 'prc-block-bits/copyright';

	private const ALLOWED_BLOCK_TYPES = array(
		'core/paragraph',
		'core/heading',
		'core/list-item',
	);

	private const DEFAULT_HOLDER = 'Pew Research Center';

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
				'label'               => __( 'Copyright', 'prc-block-bits' ),
				'allowed_block_types' => self::ALLOWED_BLOCK_TYPES,
				'attributes'          => array(
					'startYear' => array(
						'type'    => 'int',
						'default' => 0,
					),
					'holder'    => array(
						'type'    => 'string',
						'default' => '',
					),
				),
				'render_strategy'     => 'callback',
				'render_callback'     => array( $this, 'render' ),
				// Empty — the rendered span's textContent depends on
				// `gmdate( 'Y' )` at render time. Baking a year into the
				// editor-saved markup would silently drift.
				'default_text'        => '',
			)
		);
	}

	/**
	 * Render callback. Behavior matches the legacy
	 * `Block_Bits\Copyright::copyright()` exactly.
	 *
	 * The walker's per-attribute harvest coerces `startYear` to int via the
	 * `'type' => 'int'` schema; we still defend against a 0 default and
	 * future years here so the suppression of the range stays explicit per
	 * the U6 edge-case scenarios.
	 *
	 * @param array         $attributes      Sanitized attribute map (camelCase keys).
	 * @param array         $parsed_block    The parsed parent block.
	 * @param WP_Block|null $block_instance  Block instance (or null on legacy paths).
	 */
	public function render( array $attributes, array $parsed_block = array(), ?WP_Block $block_instance = null ): string {
		unset( $parsed_block, $block_instance );

		$year = gmdate( 'Y' );
		if (
			isset( $attributes['startYear'] )
			&& is_numeric( $attributes['startYear'] )
			&& (int) $attributes['startYear'] > 0
			&& (int) $attributes['startYear'] < (int) $year
		) {
			$year = (int) $attributes['startYear'] . ' - ' . $year;
		}

		$holder_raw = isset( $attributes['holder'] ) ? (string) $attributes['holder'] : '';
		$holder     = '' !== $holder_raw ? $holder_raw : self::DEFAULT_HOLDER;

		return sprintf(
			'<span class="prc-block-bit prc-block-bit-copyright" data-prc-block-bit="%1$s">&copy; %2$s %3$s</span>',
			esc_attr( self::NAME ),
			esc_html( (string) $year ),
			esc_html( $holder )
		);
	}
}
