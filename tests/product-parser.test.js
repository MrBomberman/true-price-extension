// AI assistance: OpenAI Codex (ChatGPT) helped write and refine these tests.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePackageSize, parseProductSnapshot } from '../product-parser.js';

test('reads a Product name, explicit offer and structured weight', () => {
  assert.deepEqual(parseProductSnapshot({
    title: 'Shop title', heading: 'Heading', metaName: 'Meta name',
    jsonLd: ['{"@type":"Product","name":"Coffee","offers":{"@type":"Offer","price":"1 299,50","priceCurrency":"RUB"},"weight":{"value":250,"unitCode":"GRM"}}']
  }), { name: 'Coffee', price: 1299.5, currency: 'RUB', quantity: 250, unit: 'g' });
});

test('continues after malformed JSON and finds Products in graphs and type arrays', () => {
  assert.deepEqual(parseProductSnapshot({ title: 'Shop', jsonLd: ['{broken', JSON.stringify({ '@graph': [
    { '@type': 'Organization', name: 'Shop' },
    { '@type': ['Thing', 'Product'], name: 'Milk 1 л', offers: [{ price: '2.50', priceCurrency: 'EUR' }] }
  ] })] }), { name: 'Milk 1 л', price: 2.5, currency: 'EUR', quantity: 1, unit: 'l' });
});

test('finds a Product in a root array and reads its size', () => {
  assert.deepEqual(parseProductSnapshot({ jsonLd: ['[{"@type":"Product","name":"Juice","size":"750 ml"}]'] }),
    { name: 'Juice', quantity: 750, unit: 'ml' });
});

test('uses semantic metadata when structured product data is absent', () => {
  assert.deepEqual(parseProductSnapshot({ title: 'Store', heading: 'Tea 100 g', metaName: 'Tea', metaPrice: '4,25', metaCurrency: 'USD' }),
    { name: 'Tea 100 g', price: 4.25, currency: 'USD', quantity: 100, unit: 'g' });
});

test('uses meta name and then title as name fallbacks', () => {
  assert.deepEqual(parseProductSnapshot({ title: 'Store', metaName: ' Tea ' }), { name: 'Tea' });
  assert.deepEqual(parseProductSnapshot({ title: ' Ordinary page ' }), { name: 'Ordinary page' });
});

test('recognizes English and Russian size labels with decimal commas and nonbreaking spaces', () => {
  for (const [text, expected] of [
    ['Coffee 250 g', { quantity: 250, unit: 'g' }],
    ['Flour 1.5 kg', { quantity: 1.5, unit: 'kg' }],
    ['Молоко 1,5\u00a0л', { quantity: 1.5, unit: 'l' }],
    ['Чай 100 гр', { quantity: 100, unit: 'g' }],
    ['Рис 2 кг', { quantity: 2, unit: 'kg' }],
    ['Сок 200мл', { quantity: 200, unit: 'ml' }]
  ]) assert.deepEqual(parsePackageSize(text), expected, text);
});

test('keeps the per-pack size and explicit pack count', () => {
  assert.deepEqual(parsePackageSize('Juice 6 × 200 ml'), { quantity: 200, unit: 'ml', packs: 6 });
  assert.deepEqual(parseProductSnapshot({ title: 'Сок 6x200мл' }), { name: 'Сок 6x200мл', quantity: 200, unit: 'ml', packs: 6 });
});

test('does not mistake storage capacity, unlabelled numbers or zero for package sizes', () => {
  for (const text of ['Phone 128 GB', 'Box 200', 'Empty 0 g']) assert.equal(parsePackageSize(text), null);
});

test('omits prices without a supported known currency', () => {
  for (const metaCurrency of ['', 'GBP']) {
    assert.deepEqual(parseProductSnapshot({ title: 'Tea', metaPrice: '12', metaCurrency }), { name: 'Tea' });
  }
  assert.deepEqual(parseProductSnapshot({ title: 'Tea', jsonLd: ['{"@type":"Product","offers":{"price":12,"priceCurrency":"GBP"}}'] }), { name: 'Tea' });
});

test('does not replace a known unsupported offer currency with fallback metadata', () => {
  assert.deepEqual(parseProductSnapshot({ title: 'Tea', metaPrice: '12', metaCurrency: 'RUB',
    jsonLd: ['{"@type":"Product","offers":{"price":12,"priceCurrency":"GBP"}}'] }), { name: 'Tea' });
});

test('does not turn aggregate ranges or multiple offers into a selected price', () => {
  for (const offers of [{ '@type': 'AggregateOffer', lowPrice: 10, highPrice: 20, priceCurrency: 'USD' },
    [{ price: 10, priceCurrency: 'USD' }, { price: 20, priceCurrency: 'USD' }]]) {
    assert.deepEqual(parseProductSnapshot({ title: 'Tea', jsonLd: [JSON.stringify({ '@type': 'Product', offers })] }), { name: 'Tea' });
  }
});

test('uses title size when the Product name contains no size and supports weight unitText', () => {
  assert.deepEqual(parseProductSnapshot({ title: 'Coffee 500 г', jsonLd: ['{"@type":"Product","name":"Coffee"}'] }),
    { name: 'Coffee', quantity: 500, unit: 'g' });
  assert.deepEqual(parseProductSnapshot({ jsonLd: ['{"@type":"Product","name":"Flour","weight":{"value":"1,5","unitText":"kg"}}'] }),
    { name: 'Flour', quantity: 1.5, unit: 'kg' });
});

test('reads size from the selected semantic product name', () => {
  assert.deepEqual(parseProductSnapshot({ title: 'Store', metaName: 'Coffee 250 g' }),
    { name: 'Coffee 250 g', quantity: 250, unit: 'g' });
});

test('reads the complete space-grouped quantity instead of its trailing digits', () => {
  assert.deepEqual(parsePackageSize('Coffee 1 500 g'), { quantity: 1500, unit: 'g' });
  assert.deepEqual(parsePackageSize('Кофе 1\u00a0500 г'), { quantity: 1500, unit: 'g' });
  assert.deepEqual(parsePackageSize('Flour 2 500 g'), { quantity: 2500, unit: 'g' });
});
