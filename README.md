# PRC Block Bits

> Inline-RichText "bits" registry, central render-block walker, and editor toolbar.

`prc-block-bits` provides a shared registry and a single-pass render-block walker for **bits** — small pieces of dynamic content that live **inside** a string of static text (mid-paragraph, mid-heading), inside any RichText-bearing block. It also ships an editor toolbar dropdown for inserting bits, and a v1 set of built-ins.

## Bits vs. block bindings

Use a **bit** when you need dynamic content **inside a string of static text** (mid-paragraph, mid-heading). Use **block bindings** when the **whole block's content** is dynamic. The two are not interchangeable; bits are inline-RichText, bindings are block-level.

## Public PHP API

```php
\PRC\Platform\Block_Bits\register_block_bit(
    'my-plugin/my-bit',
    array(
        'label'                => __( 'My bit', 'my-plugin' ),
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
import { registerBlockBit } from '@prc/block-bits/registry';

registerBlockBit( 'my-plugin/my-bit', {
    title: __( 'My bit' ),
    icon: someIcon,
    edit: SomeInlinePicker, // optional — only needed for attribute-bearing bits
} );
```

## Built-in bits

| Name                          | Strategy   | Description                                       |
| ----------------------------- | ---------- | ------------------------------------------------- |
| `prc-block-bits/icon-span`    | callback   | Inline icon from any registered FontAwesome library. |
| `prc-block-bits/copyright`    | callback   | `&copy; <year-or-range> <holder>`.                |

## Strategies

- **`iapi`** — declarative Interactivity API directives are emitted onto the bit's `<span>` (`data-wp-interactive`, `data-wp-text`, `data-wp-bind--*`, optional `data-wp-context`). Cross-context fallback: if the iAPI namespace isn't mounted on the page, the editor-written `default_text` persists as visible textContent.
- **`callback`** — pure-PHP `render_callback` returns a string that replaces the bit's `<span>` outer HTML. Callbacks run inside a try/catch wrapper and their output passes through a central `wp_kses()` allowlist before substitution.

## Walker

A single late-priority `render_block` filter (priority `100`) with a mandatory `str_contains( $content, 'prc-block-bit' )` early-exit, followed by a `WP_HTML_Tag_Processor` walk for iAPI bits and a `WP_HTML_Processor`-backed pass for callback bits.
