// New sync layer exports
export { SyncController, type SyncControllerOptions } from './SyncController'
export type {
	ConflictSource,
	ExternalFileChangeEvent,
	FileDeletedEvent,
	FileConflictEvent,
	SyncEvent,
	SyncEventType,
	SyncEventMap,
	SyncEventHandler,
} from './sync-types'

// Keep these - still useful
export { ByteContentHandle, ByteContentHandleFactory } from './content-handle'
export type { ContentHandle, ContentHandleFactory, SyncState } from './types'

// Observer strategy - still useful
export {
	NativeObserverStrategy,
	PollingObserverStrategy,
	FileSystemObserverManager,
	type ObserverStrategy,
} from './observer-strategy'
