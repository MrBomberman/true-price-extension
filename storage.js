// AI assistance: OpenAI Codex (ChatGPT) contributed to the design,
// implementation and refactoring of this file.

import { validateProduct } from './calculations.js';

const PRODUCTS_KEY = 'true-cost:products:v1';

// Load from Chrome or the browser preview, skipping invalid individual records.
export async function loadProducts() {
	const storage = globalThis.chrome?.storage?.local;
	const stored = storage
		? (await storage.get(PRODUCTS_KEY))[PRODUCTS_KEY]
		: JSON.parse(localStorage.getItem(PRODUCTS_KEY) ?? '[]');
	if (stored === undefined) return [];
	if (!Array.isArray(stored))
		throw new Error('Stored products must be an array.');
	return stored
		.map(validateProduct)
		.filter((result) => result.valid)
		.map((result) => result.value);
}

// Validate the entire next list before replacing the saved list.
export async function saveProducts(products) {
	if (!Array.isArray(products)) throw new Error('Products must be an array.');
	const normalized = products.map((product) => {
		const result = validateProduct(product);
		if (!result.valid)
			throw new Error('Invalid product. Check its fields.');
		return result.value;
	});
	const storage = globalThis.chrome?.storage?.local;
	if (storage) await storage.set({ [PRODUCTS_KEY]: normalized });
	else localStorage.setItem(PRODUCTS_KEY, JSON.stringify(normalized));
}
