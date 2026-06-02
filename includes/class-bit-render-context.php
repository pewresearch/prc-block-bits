<?php
/**
 * Request-scoped render context for callback bits.
 *
 * @package PRC\Platform\Block_Bits
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits;

/**
 * Static, request-scoped key/value store that lets a caller pass dynamic
 * "merge field" data into callback bits at render time.
 *
 * The canonical use case is the newsletter builder's dynamic-recipient system
 * email: before rendering a newsletter template for a single recipient, the
 * sender sets the recipient-specific values (e.g. the quiz group name), runs
 * `do_blocks()` so the Walker resolves callback bits with that data, then
 * clears the context.
 *
 * Cache-safety: this context is set and cleared within a single PHP request
 * (typically a non-cached REST/CLI send path) and never persists. Callback
 * bits that read it MUST still provide a request-deterministic fallback for
 * the no-context case (front-end views, editor, edge-cached pages) so the
 * VIP edge cache is never poisoned with per-user values. See R10a in the
 * plugin README.
 */
class Bit_Render_Context {

	/**
	 * The active context map. Keyed by merge-field slug.
	 *
	 * @var array<string, mixed>
	 */
	private static array $context = array();

	/**
	 * Whether a context is currently active. Distinguishes "no key" from
	 * "context not set at all" for callers that branch on render mode.
	 */
	private static bool $active = false;

	/**
	 * Replace the active context.
	 *
	 * @param array<string, mixed> $context Merge-field map.
	 */
	public static function set( array $context ): void {
		self::$context = $context;
		self::$active  = true;
	}

	/**
	 * Read a single value from the active context.
	 *
	 * @param string $key     Merge-field slug.
	 * @param mixed  $default Returned when the key is absent.
	 * @return mixed
	 */
	public static function get( string $key, mixed $default = null ): mixed {
		return self::$context[ $key ] ?? $default;
	}

	/**
	 * Whether a key is present in the active context.
	 */
	public static function has( string $key ): bool {
		return array_key_exists( $key, self::$context );
	}

	/**
	 * The full active context map.
	 *
	 * @return array<string, mixed>
	 */
	public static function all(): array {
		return self::$context;
	}

	/**
	 * Whether a render context is currently active (set and not yet cleared).
	 */
	public static function is_active(): bool {
		return self::$active;
	}

	/**
	 * Clear the active context. Always call this after the render that
	 * consumed the context, ideally in a finally block.
	 */
	public static function clear(): void {
		self::$context = array();
		self::$active  = false;
	}
}
