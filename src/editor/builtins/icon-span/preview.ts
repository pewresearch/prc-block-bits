/**
 * Editor-side sprite preview for `prc-block-bits/icon-span`.
 *
 * The saved `post_content` for an icon-span bit carries only the data
 * attributes and `%icon%` as the innerHTML placeholder — no SVG. The PHP
 * walker's callback strategy replaces the entire span at render time, so the
 * placeholder never reaches the frontend.
 *
 * This module injects a sprite-reference `<svg><use>` into the *live editor
 * DOM* so authors see the picked icon while editing. The SVG is built via the
 * DOM API (createElementNS + setAttribute) — no HTML string interpolation,
 * zero XSS surface.
 *
 * Design notes:
 *
 * - Iframe-aware: WP 6.0+ renders the post editor content inside
 *   `<iframe name="editor-canvas">`. The bit spans live in that iframe's
 *   document, not the parent admin page. We set up injection for the parent's
 *   document (legacy / non-iframe surfaces) AND for the iframe's
 *   contentDocument once the iframe becomes available.
 *
 * - Safe from serialization: rich-text with `contentEditable: false` reads its
 *   value from Gutenberg's internal value object (the `replacements` array),
 *   not from the live DOM. Children appended here are never written back to
 *   `post_content`.
 *
 * - No-flash: `editor.scss` applies `font-size:0; color:transparent` to the
 *   icon-span bit so the `%icon%` placeholder text is invisible. The injected
 *   SVG is sized in `px` (independent of the zero font-size), so brief gaps
 *   while Gutenberg re-renders rich-text don't shift layout.
 *
 * - Idempotent re-injection: `injectPreview` early-returns when the span
 *   already has an SVG child, making it cheap to call repeatedly.
 *
 * - Polling for the iframe: MutationObserver attached to the Gutenberg editor
 *   iframe's contentDocument is unreliable for catching React-reconciler
 *   mutations to bit-span children. Identity checks (documentElement, body,
 *   doc reference) all stable; mutations simply do not propagate through to
 *   our observer. A 250ms polling tick re-injects when needed and is the
 *   reliable mechanism. The MutationObserver remains for the parent admin
 *   document (legacy editor surfaces) where it works fine.
 */

const ICON_SPAN_BIT = 'prc-block-bits/icon-span';
const SVG_NS = 'http://www.w3.org/2000/svg';
const SELECTOR = `.prc-block-bit[data-prc-block-bit="${ICON_SPAN_BIT}"][data-icon-name]`;
const EDITOR_IFRAME_SELECTOR = 'iframe[name="editor-canvas"]';

/**
 * WeakSet of documents we've already wired up, so the cross-document plumbing
 * is idempotent (this script may run once on initial load and the iframe may
 * swap or reload).
 */
const wiredDocuments = new WeakSet<Document>();

/**
 * Inject a sprite-reference SVG preview into a bit span if one is not already
 * present. Idempotent — calling on a span that already has an SVG child is a
 * no-op.
 *
 * Uses the span's owner document (`span.ownerDocument`) to create elements so
 * they are correctly bound to whichever document the span lives in (parent or
 * iframe contentDocument).
 */
function injectPreview(span: Element, spritesBase: string): void {
	if (span.querySelector('svg')) {
		return;
	}

	const lib = span.getAttribute('data-icon-library') || 'solid';
	const name = span.getAttribute('data-icon-name');
	const color = span.getAttribute('data-icon-color');
	if (!name) {
		return;
	}

	const ownerDoc = span.ownerDocument ?? document;
	const svg = ownerDoc.createElementNS(SVG_NS, 'svg');
	// px sizing — independent of the parent's `font-size: 0` CSS trick that
	// hides the %icon% placeholder text.
	svg.style.cssText =
		'width:16px;height:16px;display:inline-block;vertical-align:-2px';
	if (color) {
		svg.style.color = color;
	}
	svg.setAttribute('focusable', 'false');
	svg.setAttribute('aria-hidden', 'true');

	const use = ownerDoc.createElementNS(SVG_NS, 'use');
	use.setAttribute('href', `${spritesBase}${lib}.svg#${name}`);

	svg.appendChild(use);
	span.appendChild(svg);
}

/**
 * Wire up SVG preview injection for a single document context. Called once
 * for the parent admin document and once for the editor iframe's
 * contentDocument when available.
 *
 * Two complementary mechanisms:
 *
 * 1. MutationObserver on the editor block-list root, scoped narrowly so we
 *    only see mutations relevant to block content. Catches new bit-span
 *    insertions cheaply on the parent doc.
 *
 * 2. 250ms polling fallback — bulletproof against the iframe-observer
 *    propagation issue (Gutenberg's React reconciler mutates iframe-doc
 *    children in a way that does not surface through MutationObservers
 *    attached to that iframe's contentDocument).
 */
