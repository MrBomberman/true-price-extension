import {
	validateProduct,
	calculateUnitPrice,
	compareProducts,
	formatMoney,
} from './calculations.js';
import { loadProducts, saveProducts } from './storage.js';
import { getCurrentPage } from './page.js';

// Find a form or interface control by its HTML ID.
const $ = (id) => document.getElementById(id);
const fields = [
	'name',
	'price',
	'currency',
	'quantity',
	'unit',
	'packs',
	'url',
];
const defaults = {
	name: '',
	price: '',
	currency: 'RUB',
	quantity: '',
	unit: 'g',
	packs: '1',
	url: '',
};
const dimensions = { weight: 'Weight', volume: 'Volume', count: 'Items' };
const exampleIds = [
	'true-cost-example-coffee-250',
	'true-cost-example-coffee-400',
];
const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });
const percentages = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 1,
});
let products = [];
let editingId = null;
let filter = 'all';
let loaded = false;
let busy = false;
let submitted = false;
let deleted = null;

// Show a short result message, optionally with the latest deletion’s Undo action.
function notify(message, allowUndo = false) {
	$('feedback-text').textContent = message;
	$('undo-button').hidden = !allowUndo;
	$('feedback').hidden = false;
}

// Prevent overlapping writes while an action is saving.
function setBusy(value) {
	busy = value;
	const controls = document.querySelectorAll(
		'#product-form input, #product-form select, #product-form button, ' +
			'#page-button, #product-list button, #undo-button, #examples-button, #retry-button',
	);
	controls.forEach((control) => {
		control.disabled = value;
	});
	$('submit-button').disabled = value || !loaded;
	$('examples-button').disabled = value || !loaded;
	$('product-form').setAttribute('aria-busy', String(value));
}

// Read the current form values for validation and calculation.
function readForm() {
	return Object.fromEntries(fields.map((field) => [field, $(field).value]));
}

// Keep the edited product's ID or create one for a new product.
function readProduct() {
	return { ...readForm(), id: editingId || crypto.randomUUID() };
}

// Show each validation message next to its associated input.
function showValidation(errors = {}) {
	for (const field of fields) {
		$(field + '-error').textContent = errors[field] || '';
		$(field).classList.toggle('is-invalid', Boolean(errors[field]));
		if (errors[field]) $(field).setAttribute('aria-invalid', 'true');
		else $(field).removeAttribute('aria-invalid');
	}
	if (errors.url) $('source-details').open = true;
}

// Show the live price per standard unit without requiring a finished product name.
function updatePreview() {
	let amount = '—';
	let baseUnit = { g: 'kg', kg: 'kg', ml: 'L', l: 'L', pcs: 'item' }[
		$('unit').value
	];
	try {
		const result = calculateUnitPrice(readForm());
		amount = formatMoney(result.unitPrice, $('currency').value);
		baseUnit = result.baseUnit;
	} catch {
		// Incomplete fields show a placeholder until there is enough to calculate.
	}
	$('preview-price').replaceChildren(
		document.createTextNode(amount + ' '),
		createElement(
			'small',
			'fw-normal text-body-secondary',
			`per ${baseUnit}`,
		),
	);
}

// Fill the form with a saved product or reset it for a new product.
function fillForm(product = defaults) {
	for (const field of fields) {
		$(field).value = product[field] ?? defaults[field];
	}
	editingId = product.id || null;
	$('form-title').textContent = editingId ? 'Edit product' : 'Add a product';
	$('submit-button').textContent = editingId
		? 'Save changes'
		: 'Add product +';
	$('cancel-button').hidden = !editingId;
	$('source-details').open = Boolean($('url').value);
	submitted = false;
	showValidation();
	updatePreview();
}

// Build interface content with text nodes rather than inserting user HTML.
function createElement(tag, className = '', text = '') {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text) node.textContent = text;
	return node;
}

// Create an accessible edit or delete button for a product card.
function actionButton(label, symbol, handler) {
	const button = createElement(
		'button',
		'btn btn-outline-secondary btn-sm',
		symbol,
	);
	button.type = 'button';
	button.setAttribute('aria-label', label);
	button.title = label;
	button.addEventListener('click', handler);
	return button;
}

