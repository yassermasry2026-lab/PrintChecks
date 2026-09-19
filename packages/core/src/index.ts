/**
 * @printchecks/core
 * Framework-agnostic core library for check printing, vendor management, and payment documentation
 */

// Main API
export { PrintChecksCore, type PrintChecksCoreConfig } from './PrintChecksCore'

// Models
export * from './models'

// Services
export * from './services'

// Storage
export * from './storage'

// Utilities
export * from './utils'

// Migration (schema versioning)
export * from './migration/types';
export * from './migration/registry';
export * from './migration/errors';
export * from './migration/v0-to-v1';
export * from './migration/AppDataMigrator';

// Version
export const VERSION = '1.0.0'
