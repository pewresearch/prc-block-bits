/**
 * Editor-side SVG preview for `prc-block-bits/icon-span`.
 *
 * The saved `post_content` for an icon-span bit carries only the data
 * attributes and `%icon%` as the innerHTML placeholder — no SVG. The PHP
 * walker's callback strategy replaces the entire span at render time, so the
 * placeholder never reaches the frontend.
 *
 * This module injects a preview into the *live editor DOM* so authors see the
 * picked icon while editing. The SVG is built via the DOM API (createElementNS
 * + setAttribute) or imported from a registry record — no HTML string
 * interpolation, zero XSS surface.
 *
 * Preview sources:
 *
 * - `prc/*`, `brands/*`, and `core/*`: WordPress `root/icon` entity SVG via
 *   `resolveSelect` + `importNode` (same path as the picker popover). Poll
 *   until `content` arrives. Never an external `<use href>` — that fails in
 *   the Gutenberg `editor-canvas` iframe.
 * - Registry miss for PRC / approved brands: fetch the fill sheet
 *   (`iconSpritesUrl` → `…/build/icons/prc.svg` or `brands.svg`), extract
 *   the `<symbol id>`, and inline those nodes. A trailing `sprites/` on
 *   older payloads is stripped only when building that fetch URL.
 * - Unregistered names: empty / wait. No `sprites/{lib}.svg` fallback.
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
 * - No-flash: `editor.scss` applies `font-size:0; color:inherit` to the
 *   icon-span bit so the `%icon%` placeholder text is invisible (zero
 *   font-size) while `currentColor` SVG fills still inherit paragraph color.
 *   The injected SVG is sized in `px` (independent of the zero font-size), so
 *   brief gaps while Gutenberg re-renders rich-text don't shift layout.
 *
 * - Idempotent re-injection: `injectPreview` skips a matching registry or
 *   fill-inline SVG. Any external `<use>` preview is removed. A fill-inline
 *   fallback is replaced once the registry record arrives.
 *
 * - Polling for the iframe: MutationObserver attached to the Gutenberg editor
 *   iframe's contentDocument is unreliable for catching React-reconciler
 *   mutations to bit-span children. Identity checks (documentElement, body,
 *   doc reference) all stable; mutations simply do not propagate through to
 *   our observer. A 250ms polling tick re-injects when needed and is the
 *   reliable mechanism. The MutationObserver remains for the parent admin
 *   document (legacy editor surfaces) where it works fine.
 */

