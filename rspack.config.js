const config = require('openmrs/default-rspack-config');

// The patient common library publishes TypeScript source rather than compiled JavaScript.
config.scriptRuleConfig.exclude = /node_modules[\\/](?!@openmrs[\\/]esm-patient-common-lib[\\/])/;

module.exports = config;
