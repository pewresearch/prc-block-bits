<?php
/**
 * Plugin loader.
 *
 * @package PRC\Platform\Block_Bits
 */

declare(strict_types=1);

namespace PRC\Platform\Block_Bits;

/**
 * Maintains and registers all hooks for the plugin.
 */
class Loader {

	/**
	 * The array of actions registered with WordPress.
	 *
	 * @var array
	 */
	protected array $actions;

	/**
	 * The array of filters registered with WordPress.
	 *
	 * @var array
	 */
	protected array $filters;

	public function __construct() {
		$this->actions = array();
		$this->filters = array();
	}

	/**
	 * Add a new action to the collection to be registered with WordPress.
	 *
	 * @param string $hook          The action name.
	 * @param object $component     The instance providing the callback.
	 * @param string $callback      The method name on $component.
	 * @param int    $priority      The priority. Default 10.
	 * @param int    $accepted_args The argument count. Default 1.
	 */
	public function add_action( string $hook, object $component, string $callback, int $priority = 10, int $accepted_args = 1 ): void {
		$this->actions = $this->add( $this->actions, $hook, $component, $callback, $priority, $accepted_args );
	}

	/**
	 * Add a new filter to the collection to be registered with WordPress.
	 *
	 * @param string $hook          The filter name.
	 * @param object $component     The instance providing the callback.
	 * @param string $callback      The method name on $component.
	 * @param int    $priority      The priority. Default 10.
	 * @param int    $accepted_args The argument count. Default 1.
	 */
	public function add_filter( string $hook, object $component, string $callback, int $priority = 10, int $accepted_args = 1 ): void {
		$this->filters = $this->add( $this->filters, $hook, $component, $callback, $priority, $accepted_args );
	}

	private function add( array $hooks, string $hook, object $component, string $callback, int $priority, int $accepted_args ): array {
		$hooks[] = array(
			'hook'          => $hook,
			'component'     => $component,
			'callback'      => $callback,
			'priority'      => $priority,
			'accepted_args' => $accepted_args,
		);
		return $hooks;
	}

	/**
	 * Register the filters and actions with WordPress.
	 */
	public function run(): void {
		foreach ( $this->filters as $hook ) {
			add_filter( $hook['hook'], array( $hook['component'], $hook['callback'] ), $hook['priority'], $hook['accepted_args'] );
		}
		foreach ( $this->actions as $hook ) {
			add_action( $hook['hook'], array( $hook['component'], $hook['callback'] ), $hook['priority'], $hook['accepted_args'] );
		}
	}
}
