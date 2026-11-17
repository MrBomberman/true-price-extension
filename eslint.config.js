import js from '@eslint/js';
import globals from 'globals';

export default [
	{ ignores: ['artifacts/**'] },
	js.configs.recommended,
	{
		files: ['*.js'],
		ignores: ['eslint.config.js'],
		languageOptions: { globals: globals.browser },
	},
	{
		files: ['tests/**/*.js', 'eslint.config.js'],
		languageOptions: { globals: globals.nodeBuiltin },
	},
];