// Render the selected measurement, keeping currencies in separate groups.
function renderProducts() {
	const list = $('product-list');
	list.replaceChildren();
	$('product-count').textContent = String(products.length);
	$('example-note').hidden = !products.some((product) =>
		exampleIds.includes(product.id),
	);
	$('examples-button').hidden =
		!products.length ||
		exampleIds.every((id) => products.some((product) => product.id === id));
	if (!loaded) {
		const empty = createElement(
			'div',
			'border rounded bg-white text-center p-4',
		);
		empty.append(
			createElement(
				'p',
				'',
				'Your products could not be loaded. Try loading again above.',
			),
		);
		list.append(empty);
		return;
	}
	const groups = compareProducts(products).filter(
		(group) => filter === 'all' || group.dimension === filter,
	);
	if (!groups.length) {
		const empty = createElement(
			'div',
			'border rounded bg-white text-center p-4',
		);
		const symbol = createElement('div', 'h2 text-success mb-3', '≋');
		symbol.setAttribute('aria-hidden', 'true');
		const title = products.length
			? 'Nothing in this measure yet.'
			: 'Find your better buy.';
		const explanation = products.length
			? 'Add a product with this measurement or choose another filter.'
			: 'Add similar products to see what each kilogram, liter, or item really costs.';
		empty.append(
			symbol,
			createElement('h3', 'h6', title),
			createElement('p', 'small text-body-secondary', explanation),
		);
		if (!products.length) {
			const example = createElement(
				'button',
				'btn btn-outline-secondary btn-sm',
				'Try example',
			);
			example.type = 'button';
			example.addEventListener('click', addExamples);
			empty.append(example);
		}
		list.append(empty);
		return;
	}
	for (const group of groups) {
		const section = createElement('section', 'mb-3');
		const heading = createElement(
			'h3',
			'h6 small text-body-secondary d-flex justify-content-between mt-3 mb-2',
		);
		heading.append(
			createElement(
				'span',
				'',
				`${dimensions[group.dimension]} · ${group.currency}`,
			),
			createElement('span', '', `per ${group.baseUnit}`),
		);
		section.append(heading);
		const tie = group.items.filter((item) => item.isBest).length > 1;
		for (const item of group.items)
			section.append(productCard(item, group, tie));
		list.append(section);
	}
}

// Show one package, its unit price, and its available actions.
function productCard(item, group, tie = false) {
	const baseUnit = group.baseUnit;
	const card = createElement(
		'article',
		`card p-3 mb-2${item.isBest ? ' border-success' : ''}`,
	);
	const top = createElement(
		'div',
		'd-flex justify-content-between align-items-start gap-2',
	);
	const title = createElement('div', 'text-break flex-grow-1');
	const unit = { pcs: 'items', l: 'L' }[item.unit] || item.unit;
	const amount = `${numbers.format(item.quantity)} ${unit}`;
	const packs = `${numbers.format(item.packs)} ${item.packs === 1 ? 'pack' : 'packs'}`;
	title.append(
		createElement('h3', 'h6 mb-1', item.name),
		createElement(
			'p',
			'small text-body-secondary mb-0',
			`${formatMoney(item.price, item.currency)} · ${amount} × ${packs}`,
		),
	);
	const actions = createElement('div', 'd-flex flex-shrink-0 gap-1');
	actions.append(
		actionButton(`Edit ${item.name}`, '✎', () => editProduct(item.id)),
		actionButton(`Delete ${item.name}`, '×', () => deleteProduct(item.id)),
	);
	top.append(title, actions);
	const bottom = createElement(
		'div',
		'd-flex justify-content-between align-items-center gap-2 mt-3',
	);
	const price = createElement('div', 'fs-5 fw-semibold text-break');
	price.append(
		document.createTextNode(
			formatMoney(item.unitPrice, item.currency) + ' ',
		),
		createElement(
			'small',
			'fw-normal text-body-secondary',
			`/ ${baseUnit}`,
		),
	);
	bottom.append(price);
	if (item.isBest) {
		bottom.append(
			createElement(
				'span',
				'badge text-bg-success',
				tie ? 'Equal best value' : 'Best value',
			),
		);
	} else if (item.premiumPercent > 0) {
		const premium =
			item.premiumPercent < 0.1
				? '<0.1'
				: percentages.format(item.premiumPercent);
		bottom.append(
			createElement(
				'span',
				'small text-body-secondary text-end',
				`${premium}% more per ${baseUnit}`,
			),
		);
	}
	card.append(top, bottom);
	// URLs have already been checked when products are loaded or saved.
	if (item.url) {
		const link = createElement(
			'a',
			'small mt-2 link-success',
			'View source ↗',
		);
		link.href = item.url;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		card.append(link);
	}
	return card;
}

// Bring a saved product into the form without changing the saved list.
function editProduct(id) {
	if (busy) return;
	fillForm(products.find((product) => product.id === id));
	$('name').focus();
	$('form-title').scrollIntoView({ block: 'nearest' });
}

// Save the smaller list first, then remember the removed product for Undo.
async function deleteProduct(id) {
	if (busy || !loaded) return;
	setBusy(true);
	const index = products.findIndex((item) => item.id === id);
	const product = products[index];
	const next = products.filter((item) => item.id !== id);
	try {
		await saveProducts(next);
		products = next;
		deleted = { product, index };
		renderProducts();
		if (editingId === id) fillForm();
		notify('Product removed.', true);
	} catch {
		notify('We could not remove that product. Try again.');
	} finally {
		setBusy(false);
	}
}

// Restore the most recently deleted product to its original position.
async function undoDelete() {
	if (!deleted || busy || !loaded) return;
	setBusy(true);
	try {
		const next = [...products];
		next.splice(deleted.index, 0, deleted.product);
		await saveProducts(next);
		products = next;
		deleted = null;
		renderProducts();
		notify('Product restored.');
	} catch {
		notify('We could not restore that product. Try Undo again.', true);
	} finally {
		setBusy(false);
	}
}

