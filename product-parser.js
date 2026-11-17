// AI assistance: OpenAI Codex (ChatGPT) contributed to the design,
// implementation and refactoring of this file.

import { parseNumber } from './calculations.js';

// Normalize text without interpreting arbitrary objects as product names.
function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Parse labelled package sizes, preserving the size of one pack in multipacks.
export function parsePackageSize(text) {
  const match = cleanText(text).match(/(?:^|[^\p{L}\p{N}])(?:(\d+)\s*[x×]\s*)?(\d+(?:[ \u00a0\u2009\u202f]\d{3})*(?:[.,]\d+)?)\s*(kg|кг|ml|мл|гр|g|г|l|л)(?![\p{L}\p{N}])/iu);
  if (!match) return null;
  const quantity = parseNumber(match[2]);
  const packs = match[1] ? Number(match[1]) : undefined;
  if (!(quantity > 0) || (packs !== undefined && !(packs > 0))) return null;
  const units = { g: 'g', г: 'g', гр: 'g', kg: 'kg', кг: 'kg', ml: 'ml', мл: 'ml', l: 'l', л: 'l' };
  return { quantity, unit: units[match[3].toLowerCase()], ...(packs !== undefined ? { packs } : {}) };
}

// Find the first Product in the JSON-LD shapes commonly used by product pages.
function findProduct(value) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const product = findProduct(item);
      if (product) return product;
    }
    return null;
  }
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.includes('Product')) return value;
  return findProduct(value['@graph']);
}

// Ignore broken JSON-LD blocks so later valid product data can still be used.
function readProduct(blocks = []) {
  for (const block of blocks) {
    try {
      const product = findProduct(JSON.parse(block));
      if (product) return product;
    } catch {
      // A malformed script should not prevent the user from filling the form.
    }
  }
  return null;
}

// Accept prices only when their currency is explicit and supported by the form.
function readPrice(product, snapshot) {
  let offer = product?.offers;
  if (Array.isArray(offer)) offer = offer.length === 1 ? offer[0] : null;
  const offerCurrency = cleanText(offer?.priceCurrency).toUpperCase();
  const currencies = ['RUB', 'USD', 'EUR'];
  if (offerCurrency && !currencies.includes(offerCurrency)) return {};
  const offerTypes = Array.isArray(offer?.['@type']) ? offer['@type'] : [offer?.['@type']];
  const offerPrice = parseNumber(offer?.price);
  if (!offerTypes.includes('AggregateOffer') && offerPrice > 0 && currencies.includes(offerCurrency)) {
    return { price: offerPrice, currency: offerCurrency };
  }
  const price = parseNumber(snapshot.metaPrice);
  const currency = cleanText(snapshot.metaCurrency).toUpperCase();
  return price > 0 && currencies.includes(currency) ? { price, currency } : {};
}

// Read an explicit structured weight when the page title and name have no size.
function readWeight(weight) {
  const quantity = parseNumber(weight?.value);
  const units = { GRM: 'g', KGM: 'kg', g: 'g', kg: 'kg' };
  const unit = units[weight?.unitCode] || units[weight?.unitText];
  return quantity > 0 && unit ? { quantity, unit } : null;
}

// Combine structured product data and semantic fallbacks without inventing fields.
export function parseProductSnapshot(snapshot = {}) {
  const product = readProduct(snapshot.jsonLd);
  const name = [product?.name, snapshot.heading, snapshot.metaName, snapshot.title].map(cleanText).find(Boolean) || '';
  const size = [name, snapshot.heading, snapshot.title].map(parsePackageSize).find(Boolean)
    || readWeight(product?.weight) || parsePackageSize(product?.size);
  return { name: name.slice(0, 200), ...readPrice(product, snapshot), ...size };
}
