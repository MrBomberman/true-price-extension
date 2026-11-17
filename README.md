# True Cost

#### Video Demo: https://youtu.be/gQgO0KDbvHg

#### Description:

True Cost is a Chrome extension that compares similar products by their price per kilogram, liter or item. Package prices can be misleading: a smaller bag of coffee may cost less at checkout but more per kilogram. True Cost keeps the calculation visible and saves the products you want to compare.

The extension uses plain HTML and JavaScript, with [Bootstrap 5.3.9 CSS](https://getbootstrap.com/docs/5.3/getting-started/download/) linked from jsDelivr. Bootstrap components and utility classes provide the styling, with a fixed popup width. There are no runtime JavaScript dependencies, API keys, accounts, remote scripts or build steps. The stylesheet uses a pinned version and a Subresource Integrity hash. Its standard visual styling needs an internet connection; calculations and local storage do not.

## Install in Chrome

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the project directory containing `manifest.json`.
5. Open Chrome's extensions menu and pin **True Cost**.
6. Open a product website and click the True Cost toolbar icon.

The project root is the extension directory: there is no `dist` folder to build. After changing a file, click **Reload** on its card in `chrome://extensions` and reopen the popup.

## Compare products

Add a product name, package price, package quantity, unit and currency. For a multipack, enter the size of one package and the number of packages. For example, six bottles of 200 ml are entered as quantity `200`, unit `ml`, packages `6`.

Use **Use current page** to fill details from the active product page. The helper tries structured Product/Offer data, product meta tags and semantic fields for the name and price. It also looks for a package size such as `250 g`, `0.5 kg` or `6 × 200 ml` in the product name, including common Russian unit labels.

Autofill is best effort: review the detected price, currency and quantity before saving. Prices can vary with the selected variant, account, delivery region or loyalty offer, and some websites expose no useful metadata. Missing details remain available for manual entry. The helper runs only after your click and makes no external requests.

The calculation is:

```text
total quantity = quantity per package × number of packages
unit price = package price / total quantity in the base unit
```

Enter the price for the **entire multipack**, not the price of one item in it. Grams are converted to kilograms, milliliters to liters, and item counts remain item counts.

For example:

| Product           |     Price | Quantity |   Unit price |
| ----------------- | --------: | -------: | -----------: |
| Coffee, small bag |   RUB 900 |    250 g | RUB 3,600/kg |
| Coffee, large bag | RUB 1,250 |    400 g | RUB 3,125/kg |

The large bag saves RUB 475 per kilogram. Products are ranked using the full calculated value; rounding is only applied for display. Currency conversion is intentionally excluded: RUB, USD and EUR are compared separately, as are weight, volume and item counts. Compare similar products yourself; equal units alone do not make two products equivalent.

You can edit or remove saved products. Unfinished form input is temporary and resets when you close the popup. Sample products are available through an explicit demo action and are labeled as examples rather than real store prices.

## Storage and permissions

The extension stores products in `chrome.storage.local`. They remain on your Chrome profile and are not uploaded anywhere. Uninstalling the extension removes its local storage. Browser preview uses the separate `localStorage` of its localhost origin; preview data does not synchronize with the installed extension.

The manifest requests three permissions:

- **storage** saves products locally.
- **activeTab** allows reading the current tab's title and URL after you open the extension. There is no persistent permission to read all websites.
- **scripting** runs the product-reading helper on that active page after you click **Use current page**.

There is no persistent content script or background worker. The only automatic network resource is the Bootstrap stylesheet; product data is never included in that request. The injected helper only reads the page and does not change it. True Cost does not automatically scan websites, fetch prices, watch browsing history or monitor products in the background. Chrome's internal pages and local files do not provide supported product URLs. You can still enter a product manually.

Product names are rendered as text. Saved source links accept only HTTP and HTTPS URLs. Invalid or nonpositive quantities and prices are rejected, and storage failures are shown instead of reporting a successful save.

## Files and design

| File                | Responsibility                                                   |
| ------------------- | ---------------------------------------------------------------- |
| `manifest.json`     | Manifest V3 configuration, toolbar action, icons and permissions |
| `popup.html`        | Accessible form and comparison interface                         |
| `popup.js`          | Form state, rendering and user actions                           |
| `calculations.js`   | Input validation, unit conversion, ranking and formatting        |
| `storage.js`        | Local product persistence                                        |
| `page.js`           | Active-tab capture and read-only product metadata collection     |
| `product-parser.js` | Product names, prices, currencies and package-size extraction    |
| `assets/`           | Local logo and Chrome extension icons                            |
| `tests/`            | Node tests for calculations, storage and active-tab behavior     |
| `eslint.config.js`  | JavaScript checks for browser code and Node.js tests             |
| `.prettierrc.json`  | Tab indentation and consistent JavaScript/HTML formatting        |

Keeping arithmetic separate from the DOM lets the calculations be tested without a browser. Keeping storage separate allows errors to be handled before the displayed product list changes. The interface and extension both use ES modules supported directly by Chrome. Bootstrap is loaded with a stylesheet link; its JavaScript bundle is not needed.

## Development and checks

For development, use a maintained Node.js release compatible with ESLint: 22.13+ (22.x) or 24+. Install the development tools once:

```sh
npm ci
```

Run ESLint and Prettier together:

```sh
npm run lint
```

Apply automatic fixes and format the code with tabs:

```sh
npm run lint:fix
```

Run the behavioral tests:

```sh
npm test
```

Chrome loads the extension directly from its folder. To view the interface in a normal browser, run:

```sh
npm run preview
```

Open `http://127.0.0.1:4173/popup.html` for the interface. Reading the current tab is available only in the installed Chrome extension. To test autofill, open a product website and launch the installed extension from Chrome's toolbar.

## Limitations and next steps

This version compares the values you enter. It does not verify live store prices, infer product categories, convert currencies or account for delivery fees, coupons and taxes. Use a consistent final purchase price when entering each offer. Missing or changed page titles do not prevent manual entry.

For a CS50 presentation, explain the calculation and the separation between the popup, storage and tab APIs. A short demonstration can show the coffee example, edit one price, compare a multipack, and close and reopen the extension to show persistence. Add your own video link and presentation details when they are ready. Check the current course instructions before submitting; this repository is the software project, not a completed course submission.

## AI assistance

I built True Cost in collaboration with OpenAI Codex (ChatGPT).

Codex helped with architecture discussions, project configuration, code generation and refactoring, test development, debugging, icons, and documentation.
