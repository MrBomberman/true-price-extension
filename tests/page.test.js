// AI assistance: OpenAI Codex (ChatGPT) helped write and refine these tests.

import test from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentPage } from '../page.js';

test('captures the current website title and link after an activeTab grant', async () => {
  let query;
  const api = { tabs: { query: async (value) => {
    query = value;
    return [{ id: 12, title: '  Coffee beans, 250 g  ', url: 'https://shop.example/coffee?size=250#details' }];
  } } };
  assert.deepEqual(await getCurrentPage(api), {
    name: 'Coffee beans, 250 g', url: 'https://shop.example/coffee?size=250#details', quantity: 250, unit: 'g',
  });
  assert.deepEqual(query, { active: true, currentWindow: true });
});

test('preview explains that website capture requires the installed extension', async () => {
  await assert.rejects(getCurrentPage({}), /Chrome extension/);
});

test('restricted browser pages and missing active tabs give an actionable error', async () => {
  for (const tabs of [[], [{url: 'chrome://extensions',title:'Extensions'}], [{url:'file:///private/document.txt'}], [{title:'No permission'}]]) {
    await assert.rejects(getCurrentPage({ tabs: { query: async () => tabs } }), /website|web page/i);
  }
});

test('uses hostname when the website has no page title', async () => {
  assert.deepEqual(await getCurrentPage({ tabs: { query: async () => [{url:'https://shop.example/item',title:'  '}] } }), {
    name:'shop.example', url:'https://shop.example/item',
  });
});

test('does not leak internal Chrome API errors to users', async () => {
  await assert.rejects(getCurrentPage({ tabs: { query: async () => { throw new Error('internal failure ID 123'); } } }),
    (error) => /open|try/i.test(error.message) && !error.message.includes('123'));
});

test('fills product details returned by an active-tab script', async () => {
  const api = {
    tabs: { query: async () => [{ id: 12, title: 'Shop', url: 'https://shop.example/coffee' }] },
    scripting: { executeScript: async ({ target, func }) => {
      assert.deepEqual(target, { tabId: 12 });
      assert.equal(typeof func, 'function');
      return [{ frameId: 0, result: { title: 'Shop', heading: 'Coffee 250 g', metaPrice: '8.50', metaCurrency: 'EUR', jsonLd: [] } }];
    } }
  };
  assert.deepEqual(await getCurrentPage(api), {
    name: 'Coffee 250 g', url: 'https://shop.example/coffee', price: 8.5, currency: 'EUR', quantity: 250, unit: 'g'
  });
});

test('keeps title, URL and labelled size when script injection is rejected', async () => {
  const api = {
    tabs: { query: async () => [{ id: 12, title: 'Coffee 250 g', url: 'https://shop.example/coffee' }] },
    scripting: { executeScript: async () => { throw new Error('Cannot access contents of this page: internal ID 123'); } }
  };
  assert.deepEqual(await getCurrentPage(api), {
    name: 'Coffee 250 g', url: 'https://shop.example/coffee', quantity: 250, unit: 'g'
  });
});
