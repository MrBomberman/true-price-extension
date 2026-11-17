// AI assistance: OpenAI Codex (ChatGPT) contributed to the design,
// implementation and refactoring of this file.

const UNITS = {
	g: { divisor: 1000, baseUnit: 'kg', dimension: 'weight' },
	kg: { divisor: 1, baseUnit: 'kg', dimension: 'weight' },
	ml: { divisor: 1000, baseUnit: 'L', dimension: 'volume' },
	l: { divisor: 1, baseUnit: 'L', dimension: 'volume' },
	pcs: { divisor: 1, baseUnit: 'item', dimension: 'count' },
};
const CURRENCIES = ['RUB', 'USD', 'EUR'];

// Read decimals, including decimal commas and correctly grouped thousands.
export function parseNumber(value) {
	if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
	if (typeof value !== 'string' || !value.trim()) return NaN;
	let text = value.trim();
	if (/[ \u00a0\u2009\u202f]/.test(text)) {
		if (
			!/^[+-]?\d{1,3}(?:[ \u00a0\u2009\u202f]\d{3})+(?:[.,]\d+)?$/.test(
				text,
			)
		)
			return NaN;
		text = text.replace(/[ \u00a0\u2009\u202f]/g, '');
	}
	text = text.replace(',', '.');
	if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return NaN;
	const number = Number(text);
	return Number.isFinite(number) ? number : NaN;
}

// Convert the full multipack amount to kilograms, liters, or individual items.
export function calculateUnitPrice(product) {
	const price = parseNumber(product.price);
	const quantity = parseNumber(product.quantity);
	const packs = parseNumber(product.packs ?? 1);
	if (
		!(price > 0) ||
		!(quantity > 0) ||
		!(packs > 0) ||
		!Number.isInteger(packs)
	) {
		throw new Error(
			'Price and quantity must be positive; packs must be a positive integer.',
		);
	}
	if (
		typeof product.unit !== 'string' ||
		!Object.hasOwn(UNITS, product.unit)
	) {
		throw new Error('Choose a supported unit.');
	}
	const { divisor, baseUnit, dimension } = UNITS[product.unit];
	const totalQuantity = (quantity * packs) / divisor;
	const unitPrice = price / totalQuantity;
	if (!(unitPrice > 0) || !Number.isFinite(unitPrice)) {
		throw new Error('These numbers cannot produce a finite unit price.');
	}
	return { unitPrice, baseUnit, dimension, totalQuantity };
}

// Normalize form or stored data and return errors beside the relevant fields.
export function validateProduct(input) {
	const errors = {};
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return {
			valid: false,
			errors: { product: 'Enter a product object.' },
			value: null,
		};
	}
	const name = typeof input.name === 'string' ? input.name.trim() : '';
	const url = typeof input.url === 'string' ? input.url.trim() : '';
	const price = parseNumber(input.price);
	const quantity = parseNumber(input.quantity);
	const packs = parseNumber(input.packs ?? 1);
	if (typeof input.id !== 'string' || !input.id)
		errors.id = 'A product ID is required.';
	if (!name || name.length > 200)
		errors.name = 'Enter a name with 1–200 characters.';
	if (!(price > 0)) errors.price = 'Enter a positive finite price.';
	if (!(quantity > 0)) errors.quantity = 'Enter a positive finite quantity.';
	if (!(packs > 0) || !Number.isInteger(packs))
		errors.packs = 'Enter a positive whole number of packs.';
	if (typeof input.unit !== 'string' || !Object.hasOwn(UNITS, input.unit))
		errors.unit = 'Choose g, kg, ml, l, or pcs.';
	if (!CURRENCIES.includes(input.currency))
		errors.currency = 'Choose RUB, USD, or EUR.';
	if (input.url !== undefined && typeof input.url !== 'string')
		errors.url = 'Enter an HTTP or HTTPS URL.';
	if (url) {
		try {
			if (!['http:', 'https:'].includes(new URL(url).protocol))
				errors.url = 'Enter an HTTP or HTTPS URL.';
		} catch {
			errors.url = 'Enter a complete HTTP or HTTPS URL.';
		}
	}
	if (!errors.price && !errors.quantity && !errors.packs && !errors.unit) {
		try {
			calculateUnitPrice({ price, quantity, packs, unit: input.unit });
		} catch (error) {
			errors.quantity = error.message;
		}
	}
	if (Object.keys(errors).length)
		return { valid: false, errors, value: null };
	const value = {
		id: input.id,
		name,
		price,
		quantity,
		unit: input.unit,
		packs,
		currency: input.currency,
		url,
	};
	return { valid: true, errors, value };
}

// Compare only matching currencies and measurements, with the cheapest first.
export function compareProducts(products) {
	const groups = new Map();
	for (const product of products) {
		const { unitPrice, baseUnit, dimension } = calculateUnitPrice(product);
		const key = `${product.currency}:${dimension}`;
		if (!groups.has(key)) {
			groups.set(key, {
				key,
				currency: product.currency,
				dimension,
				baseUnit,
				items: [],
			});
		}
		groups.get(key).items.push({ ...product, unitPrice });
	}
	for (const group of groups.values()) {
		group.items.sort((a, b) => a.unitPrice - b.unitPrice);
		const cheapest = group.items[0].unitPrice;
		group.items = group.items.map((item) => ({
			...item,
			premiumPercent: ((item.unitPrice - cheapest) / cheapest) * 100,
			isBest: group.items.length > 1 && item.unitPrice === cheapest,
		}));
	}
	return [...groups.values()];
}

// Keep money formatting consistent across the preview and product cards.
export function formatMoney(value, currency) {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency,
	}).format(value);
}