function setupForDocument(doc: Document, spritesBase: string): void {
	if (wiredDocuments.has(doc)) {
		return;
	}
	wiredDocuments.add(doc);

	const editorRoot =
		doc.querySelector('.block-editor-block-list__layout') ??
		doc.querySelector('.editor-styles-wrapper') ??
		doc.documentElement;

	if (!editorRoot) {
		// Document body may not yet exist for a freshly-attached iframe.
		// Bail; the iframe-watcher will retry once the iframe finishes loading.
		wiredDocuments.delete(doc);
		return;
	}

	editorRoot
		.querySelectorAll(SELECTOR)
		.forEach((span) => injectPreview(span, spritesBase));

	new MutationObserver((mutations) => {
		for (const m of mutations) {
			// Re-inject when an existing bit span's children change (Gutenberg
			// re-renders rich-text content on selection / edit, stripping the
			// SVG along with the %icon% placeholder).
			if (m.target instanceof Element && m.target.matches(SELECTOR)) {
				injectPreview(m.target, spritesBase);
			}
			m.addedNodes.forEach((node) => {
				if (!(node instanceof Element)) {
					return;
				}
				if (node.matches(SELECTOR)) {
					injectPreview(node, spritesBase);
				}
				// Wrapped match: Gutenberg adds a [data-rich-text-bogus]
				// outer span for contentEditable:false formats; the bit
				// span is a child of that wrapper.
				node.querySelectorAll(SELECTOR).forEach((span) =>
					injectPreview(span, spritesBase)
				);
			});
		}
	}).observe(editorRoot, { childList: true, subtree: true });

	// Polling fallback for the iframe document. See module docblock for
	// rationale. injectPreview is idempotent so steady-state cost is one
	// querySelectorAll + N membership checks per tick.
	const pollHandle = setInterval(() => {
		doc.querySelectorAll(SELECTOR).forEach((span) =>
			injectPreview(span, spritesBase)
		);
	}, 250);
	// Safety: stop polling after 30 minutes of inactivity in case the editor
	// is left open in a background tab.
	setTimeout(() => clearInterval(pollHandle), 30 * 60 * 1000);
}

/**
 * Look for the editor iframe and, if found and ready, set up injection for
 * its contentDocument. Returns true once the iframe has been wired up.
 */
function getEditorCanvasIframe(): HTMLIFrameElement | null {
	return document.querySelector(
		EDITOR_IFRAME_SELECTOR
	) as HTMLIFrameElement | null;
}

function isEditorCanvasReady(doc: Document): boolean {
	return (
		!!doc.body && !!doc.querySelector('.block-editor-block-list__layout')
	);
}

function trySetupIframe(spritesBase: string): boolean {
	const iframeDoc = getEditorCanvasIframe()?.contentDocument;

	if (!iframeDoc || !isEditorCanvasReady(iframeDoc)) {
		return false;
	}
	setupForDocument(iframeDoc, spritesBase);
	return wiredDocuments.has(iframeDoc);
}

/**
 * Watch until the editor iframe is ready, then wire its contentDocument.
 * Optional onGiveUp runs after 30s if the iframe never becomes ready (legacy
 * non-iframe surfaces).
 */
function watchForIframeReady(spritesBase: string, onGiveUp?: () => void): void {
	let iframe = getEditorCanvasIframe();

	const cleanup = () => {
		parentObserver.disconnect();
		clearInterval(pollHandle);
		iframe?.removeEventListener('load', onReady);
	};

	const onReady = () => {
		if (trySetupIframe(spritesBase)) {
			cleanup();
			return;
		}
		const nextIframe = getEditorCanvasIframe();
		if (nextIframe && nextIframe !== iframe) {
			iframe?.removeEventListener('load', onReady);
			iframe = nextIframe;
			iframe.addEventListener('load', onReady);
		}
	};

	if (iframe) {
		iframe.addEventListener('load', onReady);
	}

	const parentObserver = new MutationObserver(onReady);
	parentObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});

	const pollHandle = setInterval(onReady, 250);

	setTimeout(() => {
		cleanup();
		onGiveUp?.();
	}, 30000);
}

/**
 * Register sprite preview injection for icon-span bits as they appear in the
 * editor DOM. Handles both the parent admin document (legacy / non-iframe
 * surfaces like the navigation editor) and the WP 6.0+ editor iframe.
 *
 * Called once from `src/editor/index.ts` after `registerBitFormatType()`.
 */
export function initIconSpanEditorPreview(): void {
	const spritesBase =
		window.prcBlockBits?.iconSpritesUrl ??
		`${window.location.origin}/wp-content/plugins/prc-icon-library/build/icons/sprites/`;

	// Defer setup until document.body exists. Gutenberg loads editor scripts
	// with deferred / module semantics that can execute during readyState:
	// "loading", before the body element is parsed. Calling
	// MutationObserver.observe(document.body, ...) with a null body throws
	// synchronously.
	const runSetup = () => {
		if (trySetupIframe(spritesBase)) {
			return;
		}

		if (getEditorCanvasIframe()) {
			// Iframe exists but isn't ready yet — wait for it. Bit spans live
			// in the iframe on these surfaces, so skip parent wiring.
			watchForIframeReady(spritesBase);
			return;
		}

		// No iframe yet: legacy/non-iframe surfaces (e.g. navigation editor)
		// host bit spans in the parent document. Wire it immediately so
		// previews aren't deferred until the 30s watch timeout, and keep
		// watching in case an iframe is inserted later.
		setupForDocument(document, spritesBase);
		watchForIframeReady(spritesBase);
	};

	if (document.body) {
		runSetup();
	} else {
		document.addEventListener('DOMContentLoaded', runSetup, { once: true });
	}
}
