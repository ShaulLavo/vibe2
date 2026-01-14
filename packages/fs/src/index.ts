export {
	getRootDirectory,
	DirectoryPickerUnavailableError,
	getMemoryRoot,
	MemoryDirectoryHandle,
	MemoryFileHandle,
	pickNewLocalRoot,
} from './getRoot'

// FilePath branded type for normalized paths
export {
	type FilePath,
	createFilePath,
	filePathEquals,
	filePathToString,
	toPosix,
	toDisplayPath,
	getParentPath,
	getBaseName,
	getExtension,
	joinPath,
	isChildOf,
	isRootPath,
	isFilePath,
	unsafeAsFilePath,
} from './types'
export { createFs, createStorage, VDir, VFile } from './vfs'
export {
	createWorkerStorage,
	createWorkerStorageNoCache,
	createStorageNoCache,
	createSyncStore,
} from './vfs'
export { buildFsTree, walkDirectory } from './vfs/utils/tree'
export type {
	FsContext,
	FsContextOptions,
	OpenMode,
	VfsReadableStream,
	TreeKind,
	FsTreeBase,
	FsFileTreeNode,
	FsDirTreeNode,
	FsTreeNode,
	FsTreeOptions,
	VfsStorage,
	CreateVfsStorageOptions,
	VfsStorageSource,
} from './vfs'
export type { MemHandle } from './getRoot'
export {
	FileSystemObserverPolyfill,
	createFileSystemObserver,
	hasNativeObserver,
} from './FileSystemObserver'
export type {
	FileSystemChangeType,
	FileSystemChangeRecord,
	FileSystemObserverCallback,
	FileSystemObserverOptions,
} from './FileSystemObserver'

// Unified observer with explicit capabilities
export {
	UnifiedObserver,
	createUnifiedObserver,
} from './observer'
export type {
	ObserverCapabilities,
	UnifiedChangeRecord,
	UnifiedObserverCallback,
	UnifiedObserverOptions,
} from './observer'

export { grep, grepStream, GrepCoordinator } from './grep'
export type {
	GrepOptions,
	GrepMatch,
	GrepFileResult,
	GrepProgress,
	GrepProgressCallback,
} from './grep'

export {
	ByteContentHandle,
	ByteContentHandleFactory,
	WriteTokenManager,
	FileSyncManager,
	FileStateTracker,
} from './sync'
export type {
	SyncState,
	ContentHandle,
	ContentHandleFactory,
	WriteToken,
	WriteTokenManagerOptions,
	TrackOptions,
	SyncEventType,
	SyncEvent,
	ExternalChangeEvent,
	ConflictEvent,
	ReloadedEvent,
	DeletedEvent,
	LocalChangesDiscardedEvent,
	SyncedEvent,
	SyncEventMap,
	SyncEventHandler,
	FileSyncManagerOptions,
	ObserverStrategy,
} from './sync'

// === NEW FILE LAYER (Layer 1) ===
// Stateless file handles with only directory handle caching
export {
	HandleCache,
	FileHandle,
	DirHandle,
	FileContextImpl,
	createFileContext,
} from './file'
export type {
	OpenMode as FileOpenMode,
	FileContextOptions,
	TreeKind as FileTreeKind,
	FsTreeBase as FileTreeBase,
	FileTreeNode,
	DirTreeNode,
	TreeNode,
	TreeOptions,
	ReadableByteStream,
	FileContext,
	ResolvedPath,
	FileContextInternal,
} from './file'

// === NEW SYNC LAYER (Layer 2) ===
// Simplified sync controller without write tokens
export { SyncController, type SyncControllerOptions } from './sync/SyncController'
export type {
	ConflictSource,
	ExternalFileChangeEvent,
	FileDeletedEvent,
	FileConflictEvent,
	SyncEvent as NewSyncEvent,
	SyncEventType as NewSyncEventType,
	SyncEventMap as NewSyncEventMap,
	SyncEventHandler as NewSyncEventHandler,
} from './sync/sync-types'
