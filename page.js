// AI assistance: OpenAI Codex (ChatGPT) contributed to the design,
// implementation and refactoring of this file.

import { parseProductSnapshot } from './product-parser.js';

// Collect only structured data and semantic tags; Chrome runs this function in the page.
function collectProductPage() {
	const scope = document.querySelector('[itemtype*="/Product"]') || document;

	// Read a semantic node's content attribute or visible text without changing the DOM.
	function read(root, selector) {
		const node = root.querySelector(selector);
		return (
			node?.getAttribute('content') ||
			node?.textContent ||
			''
		).trim();
	}

	return {
		title: document.title,
		heading: read(scope, 'h1') || read(document, 'h1'),
		metaName:
			read(scope, '[itemprop="name"]') ||
			read(document, 'meta[property="og:title"]'),
		metaPrice:
			read(scope, '[itemprop="price"]') ||
			read(
				document,
				'meta[property="product:price:amount"], meta[property="og:price:amount"]',
			),
		metaCurrency:
			read(scope, '[itemprop="priceCurrency"]') ||
			read(
				document,
				'meta[property="product:price:currency"], meta[property="og:price:currency"]',
			),
		jsonLd: [
			...document.querySelectorAll('script[type="application/ld+json"]'),
		].map((script) => script.textContent),
	};
}

// Read the active product page after a user action, keeping manual entry available on failure.
export async function getCurrentPage(api = globalThis.chrome) {
	if (!api?.tabs?.query) {
		throw new Error(
			'Install the Chrome extension to use the current page. You can still add products manually here.',
		);
	}
	let tab;
	try {
		[tab] = await api.tabs.query({ active: true, currentWindow: true });
	} catch {
		throw new Error(
			'Could not read this tab. Open a product website and try again.',
		);
	}
	if (!/^https?:\/\//.test(tab?.url)) {
		throw new Error(
			'Open a product website first. Chrome pages and local files are not supported.',
		);
	}
	const url = new URL(tab.url);
	const title = tab.title?.trim() || url.hostname;
	let snapshot = { title };
	if (api.scripting?.executeScript && Number.isInteger(tab.id)) {
		try {
			const results = await api.scripting.executeScript({
				target: { tabId: tab.id },
				func: collectProductPage,
			});
			snapshot = { ...results?.[0]?.result, title };
		} catch {
			// Restricted websites may deny injection; the title and URL still help manual entry.
		}
	}
	return { ...parseProductSnapshot(snapshot), url: url.href };
}
