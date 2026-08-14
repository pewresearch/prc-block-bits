# PRC Block Bits

> Canonical docs: [docs/plugins/prc-block-bits/](../../docs/plugins/prc-block-bits/)

> Inline-RichText "bits" registry, central render-block walker, and editor toolbar.

`prc-block-bits` provides a shared registry and a single-pass render-block walker for **bits** — small pieces of dynamic content that live **inside** a string of static text (mid-paragraph, mid-heading), inside any RichText-bearing block. It also ships an editor toolbar for inserting bits and a set of built-in bits.

For agent-oriented architecture and third-party registration steps, see [AGENTS.md](AGENTS.md).

## Bits vs. block bindings

Use a **bit** when you need dynamic content **inside a string of static text** (mid-paragraph, mid-heading). Use **block bindings** when the **whole block's content** is dynamic. The two are not interchangeable; bits are inline-RichText, bindings are block-level.

## Built-in bits

These bits register on `init` (priority `11`) from `includes/bits/` and are always available when the plugin is active (unless disabled in **Settings → Block Bits**).

| Name | Strategy | Blocks | Description |
| --- | --- | --- | --- |
| `prc-block-bits/icon-span` | `callback` | `core/paragraph`, `core/heading`, `core/list-item` | Inline Font Awesome sprite icon (`data-icon-library`, `data-icon-name`, optional color/position). Editor uses `IconPicker` from `@prc/components`. |
| `prc-block-bits/copyright` | `callback` | `core/paragraph`, `core/heading`, `core/list-item` | `© <year-or-range> <holder>` rendered at request time (`gmdate` for current year; optional `startYear`, `holder` attributes). |
| `prc-block-bits/shareable-text` | `callback` | All RichText blocks (`allowed_block_types` empty) | Social share link (Twitter/X, Facebook, Threads, Bluesky) with `shareText`, optional `displayText`, and `platform` attributes. |

All three use an **`edit`** component in the editor (attribute picker before insert). Implementation lives under `src/editor/builtins/`.

Third-party plugins register additional bits via `register_block_bit()` — see [AGENTS.md](AGENTS.md) and the examples in `prc-quiz-political-typology-2026`.

## Icon library provider

The **icon-span** bit (and the shareable-text bit’s brand icons on the frontend) depend on the platform **sprite-based icon stack**, not on a separate block-bits API.

### Default setup

1. Activate **`prc-icon-library`** — defines `PRC_PLATFORM_ICONS_URL` and `PRC_PLATFORM_ICONS_PATH` pointing at `build/icons/sprites/` (one `{library}.svg` sprite per style).
2. **`prc-scripts`** exposes `\PRC\Platform\Icons\get_icon_as_url( $library, $icon )`, which resolves URLs as `{PRC_PLATFORM_ICONS_URL}{library}.svg#{icon}`.
3. **`prc-block-bits`** localizes `window.prcBlockBits.iconSpritesUrl` (same base URL) for editor sprite previews on icon-span bits.
4. The icon-span **picker** uses `IconPicker` → `@prc/icons` **`IconLibraryIndex`** (JSON index of symbol IDs per library, built from those sprites).

See [prc-icon-library/README.md](../prc-icon-library/README.md) for sprite libraries, build steps, and render helpers.

### Wiring a custom icon library

To serve icons from your own plugin (or replace the default sprites):

1. **Expose sprite files** — Host SVG sprites that follow the same shape: one file per library name (e.g. `my-lib.svg`) with `<symbol id="icon-name">` entries. Icons are referenced as `{baseUrl}my-lib.svg#icon-name`.

2. **Define the platform constants** (typically in your plugin’s main file, on load):

   ```php
   define( 'PRC_PLATFORM_ICONS_URL', plugin_dir_url( __FILE__ ) . 'assets/icons/sprites/' );
   define( 'PRC_PLATFORM_ICONS_PATH', plugin_dir_path( __FILE__ ) . 'assets/icons/sprites/' );
   ```

   Load **before** icon rendering runs. If `PRC_PLATFORM_ICONS_URL` is undefined, `get_icon_as_url()` returns an HTML comment and icon-span renders an empty span.

