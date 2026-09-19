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

// Version
export const VERSION = '1.0.0'
