import OptionsSync from 'webext-options-sync';

export default new OptionsSync({
	defaults: {
		port: '8080',
		// Add any other default options here
	},
	migrations: [
		OptionsSync.migrations.removeUnused
	],
	logging: true
});