3. **Editor index** — Regenerate `@prc/icons`’s `icon-library-index.json` so `IconPicker` lists your libraries and icon names:

   ```bash
   # Point build-index at your sprites directory, or copy sprites into
   # plugins/prc-icon-library/build/icons/sprites/ and run:
   node plugins/prc-scripts/includes/scripts/src/@prc/icons/bin/build-index.js
   npx turbo build --filter=@prc/icons
   ```

   The build script reads every `*.svg` in the sprites folder and maps `library → [ symbol ids ]`.

4. **PHP render allowlist** — If you use `\PRC\Platform\Icons\render()` directly, add your library slug to `$available_libraries` in `plugins/prc-scripts/includes/utils.php` (icon-span itself only calls `get_icon_as_url()`, which does not enforce that list).

5. **Optional: override editor sprite base** — `Assets` sets `window.prcBlockBits.iconSpritesUrl` from `PRC_PLATFORM_ICONS_URL` when defined. Icon-span editor preview falls back to `/wp-content/plugins/prc-icon-library/build/icons/sprites/` only when the constant is missing; defining the constant from your provider is the supported path.

**Same-origin note:** Sprite `<use href="…">` references must be same-origin with the page. Serve sprites from the site’s domain (or a CDN configured as same-origin).

## Public PHP API

```php
\PRC\Platform\Block_Bits\register_block_bit(
    'my-plugin/my-bit',
    array(
        'label'                => __( 'My bit', 'my-plugin' ),
        'category'             => 'Quiz', // optional; groups bits in the modal picker
        'allowed_block_types'  => array( 'core/paragraph', 'core/heading' ),
        'attributes'           => array(
            // Per-attribute schema. `type` is one of:
            //   'string' | 'int' | 'hex_color' | 'icon_name' | 'enum' | …
            // Used by the walker for harvest-time sanitization.
            'icon-name' => array( 'type' => 'icon_name' ),
        ),
        'render_strategy'      => 'callback', // 'iapi' | 'callback'
        'render_callback'      => function ( array $attrs, array $parsed_block, ?\WP_Block $block ): string {
            return '<span class="prc-block-bit">' . esc_html( $attrs['icon-name'] ?? '' ) . '</span>';
        },
        'default_text'         => 'fallback', // request-deterministic; see below.
    )
);
```

**`default_text` MUST be request-deterministic.** It must resolve to the same string for every request to a given URL — no `current_user_can()`, no `wp_get_current_user()`, no time-of-day variation. The edge cache treats the rendered HTML as cacheable; per-user fallback text would poison shared cache entries. The registry rejects callable `default_text` values, and `WP_DEBUG` runtime checks fire `_doing_it_wrong()` on per-user variance.

## Public JS API

```ts
import { registerBlockBit } from '@prc/block-bits';

registerBlockBit( 'my-plugin/my-bit', {
    title: __( 'My bit', 'my-plugin' ),
    icon: someIcon,
    edit: SomeInlinePicker, // optional — only needed for attribute-bearing bits
} );
```

In the monorepo, import `@prc/block-bits` from a bundle built with the **root** `webpack.config.js` so dependency extraction resolves the `prc-block-bits-editor` script handle.

## Strategies

- **`iapi`** — declarative Interactivity API directives are emitted onto the bit's `<span>` (`data-wp-interactive`, `data-wp-text`, `data-wp-bind--*`, optional `data-wp-context`). Cross-context fallback: if the iAPI namespace isn't mounted on the page, the editor-written `default_text` persists as visible textContent.
- **`callback`** — pure-PHP `render_callback` returns a string that replaces the bit's `<span>` outer HTML. Callbacks run inside a try/catch wrapper and their output passes through a central `wp_kses()` allowlist before substitution.

## Walker

A single late-priority `render_block` filter (priority `100`) with a mandatory `str_contains( $content, 'prc-block-bit' )` early-exit, followed by a `WP_HTML_Tag_Processor` walk for iAPI bits and a `WP_HTML_Processor`-backed pass for callback bits.

## Editor picker

When more than five bits apply to the current block, the toolbar opens a **modal** with category groups and a search field. Uncategorized bits appear under **General**. Bits can be disabled site-wide under **Settings → Block Bits**.
