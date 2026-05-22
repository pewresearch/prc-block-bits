/**
 * Editor-side bits registry.
 *
 * Module-level `Map<string, BitDescriptor>` (intentionally NOT a
 * `@wordpress/data` store). The access pattern is static-init-time read-only
 * data with no reactivity needs at v1 scale; the data-store ceremony is YAGNI.
 *
 * `hydrateFromWindow()` pulls the PHP-projected payload off
 * `window.prcBlockBits.bits` once at editor boot. Editor-only descriptors
 * (custom `icon` component, `edit` component) overlay the server projection
 * via `registerBlockBit()` calls from individual bit modules.
 */

export type AttributeType =
	| 'string'
	| 'int'
	| 'hex_color'
	| 'icon_name'
	| 'enum';

export interface BitAttributeSchema {
	type: AttributeType;
	default?: unknown;
	enum?: string[];
}

/**
 * Shape of the projected payload PHP localizes onto
 * `window.prcBlockBits.bits[bitName]`. Mirrors the explicit allowlist in
 * `Assets::project_bit_for_editor()` — `render_callback`, `iapi`, and other
 * server-only fields are stripped at projection time.
 */
export interface ServerBitProjection {
	label: string;
	title: string;
	iconSlug: string | null;
	/** Optional grouping key used in the modal picker when > MODAL_THRESHOLD bits are registered. */
	category?: string;
	allowedBlockTypes: string[];
	attributes: Record<string, BitAttributeSchema>;
	defaultText: string;
}

/**
 * Props passed to a bit's optional `edit` component when the user picks the
 * bit from the toolbar dropdown (fresh insert) or clicks "Edit" in the
 * BitPopover (re-mount on an existing bit).
 *
 * - `attributes` is the camelCase attribute map sourced from the active
 *   format's `unregisteredAttributes` / object-format attributes (read each
 *   render — no `useState` mirror).
 * - `innerHTML` is the bit's current default-text fallback in the editor.
 * - `onCommit` runs the `removeFormat` + `insertObject` recipe; bits should
 *   pass the user-edited attribute map.
 * - `onCancel` dismisses the popover and returns focus to the anchor.
 */
export interface BitEditProps {
	bit: BitDescriptor;
	attributes: Record<string, string>;
	innerHTML: string;
	onCommit: (next: {
		attributes: Record<string, string>;
		innerHTML?: string;
	}) => void;
	onCancel: () => void;
}

export type BitEditComponent = (props: BitEditProps) => JSX.Element | null;

export interface BitDescriptor extends ServerBitProjection {
	name: string;
	icon?: unknown;
	edit?: BitEditComponent;
}

/** Fallback category label used in the modal when a bit has no declared category. */
export const UNCATEGORIZED_LABEL = 'General';

declare global {
	interface Window {
		prcBlockBits?: {
			bits?: Record<string, ServerBitProjection>;
			/**
			 * Base URL for sprite SVG files (trailing slash), e.g.
			 * `https://example.com/wp-content/plugins/prc-icon-library/build/icons/sprites/`
			 * Provided by `Assets::build_localized_payload()` when the
			 * `prc-icon-library` plugin is active and `PRC_PLATFORM_ICONS_URL`
			 * is defined.
			 */
			iconSpritesUrl?: string;
		};
	}
}

const bits = new Map<string, BitDescriptor>();

/**
 * Register or overlay a bit descriptor.
 *
 * Called twice per bit at boot: once by `hydrateFromWindow()` (server
 * projection), and optionally again by the bit's editor module to attach an
 * `edit` component or a custom icon component. Later calls merge over earlier
 * ones — the editor overlay wins for `icon`/`edit`/`title`, and the server
 * projection remains the source of truth for `allowedBlockTypes`/`attributes`/
 * `defaultText` unless explicitly overridden.
 *
 * @param name       Bit name in `<namespace>/<bit-kebab>` form.
 * @param descriptor Partial descriptor; merged over any existing entry.
 */
export function registerBlockBit(
	name: string,
	descriptor: Partial<BitDescriptor>
): void {
	// If PHP projected a bits payload (editor context) and this name isn't in
	// it, the bit was disabled via Settings. Don't create a Map entry for
	// overlay calls from builtin register functions.
	const existing = bits.get(name);
	const projected = window.prcBlockBits?.bits;
	if (projected && !projected[name] && !existing) {
		return;
	}

	bits.set(name, {
		name,
		label: descriptor.label ?? existing?.label ?? name,
		title: descriptor.title ?? existing?.title ?? existing?.label ?? name,
		iconSlug: descriptor.iconSlug ?? existing?.iconSlug ?? null,
		category: descriptor.category ?? existing?.category,
		allowedBlockTypes:
			descriptor.allowedBlockTypes ?? existing?.allowedBlockTypes ?? [],
		attributes: descriptor.attributes ?? existing?.attributes ?? {},
		defaultText: descriptor.defaultText ?? existing?.defaultText ?? '',
		icon: descriptor.icon ?? existing?.icon,
		edit: descriptor.edit ?? existing?.edit,
	});
}

export function getBlockBit(name: string): BitDescriptor | undefined {
	return bits.get(name);
}

export function getAllBlockBits(): BitDescriptor[] {
	return Array.from(bits.values());
}

/**
 * Bits whose `allowedBlockTypes` includes `blockName` (or that declare no
 * restriction — empty array means "any block").
 *
 * @param blockName Block name to filter by (e.g. `core/paragraph`).
 */
export function getBitsApplicableTo(blockName: string): BitDescriptor[] {
	const out: BitDescriptor[] = [];
	for (const bit of bits.values()) {
		if (
			bit.allowedBlockTypes.length === 0 ||
			bit.allowedBlockTypes.includes(blockName)
		) {
			out.push(bit);
		}
	}
	return out;
}

/**
 * Return bits applicable to `blockName` grouped by category into an ordered
 * `Map<categoryLabel, BitDescriptor[]>`. Bits without a `category` fall into
 * the `UNCATEGORIZED_LABEL` ("General") bucket, which is always appended last.
 *
 * @param blockName Block name to filter by (e.g. `core/paragraph`).
 */
export function getBitsGroupedByCategory(
	blockName: string
): Map<string, BitDescriptor[]> {
	const applicable = getBitsApplicableTo(blockName);
	const groups = new Map<string, BitDescriptor[]>();
	const uncategorized: BitDescriptor[] = [];

	for (const bit of applicable) {
		if (bit.category) {
			const existing = groups.get(bit.category);
			if (existing) {
				existing.push(bit);
			} else {
				groups.set(bit.category, [bit]);
			}
		} else {
			uncategorized.push(bit);
		}
	}

	if (uncategorized.length > 0) {
		const existing = groups.get(UNCATEGORIZED_LABEL);
		if (existing) {
			existing.push(...uncategorized);
		} else {
			groups.set(UNCATEGORIZED_LABEL, uncategorized);
		}
	}

	return groups;
}

/**
 * Pull the PHP-projected bits off `window.prcBlockBits.bits` and seed the
 * registry. Idempotent — calling twice is safe.
 */
export function hydrateFromWindow(): void {
	const projected = window.prcBlockBits?.bits;
	if (!projected || typeof projected !== 'object') {
		return;
	}
	for (const [name, payload] of Object.entries(projected)) {
		registerBlockBit(name, payload as Partial<BitDescriptor>);
	}
}

/**
 * Test-only — never call in production.
 *
 * @internal
 */
export function resetRegistry(): void {
	bits.clear();
}
