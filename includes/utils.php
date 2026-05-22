<?php
/**
 * Utility functions.
 *
 * Public helpers for consumer plugins.
 *
 * @package PRC\Platform\Block_Bits
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits;

/**
 * Register a bit on the platform-wide registry.
 *
 * Bit names follow `<namespace>/<bit-kebab>` (e.g. `prc-block-bits/icon-span`).
 * The full `$args` shape is documented in `plugins/prc-block-bits/README.md`.
 *
 * Returns `true` on success, `false` on validation failure or duplicate name
 * (a `_doing_it_wrong()` notice fires in either failure case so the dev sees
 * the issue immediately, but the page renders without breaking in prod).
 *
 * Outside the platform monorepo, callers should guard with
 * `function_exists( '\PRC\Platform\Block_Bits\register_block_bit' )` before
 * calling, since the bits plugin may not be active.
 *
 * @param string $name Bit name in `<namespace>/<bit-kebab>` form.
 * @param array  $args Bit arguments. See README for the schema.
 */
function register_block_bit( string $name, array $args ): bool {
	return Registry::instance()->add( $name, $args );
}

/**
 * Look up a registered bit's normalized $args.
 *
 * @return array|null Normalized registration, or null if not registered.
 */
function get_block_bit( string $name ): ?array {
	return Registry::instance()->get( $name );
}

/**
 * Get all registered bits whose `allowed_block_types` includes the given
 * block name (or that declare no restriction).
 *
 * @return array<string, array>
 */
function get_block_bits_applicable_to( string $block_name ): array {
	return Registry::instance()->applicable_to( $block_name );
}
