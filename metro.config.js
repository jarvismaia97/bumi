// Sentry's wrapper around Expo's default Metro config. It exists for one thing: stamping a
// unique Debug ID into each bundle and its source map, so a minified stack from a store build
// can be resolved back to this source. Without it the reports arrive as unreadable one-liners,
// which is most of the reason for having them.
//
// `getSentryExpoConfig` returns the same config `getDefaultConfig` would, plus that serializer,
// so nothing else about the bundle changes.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