// Append the two labeled coffee examples without duplicating their IDs.
async function addExamples() {
	if (busy || !loaded) return;
	setBusy(true);
	const examples = [
		{
			id: exampleIds[0],
			name: 'Example · House blend, small bag',
			price: 900,
			quantity: 250,
		},
		{
			id: exampleIds[1],
			name: 'Example · House blend, large bag',
			price: 1250,
			quantity: 400,
		},
	]
		.filter((item) => !products.some((product) => product.id === item.id))
		.map((item) => ({
			...item,
			currency: 'RUB',
			unit: 'g',
			packs: 1,
			url: '',
		}));
	try {
		const next = [...products, ...examples];
		await saveProducts(next);
		products = next;
		renderProducts();
		notify(
			`${examples.length} coffee ${examples.length === 1 ? 'example' : 'examples'} added. Compare their price per kilogram.`,
		);
	} catch {
		notify('We could not save the examples. Try again.');
	} finally {
		setBusy(false);
	}
}

// Update the preview and refresh errors as the user types.
$('product-form').addEventListener('input', () => {
	updatePreview();
	if (submitted) showValidation(validateProduct(readProduct()).errors);
});

// Keep the original list and form until the product write succeeds.
$('product-form').addEventListener('submit', async (event) => {
	event.preventDefault();
	if (busy || !loaded) return;
	submitted = true;
	const result = validateProduct(readProduct());
	showValidation(result.errors);
	if (!result.valid) {
		const field = fields.find((name) => result.errors[name]);
		if (field) $(field).focus();
		notify('Check the highlighted fields to add this product.');
		return;
	}
	const wasEditing = Boolean(editingId);
	const next = wasEditing
		? products.map((item) => (item.id === editingId ? result.value : item))
		: [...products, result.value];
	setBusy(true);
	try {
		await saveProducts(next);
		products = next;
		fillForm();
		renderProducts();
		notify(wasEditing ? 'Changes saved.' : 'Product added.');
	} catch {
		notify(
			'We could not save this product. Your form is still here; try again.',
		);
	} finally {
		setBusy(false);
		$('name').focus();
	}
});

// Leave edit mode and reset the temporary form.
$('cancel-button').addEventListener('click', () => {
	if (busy) return;
	fillForm();
	notify('Edit canceled.');
});

// Try to fill available product details after an explicit click; all fields stay editable.
$('page-button').addEventListener('click', async () => {
	if (busy) return;
	setBusy(true);
	try {
		const page = await getCurrentPage();
		for (const field of fields) {
			if (page[field] !== undefined) $(field).value = page[field];
		}
		// A newly detected single package must not inherit the previous product's pack count.
		if (page.quantity !== undefined) $('packs').value = page.packs ?? 1;
		$('source-details').open = Boolean(page.url);
		showValidation();
		updatePreview();
		if (page.price !== undefined && page.quantity !== undefined) {
			notify(
				'Product details found. Review the price, currency and package size before saving.',
			);
		} else if (page.price !== undefined || page.quantity !== undefined) {
			notify(
				'Some product details found. Review the values and fill in the missing fields.',
			);
		} else {
			notify(
				'Name and link added. Enter the price and package size manually.',
			);
		}
	} catch {
		const message = globalThis.chrome?.runtime?.id
			? 'Open a product website, then use the extension’s toolbar popup and choose Use current page.'
			: 'Install the Chrome extension to use the current page. You can still enter a name and link manually.';
		notify(message);
	} finally {
		setBusy(false);
	}
});

// Change the comparison filter while leaving the form untouched.
document.querySelectorAll('[data-filter]').forEach((button) =>
	button.addEventListener('click', () => {
		filter = button.dataset.filter;
		document.querySelectorAll('[data-filter]').forEach((chip) => {
			chip.setAttribute('aria-pressed', String(chip === button));
			chip.classList.toggle('btn-success', chip === button);
			chip.classList.toggle('btn-outline-success', chip !== button);
		});
		renderProducts();
		if (busy) setBusy(true);
	}),
);
$('undo-button').addEventListener('click', undoDelete);
$('examples-button').addEventListener('click', addExamples);
// Dismiss feedback without changing saved data.
$('dismiss-button').addEventListener('click', () => {
	$('feedback').hidden = true;
});
$('retry-button').addEventListener('click', initialize);

// Load saved products and protect the list if storage cannot be read.
async function initialize() {
	setBusy(true);
	try {
		products = await loadProducts();
		loaded = true;
		$('load-error').hidden = true;
	} catch {
		loaded = false;
		$('load-error-text').textContent =
			'Your saved products could not be loaded. Adding and removing products is paused to protect your list.';
		$('load-error').hidden = false;
	}
	renderProducts();
	setBusy(false);
}

fillForm();
initialize();
