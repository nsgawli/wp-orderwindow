const defaultConfig = require('./node_modules/@wordpress/scripts/config/webpack.config');

const path = require('path');

module.exports = {
	...defaultConfig,
	performance: {
		hints: false,
	},
	resolve: {
		...defaultConfig.resolve,
		alias: {
			...defaultConfig.resolve.alias,
			'@': path.resolve(__dirname, './src/'),
			'@framework': path.resolve(__dirname, './src/framework/'),
		},
	},
	entry: {
		...defaultConfig.entry,
		'admin-settings/index': path.resolve(
			process.cwd(),
			'src',
			'admin-settings',
			'index.js'
		),
		'storefront-status/index': path.resolve(
			process.cwd(),
			'src',
			'storefront-status',
			'index.js'
		),
		'blocks/store-status/index': path.resolve(
			process.cwd(),
			'src',
			'blocks',
			'store-status',
			'index.js'
		),
		'blocks/opening-hours/index': path.resolve(
			process.cwd(),
			'src',
			'blocks',
			'opening-hours',
			'index.js'
		),
		'common/index': path.resolve(
			process.cwd(),
			'src',
			'common',
			'index.js'
		),
	},
};