import { select, resolveSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { curatedPrcIcons, resolveIconSource } from '@prc/icons';

import {
	CORE_REGISTRY_COLLECTION,
	extractFillSymbol,
	getFillSheetPreviewRef,
	isRegistryPreviewCollection,
	parseIconIdentity,
	registryIconName,
	type IconIdentity,
	type PreviewSpriteSource,
} from './preview-href';
import type { IconRecord } from './icon-types';

const ICON_SPAN_BIT = 'prc-block-bits/icon-span';
const SVG_NS = 'http://www.w3.org/2000/svg';
const SELECTOR = `.prc-block-bit[data-prc-block-bit="${ICON_SPAN_BIT}"][data-icon-name]`;
const EDITOR_IFRAME_SELECTOR = 'iframe[name="editor-canvas"]';
const PREVIEW_REGISTRY = 'registry';
const PREVIEW_FILL = 'fill';
const PREVIEW_SPRITE = 'sprite';

const _spriteFetchCache = new Map<string, Promise<string>>();
const _spriteTextCache = new Map<string, string | null>();

function getRegisteredIcon(name: string): IconRecord | null {
	return (
		(select(coreStore).getEntityRecord('root', 'icon', name) as
			| IconRecord
			| undefined) ?? null
	);
}

function requestRegisteredIcon(name: string): void {
	// `select().getEntityRecord` is cache-only. `resolveSelect` triggers the
	// REST resolver so a cold editor actually fetches `root/icon`.
	void resolveSelect(coreStore).getEntityRecord('root', 'icon', name);
}

function hasResolvedRegisteredIcon(name: string): boolean {
	return select(coreStore).hasFinishedResolution('getEntityRecord', [
		'root',
		'icon',
		name,
	]);
}

/**
 * WeakSet of documents we've already wired up, so the cross-document plumbing
 * is idempotent (this script may run once on initial load and the iframe may
 * swap or reload).
 */
const wiredDocuments = new WeakSet<Document>();

/**
 * Size and color the injected preview SVG.
 *
 * @param svg  Preview root.
 * @param span Icon-span bit element (color source).
 */
function stylePreviewSvg(svg: SVGElement, span: Element): void {
	svg.style.cssText =
		'width:16px;height:16px;display:inline-block;vertical-align:-2px';
	const color = span.getAttribute('data-icon-color');
	if (color) {
		svg.style.color = color;
	}
	svg.setAttribute('focusable', 'false');
	svg.setAttribute('aria-hidden', 'true');
}

function markPreviewSvg(
	svg: SVGElement,
	kind: typeof PREVIEW_REGISTRY | typeof PREVIEW_FILL,
	previewName: string
): void {
	svg.setAttribute('data-prc-icon-preview', kind);
	svg.setAttribute('data-prc-icon-name', previewName);
}

function hasExternalUse(existing: Element | null): boolean {
	return !!existing?.querySelector('use');
}

function isMatchingPreview(
	existing: Element | null,
	kind: string,
	previewName: string
): boolean {
	return (
		!!existing &&
		!hasExternalUse(existing) &&
		existing.getAttribute('data-prc-icon-preview') === kind &&
		existing.getAttribute('data-prc-icon-name') === previewName
	);
}

function removeStickyExternalUse(existing: Element | null): void {
	if (
		existing &&
		(existing.getAttribute('data-prc-icon-preview') === PREVIEW_SPRITE ||
			hasExternalUse(existing))
	) {
		existing.remove();
	}
}

function tryInjectRegistryPreview(
	span: Element,
	existing: Element | null,
	name: string
): boolean {
	requestRegisteredIcon(name);
	const record = getRegisteredIcon(name);
	const ownerDoc = span.ownerDocument ?? document;
	if (!record?.content || !ownerDoc.defaultView) {
		return false;
	}
	if (isMatchingPreview(existing, PREVIEW_REGISTRY, name)) {
		return true;
	}
	const parsed = new ownerDoc.defaultView.DOMParser().parseFromString(
		record.content,
		'image/svg+xml'
	);
	const sourceSvg = parsed.documentElement;
	if (sourceSvg && sourceSvg.nodeName.toLowerCase() === 'svg') {
		existing?.remove();
		const svg = ownerDoc.importNode(
			sourceSvg,
			true
		) as unknown as SVGElement;
		stylePreviewSvg(svg, span);
		markPreviewSvg(svg, PREVIEW_REGISTRY, name);
		span.appendChild(svg);
	}
	return true;
}

function requestFillSheet(sheetUrl: string): string | null | undefined {
	if (_spriteTextCache.has(sheetUrl)) {
		return _spriteTextCache.get(sheetUrl);
	}
	if (!_spriteFetchCache.has(sheetUrl)) {
		_spriteFetchCache.set(
			sheetUrl,
			fetch(sheetUrl)
				.then((response) => (response.ok ? response.text() : ''))
				.catch(() => '')
				.then((text) => {
					_spriteTextCache.set(sheetUrl, text || null);
					return text;
				})
		);
	}
	return undefined;
}

function previewRegistryName(
	identity: IconIdentity,
	source: PreviewSpriteSource
): string | null {
	if (identity.collection === CORE_REGISTRY_COLLECTION) {
		return registryIconName(identity);
	}
	if (source.kind === 'prc' || source.kind === 'brands') {
		return `${source.spriteLibrary}/${source.icon}`;
	}
	if (isRegistryPreviewCollection(identity.collection)) {
		return registryIconName(identity);
	}
	return null;
}

function resolveUseSource(
	collection: string,
	glyph: string
): PreviewSpriteSource {
	return resolveIconSource({
		library: collection,
		icon: glyph,
		curatedNames: curatedPrcIcons.prc,
		approvedBrandNames: curatedPrcIcons.brands,
	}) as PreviewSpriteSource;
}

function injectFillSymbol(
	span: Element,
	symbol: Element,
	previewName: string
): void {
	const ownerDoc = span.ownerDocument ?? document;
	const svg = ownerDoc.createElementNS(SVG_NS, 'svg');
	stylePreviewSvg(svg, span);
	markPreviewSvg(svg, PREVIEW_FILL, previewName);
	svg.setAttribute('viewBox', symbol.getAttribute('viewBox') || '0 0 24 24');
	Array.from(symbol.childNodes).forEach((child) => {
		svg.appendChild(ownerDoc.importNode(child, true));
	});
	span.querySelector('svg')?.remove();
	span.appendChild(svg);
}

function tryInjectFillPreview(
	span: Element,
	existing: Element | null,
	spritesBase: string,
	source: PreviewSpriteSource
): boolean {
	const ref = getFillSheetPreviewRef(spritesBase, source);
	if (!ref) {
		return false;
	}
	const previewName = `${source.spriteLibrary}/${source.icon}`;
	if (isMatchingPreview(existing, PREVIEW_FILL, previewName)) {
		return true;
	}
	const sheetText = requestFillSheet(ref.sheetUrl);
	if (!sheetText) {
		return false;
	}
	const symbol = extractFillSymbol(sheetText, ref.symbolId);
	if (!symbol) {
		return false;
	}
	injectFillSymbol(span, symbol, previewName);
	return true;
}

function injectPreview(span: Element, spritesBase: string): void {
	const name = span.getAttribute('data-icon-name');
	if (!name) {
		return;
	}

	const identity = parseIconIdentity(
		name,
		span.getAttribute('data-icon-library')
	);
	const existing = span.querySelector('svg');
	const source = resolveUseSource(identity.collection, identity.glyph);
	const registryName = previewRegistryName(identity, source);

	if (source.kind !== 'missing') {
		const ref = getFillSheetPreviewRef(spritesBase, source);
		if (ref) {
			requestFillSheet(ref.sheetUrl);
		}
	}

	if (registryName) {
		if (tryInjectRegistryPreview(span, existing, registryName)) {
			return;
		}
		if (!hasResolvedRegisteredIcon(registryName)) {
			removeStickyExternalUse(existing);
			return;
		}
	}

	if (source.kind !== 'missing') {
		if (tryInjectFillPreview(span, existing, spritesBase, source)) {
			return;
		}
		removeStickyExternalUse(existing);
		return;
	}

	removeStickyExternalUse(existing);
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
 * @param doc
 * @param spritesBase
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
 * @param spritesBase
 * @param onGiveUp
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
 * Register inline SVG preview injection for icon-span bits as they appear in
 * the editor DOM. Handles both the parent admin document (legacy /
 * non-iframe surfaces like the navigation editor) and the WP 6.0+ editor
 * iframe.
 *
 * Called once from `src/editor/index.ts` after `registerBitFormatType()`.
 */
export function initIconSpanEditorPreview(): void {
	const spritesBase =
		window.prcBlockBits?.iconSpritesUrl ??
		`${window.location.origin}/wp-content/plugins/prc-icon-library/build/icons/`;

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
