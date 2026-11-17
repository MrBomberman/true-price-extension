import test from 'node:test';
import assert from 'node:assert/strict';
import {
	parseNumber,
	validateProduct,
	calculateUnitPrice,
	compareProducts,
	formatMoney,
} from '../calculations.js';

const product = (extra = {}) => ({
	id: 'coffee',
	name: 'Coffee',
	price: 900,
	quantity: 250,
	unit: 'g',
	packs: 1,
	currency: 'RUB',
	url: '',
	...extra,
});

test('localized decimals and space thousands parse without accepting blank or malformed numbers', () => {
	for (const [value, expected] of [
		['1\u00a0250,50', 1250.5],
		['1\u202f250.5', 1250.5],
		[' 900 ', 900],
		[12, 12],
		['2e3', 2000],
	])
		assert.equal(parseNumber(value), expected);
	for (const value of [
		'',
		' ',
		null,
		undefined,
		true,
		'12abc',
		'1,2,3',
		Infinity,
		'Infinity',
		'1 2',
	])
		assert.ok(Number.isNaN(parseNumber(value)), String(value));
});

test('validation normalizes fields and defaults packs without mutating input', () => {
	const input = product({
		name: '  Coffee  ',
		price: '1 250,50',
		quantity: '400',
		packs: undefined,
	});
	const result = validateProduct(input);
	assert.equal(result.valid, true);
	assert.equal(result.value.name, 'Coffee');
	assert.equal(result.value.price, 1250.5);
	assert.equal(result.value.quantity, 400);
	assert.equal(result.value.packs, 1);
	assert.equal(input.name, '  Coffee  ');
});

test('validation rejects invalid fields and unsafe URLs without throwing', () => {
	for (const extra of [
		{ price: 0 },
		{ quantity: -1 },
		{ price: Infinity },
		{ price: '' },
		{ packs: 1.2 },
		{ packs: 0 },
		{ unit: 'oz' },
		{ currency: 'GBP' },
		{ name: ' ' },
		{ url: 'javascript:alert(1)' },
		{ url: 'data:text/html,test' },
		{ url: '//example.com' },
		{ id: '' },
	]) {
		const result = validateProduct(product(extra));
		assert.equal(result.valid, false, JSON.stringify(extra));
		assert.equal(result.value, null);
		assert.ok(Object.keys(result.errors).length > 0);
	}
	for (const value of [null, [], 42])
		assert.equal(validateProduct(value).valid, false);
	assert.equal(
		validateProduct(product({ url: 'https://example.com/product?q=1' }))
			.valid,
		true,
	);
});

test('unit prices convert coffee weight, multipack volume, and items', () => {
	assert.deepEqual(calculateUnitPrice(product()), {
		unitPrice: 3600,
		baseUnit: 'kg',
		dimension: 'weight',
		totalQuantity: 0.25,
	});
	assert.equal(
		calculateUnitPrice(product({ price: 1250, quantity: 400 })).unitPrice,
		3125,
	);
	assert.deepEqual(
		calculateUnitPrice(
			product({ price: 120, quantity: 200, packs: 6, unit: 'ml' }),
		),
		{
			unitPrice: 100,
			baseUnit: 'L',
			dimension: 'volume',
			totalQuantity: 1.2,
		},
	);
	assert.equal(
		calculateUnitPrice(
			product({ price: 60, quantity: 3, packs: 2, unit: 'pcs' }),
		).unitPrice,
		10,
	);
});

test('validation rejects object and array units without coercion or exceptions', () => {
	for (const unit of [{ toString: 'kg' }, ['g'], null, 1, {}]) {
		const result = validateProduct(product({ unit }));
		assert.equal(result.valid, false);
		assert.equal(result.value, null);
		assert.ok(result.errors.unit);
	}
});

test('direct calculations reject non-string units with a supported-unit error', () => {
	for (const unit of [{ toString: 'kg' }, ['g'], null, 1, {}]) {
		assert.throws(
			() => calculateUnitPrice(product({ unit })),
			/supported unit/,
		);
	}
});

test('invalid numeric calculations throw instead of producing nonfinite or zero results', () => {
	for (const extra of [
		{ price: 0 },
		{ quantity: '' },
		{ packs: Infinity },
		{ quantity: Number.MAX_VALUE, packs: 2 },
		{ quantity: Number.MIN_VALUE },
		{ price: Number.MAX_VALUE, quantity: 1, unit: 'g' },
	]) {
		assert.throws(() => calculateUnitPrice(product(extra)), Error);
		assert.equal(validateProduct(product(extra)).valid, false);
	}
});

test('comparison separates currencies and dimensions and computes premiums from cheapest', () => {
	const groups = compareProducts([
		product(),
		product({ id: 'large', price: 1250, quantity: 400 }),
		product({ id: 'usd', currency: 'USD' }),
		product({ id: 'milk', unit: 'ml' }),
	]);
	assert.equal(groups.length, 3);
	const weight = groups.find(
		(group) => group.currency === 'RUB' && group.dimension === 'weight',
	);
	assert.deepEqual(
		weight.items.map((item) => item.id),
		['large', 'coffee'],
	);
	assert.equal(weight.items[0].isBest, true);
	assert.equal(weight.items[1].isBest, false);
	assert.equal(weight.items[1].premiumPercent, 15.2);
	assert.equal(
		groups.find((group) => group.currency === 'USD').items[0].isBest,
		false,
	);
});

test('ties remain stable and are all best; ranking uses unrounded prices', () => {
	const group = compareProducts([
		product({ id: 'a', price: 1.004, quantity: 1, unit: 'kg' }),
		product({ id: 'b', price: 1, quantity: 1, unit: 'kg' }),
		product({ id: 'c', price: 1, quantity: 1, unit: 'kg' }),
	])[0];
	assert.deepEqual(
		group.items.map((item) => item.id),
		['b', 'c', 'a'],
	);
	assert.deepEqual(
		group.items.map((item) => item.isBest),
		[true, true, false],
	);
	assert.equal(group.items[0].premiumPercent, 0);
});

test('money formatting uses English separators with at most two decimal places', () => {
	assert.equal(formatMoney(1234.567, 'USD'), '$1,234.57');
	assert.equal(formatMoney(1234.5, 'EUR'), '€1,234.50');
});
