import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadProducts, saveProducts } from '../storage.js';

const originalChrome = globalThis.chrome;
const originalLocal = globalThis.localStorage;
afterEach(() => {
	globalThis.chrome = originalChrome;
	globalThis.localStorage = originalLocal;
});
const product = (extra = {}) => ({
	id: 'a',
	name: 'Coffee',
	price: 900,
	quantity: 250,
	unit: 'g',
	packs: 1,
	currency: 'RUB',
	url: '',
	...extra,
});
// Emulate Chrome's copy-on-read/write behavior without browser dependencies.
function chromeStore(seed = {}) {
	const data = structuredClone(seed);
	globalThis.chrome = {
		storage: {
			local: {
				async get(key) {
					return structuredClone({ [key]: data[key] });
				},
				async set(values) {
					Object.assign(data, structuredClone(values));
				},
			},
		},
	};
	return data;
}

test('empty chrome storage loads an empty list and product edits persist independently of callers', async () => {
	chromeStore();
	assert.deepEqual(await loadProducts(), []);
	// Records from the earlier model still load; unused dates are ignored.
	chromeStore({
		'true-cost:products:v1': [
			product({
				createdAt: '2026-11-16T12:00:00.000Z',
				updatedAt: '2026-11-16T12:00:00.000Z',
			}),
		],
	});
	assert.deepEqual(await loadProducts(), [product()]);
	const records = [product()];
	await saveProducts(records);
	records[0].name = 'mutated';
	assert.equal((await loadProducts())[0].name, 'Coffee');
	await saveProducts([product({ name: 'Edited' })]);
	assert.equal((await loadProducts())[0].name, 'Edited');
	await saveProducts([]);
	assert.deepEqual(await loadProducts(), []);
});

test('malformed entries are skipped while malformed top-level storage is reported', async () => {
	chromeStore({
		'true-cost:products:v1': [product(), { name: 'broken' }, null],
	});
	assert.equal((await loadProducts()).length, 1);
	chromeStore({ 'true-cost:products:v1': { products: [] } });
	await assert.rejects(loadProducts(), /stored|storage|format/i);
});

test('invalid saves reject without replacing the last valid products', async () => {
	chromeStore();
	await saveProducts([product()]);
	await assert.rejects(
		saveProducts([product({ price: 0 })]),
		/invalid|price/i,
	);
	assert.equal((await loadProducts())[0].price, 900);
	await assert.rejects(saveProducts(null), /array|invalid/i);
});

test('malformed JSON unit records do not prevent valid stored products from loading', async () => {
	chromeStore({
		'true-cost:products:v1': [
			product(),
			product({ id: 'object', unit: { toString: 'kg' } }),
			product({ id: 'array', unit: ['g'] }),
		],
	});
	assert.deepEqual(await loadProducts(), [product()]);
});

test('chrome read and quota failures surface without falling back', async () => {
	let fallbackUsed = false;
	globalThis.localStorage = {
		getItem() {
			fallbackUsed = true;
		},
		setItem() {
			fallbackUsed = true;
		},
	};
	globalThis.chrome = {
		storage: {
			local: {
				async get() {
					throw new Error('Read blocked');
				},
				async set() {
					throw new Error('Quota exceeded');
				},
			},
		},
	};
	await assert.rejects(loadProducts(), /Read blocked/);
	await assert.rejects(saveProducts([product()]), /Quota exceeded/);
	assert.equal(fallbackUsed, false);
});

test('preview localStorage persists data and reports malformed JSON', async () => {
	globalThis.chrome = undefined;
	const data = new Map();
	globalThis.localStorage = {
		getItem(key) {
			return data.get(key) ?? null;
		},
		setItem(key, value) {
			data.set(key, value);
		},
	};
	await saveProducts([product()]);
	assert.equal((await loadProducts())[0].name, 'Coffee');
	data.set('true-cost:products:v1', '{broken');
	await assert.rejects(loadProducts(), /JSON|corrupt|parse/i);
});
