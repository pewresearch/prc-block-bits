<?php
/**
 * Bits registry.
 *
 * @package PRC\Platform\Block_Bits
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits;

/**
 * Singleton registry of registered bits.
 *
 * Stores registrations keyed by `<namespace>/<bit-kebab>`. Supports lookup by
 * name, enumeration, and filtering by parent block name.
 *
 * Keep this class small and synchronous — `register_block_bit()` is called
 * many times on `init` from many plugins; expensive validation here taxes
 * every page load.
 */
class Registry {

	/**
	 * Bit name format: `<namespace>/<bit-kebab>` where each segment is
	 * lowercase alphanumeric + dashes.
	 */
	private const NAME_PATTERN = '#^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$#';

	private const VALID_STRATEGIES = array( 'iapi', 'callback' );

	private const VALID_ATTRIBUTE_TYPES = array( 'string', 'int', 'hex_color', 'icon_name', 'enum' );

	private static ?self $instance = null;

	/**
	 * Map of bit name → normalized $args.
	 *
	 * @var array<string, array>
	 */
	private array $bits = array();

	/**
	 * Map of bit name → file path that called register_block_bit() first
	 * (for collision diagnostics).
	 *
	 * @var array<string, string>
	 */
	private array $sources = array();

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Register a bit.
	 *
	 * Returns false (with a `_doing_it_wrong()` notice) on validation failure
	 * or if the name is already registered. Validation failures are
	 * dev-time-loud, prod-time-soft.
	 *
	 * @param string $name Bit name in `<namespace>/<bit-kebab>` form.
	 * @param array  $args Bit arguments. See README for the full schema.
	 */
	public function add( string $name, array $args ): bool {
		$source = $this->caller_file();

		if ( ! preg_match( self::NAME_PATTERN, $name ) ) {
			$this->doing_it_wrong(
				sprintf( 'Invalid bit name "%s". Expected `<namespace>/<bit-kebab>`.', $name ),
				$source
			);
			return false;
		}

		if ( isset( $this->bits[ $name ] ) ) {
			$this->doing_it_wrong(
				sprintf(
					'Bit "%s" is already registered (first registration: %s; rejected: %s). First registration wins.',
					$name,
					$this->sources[ $name ] ?? 'unknown',
					$source
				),
				$source
			);
			return false;
		}

		$normalized = $this->validate( $name, $args, $source );
		if ( null === $normalized ) {
			return false;
		}

		$this->bits[ $name ]    = $normalized;
		$this->sources[ $name ] = $source;
		return true;
	}

	public function get( string $name ): ?array {
		return $this->bits[ $name ] ?? null;
	}

	/**
	 * @return array<string, array> All registered bits, keyed by name.
	 */
	public function all(): array {
		return $this->bits;
	}

	/**
	 * Bits whose `allowed_block_types` includes `$block_name`, or that
	 * declare no restriction (empty array means "all blocks").
	 *
	 * @return array<string, array>
	 */
	public function applicable_to( string $block_name ): array {
		$out = array();
		foreach ( $this->bits as $name => $args ) {
			$allowed = $args['allowed_block_types'];
			if ( empty( $allowed ) || in_array( $block_name, $allowed, true ) ) {
				$out[ $name ] = $args;
			}
		}
		return $out;
	}

	/**
	 * Reset the registry. Test-only — never call in production.
	 *
	 * @internal
	 */
	public function reset(): void {
		$this->bits    = array();
		$this->sources = array();
	}

