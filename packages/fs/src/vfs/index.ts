export { VFile } from './vfile'
export { VDir } from './vdir'
export { createFs } from './fsContext'
export {
	createStore,
	type VfsStore,
	type CreateVfsStoreOptions,
	type VfsStoreSource
} from './store'
export { createWorkerStorage, createSyncStore } from './utils/workerStorage'
export type { FsContext } from './types'
export * from './types'
