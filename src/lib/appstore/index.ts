/**
 * App Store Connect API library
 */

// Types
export type {
  ASCApp,
  ASCVersion,
  ASCLocalization,
  ASCAppInfoLocalization,
  ASCResult,
  ASCCredentials,
  AppStoreLocale,
} from './types'

export { EDITABLE_STATES, ALL_LOCALES } from './types'

// API functions
export {
  generateJWT,
  getAuthHeaders,
  testConnection,
  getAppStoreInfo,
  listApps,
  getAppVersions,
  getEditableVersion,
  getVersionLocalizations,
  getAppInfoLocalizations,
} from './api'

// Credential helpers
export { getASCCredentials, hasASCCredentials } from './credentials'