	/**
	 * Validate + normalize $args. Returns the normalized array on success or
	 * null on failure (after firing _doing_it_wrong()).
	 */
	private function validate( string $name, array $args, string $source ): ?array {
		$label = $args['label'] ?? null;
		if ( ! is_string( $label ) || '' === $label ) {
			$this->doing_it_wrong(
				sprintf( 'Bit "%s" requires a non-empty `label` (string).', $name ),
				$source
			);
			return null;
		}

		$strategy = $args['render_strategy'] ?? null;
		if ( ! in_array( $strategy, self::VALID_STRATEGIES, true ) ) {
			$this->doing_it_wrong(
				sprintf(
					'Bit "%s" must declare `render_strategy` as one of: %s. Got: %s.',
					$name,
					implode( ', ', self::VALID_STRATEGIES ),
					var_export( $strategy, true )
				),
				$source
			);
			return null;
		}

		$normalized = array(
			'name'                => $name,
			'label'               => $label,
			'render_strategy'     => $strategy,
			'category'            => null,
			'allowed_block_types' => array(),
			'attributes'          => array(),
			'default_text'        => '',
			'aria_label'          => null,
			'iapi'                => null,
			'render_callback'     => null,
		);

		if ( isset( $args['allowed_block_types'] ) ) {
			if ( ! is_array( $args['allowed_block_types'] ) ) {
				$this->doing_it_wrong(
					sprintf( 'Bit "%s": `allowed_block_types` must be an array of block names.', $name ),
					$source
				);
				return null;
			}
			$normalized['allowed_block_types'] = array_values(
				array_filter( $args['allowed_block_types'], 'is_string' )
			);
		}

		if ( isset( $args['attributes'] ) ) {
			if ( ! is_array( $args['attributes'] ) ) {
				$this->doing_it_wrong(
					sprintf( 'Bit "%s": `attributes` must be an array.', $name ),
					$source
				);
				return null;
			}
			foreach ( $args['attributes'] as $attr_key => $attr_def ) {
				if ( ! is_string( $attr_key ) || ! is_array( $attr_def ) ) {
					$this->doing_it_wrong(
						sprintf( 'Bit "%s": each `attributes` entry must be a string key mapping to an array.', $name ),
						$source
					);
					return null;
				}
				$type = $attr_def['type'] ?? null;
				if ( ! in_array( $type, self::VALID_ATTRIBUTE_TYPES, true ) ) {
					$this->doing_it_wrong(
						sprintf(
							'Bit "%s" attribute "%s": `type` must be one of: %s. Got: %s.',
							$name,
							$attr_key,
							implode( ', ', self::VALID_ATTRIBUTE_TYPES ),
							var_export( $type, true )
						),
						$source
					);
					return null;
				}
				if ( 'enum' === $type && ( ! isset( $attr_def['enum'] ) || ! is_array( $attr_def['enum'] ) || empty( $attr_def['enum'] ) ) ) {
					$this->doing_it_wrong(
						sprintf( 'Bit "%s" attribute "%s": enum type requires an `enum` array of allowed values.', $name, $attr_key ),
						$source
					);
					return null;
				}
				$normalized['attributes'][ $attr_key ] = $attr_def;
			}
		}

		if ( isset( $args['default_text'] ) ) {
			// Check is_string first: PHP's is_callable() returns true for any string
			// that matches a built-in function name (e.g., 'date', 'sort', 'key').
			// Checking !is_string() first prevents those legitimate string values from
			// being incorrectly rejected as callables.
			if ( ! is_string( $args['default_text'] ) && is_callable( $args['default_text'] ) ) {
				$this->doing_it_wrong(
					sprintf(
						'Bit "%s": `default_text` must be a literal string, not a callable. Per-user fallback text would poison the edge cache.',
						$name
					),
					$source
				);
				return null;
			}
			if ( ! is_string( $args['default_text'] ) ) {
				$this->doing_it_wrong(
					sprintf( 'Bit "%s": `default_text` must be a string.', $name ),
					$source
				);
				return null;
			}
			$normalized['default_text'] = $args['default_text'];
		}

		if ( isset( $args['aria_label'] ) ) {
			if ( ! is_string( $args['aria_label'] ) ) {
				$this->doing_it_wrong(
					sprintf( 'Bit "%s": `aria_label` must be a string when set.', $name ),
					$source
				);
				return null;
			}
			$normalized['aria_label'] = $args['aria_label'];
		}

		if ( isset( $args['category'] ) ) {
			if ( ! is_string( $args['category'] ) ) {
				$this->doing_it_wrong(
					sprintf( 'Bit "%s": `category` must be a string when set.', $name ),
					$source
				);
				return null;
			}
			$category = sanitize_text_field( $args['category'] );
			if ( '' === $category ) {
				$this->doing_it_wrong(
					sprintf( 'Bit "%s": `category` must be a non-empty string when set.', $name ),
					$source
				);
				return null;
			}
			$normalized['category'] = $category;
		}

		if ( 'iapi' === $strategy ) {
			$iapi = $args['iapi'] ?? null;
			if ( ! is_array( $iapi ) || empty( $iapi['namespace'] ) || ! is_string( $iapi['namespace'] ) ) {
				$this->doing_it_wrong(
					sprintf( 'Bit "%s": iAPI strategy requires `iapi.namespace` (non-empty string).', $name ),
					$source
				);
				return null;
			}
			if ( empty( $iapi['text'] ) && empty( $iapi['bind'] ) ) {
				$this->doing_it_wrong(
					sprintf( 'Bit "%s": iAPI strategy requires at least one of `iapi.text` or `iapi.bind`.', $name ),
					$source
				);
				return null;
			}
			// Validate optional tag_name — allows iAPI bits to declare an <a> wrapper
			// so href-bindings create clickable links (browsers ignore href on <span>).
			$valid_tag_names = array( 'span', 'a' );
			$tag_name        = isset( $iapi['tag_name'] ) && in_array( $iapi['tag_name'], $valid_tag_names, true )
				? $iapi['tag_name']
				: 'span';

			$normalized['iapi'] = array(
				'namespace'     => $iapi['namespace'],
				'text'          => isset( $iapi['text'] ) && is_string( $iapi['text'] ) ? $iapi['text'] : null,
				'bind'          => isset( $iapi['bind'] ) && is_array( $iapi['bind'] ) ? $iapi['bind'] : array(),
				'context'       => isset( $iapi['context'] ) && is_array( $iapi['context'] ) ? $iapi['context'] : null,
				'context_merge' => isset( $iapi['context_merge'] ) && is_array( $iapi['context_merge'] ) ? $iapi['context_merge'] : null,
				'default_text'  => isset( $iapi['default_text'] ) && is_string( $iapi['default_text'] ) ? $iapi['default_text'] : $normalized['default_text'],
				'tag_name'      => $tag_name,
			);
		}

		if ( 'callback' === $strategy ) {
			$callback = $args['render_callback'] ?? null;
			if ( ! is_callable( $callback ) ) {
				$this->doing_it_wrong(
					sprintf( 'Bit "%s": callback strategy requires a callable `render_callback`.', $name ),
					$source
				);
				return null;
			}
			$normalized['render_callback'] = $callback;
		}

		return $normalized;
	}

	/**
	 * Best-effort caller file path for collision diagnostics.
	 */
	private function caller_file(): string {
		$trace = debug_backtrace( DEBUG_BACKTRACE_IGNORE_ARGS, 5 ); //phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_debug_backtrace
		foreach ( $trace as $frame ) {
			if ( ! isset( $frame['file'] ) ) {
				continue;
			}
			$file = $frame['file'];
			if ( str_ends_with( $file, 'class-registry.php' ) ) {
				continue;
			}
			if ( str_ends_with( $file, 'utils.php' ) && str_contains( $file, 'prc-block-bits' ) ) {
				continue;
			}
			return $file;
		}
		return 'unknown';
	}

	private function doing_it_wrong( string $message, string $source ): void {
		_doing_it_wrong(
			'PRC\\Platform\\Block_Bits\\register_block_bit',
			esc_html( $message . ' (source: ' . $source . ')' ),
			'1.0.0'
		);
	}

	/**
	 * Singletons can't be instantiated externally.
	 */
	private function __construct() {}
}
