// Core services
export { fontCacheService } from './FontCacheService'
export { fontMetadataService } from './FontMetadataService'
export { fontDownloadService } from './FontDownloadService'
export { fontInstallationService } from './FontInstallationService'

// Service Worker infrastructure
export { serviceWorkerManager } from './ServiceWorkerManager'
export { cacheManifestService } from './CacheManifestService'
export { cacheMonitoringService } from './CacheMonitoringService'
export { cacheManagementUtilities } from './CacheManagementUtilities'

// Error handling and recovery
export { cacheErrorRecovery } from './CacheErrorRecovery'
export { RetryService } from './RetryService'

// Restoration service
export { FontRestorationService } from './FontRestorationService'

// Type exports
export type { FontMetadata, CacheStats } from './FontMetadataService'
export type {
	ServiceWorkerCacheStats,
	ServiceWorkerCleanupResult,
	ServiceWorkerClearResult,
} from './ServiceWorkerManager'
export type { CacheManifestEntry, CacheManifest } from './CacheManifestService'
export type {
	CacheMonitoringStats,
	CacheCleanupOptions,
	CacheCleanupResult,
	CacheHealthCheck,
} from './CacheMonitoringService'
export type {
	CacheOptimizationResult,
	CacheMaintenanceSchedule,
	CacheBackupResult,
	CacheRestoreResult,
} from './CacheManagementUtilities'
