import { hash } from 'ohash'
import type { ContentHandle, ContentHandleFactory } from './types'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()


export class ByteContentHandle implements ContentHandle {
	private readonly data: Uint8Array
	private cachedHash: string | null = null

	constructor(data: Uint8Array) {
		this.data = data
	}

	hash(): string {
		if (this.cachedHash === null) {
			this.cachedHash = hash(this.data)
		}
		return this.cachedHash
	}

	equals(other: ContentHandle): boolean {
		return this.hash() === other.hash()
	}

	toBytes(): Uint8Array {
		return this.data
	}

	toString(): string {
		return textDecoder.decode(this.data)
	}
}


const EMPTY_HANDLE = new ByteContentHandle(new Uint8Array(0))


export const ByteContentHandleFactory: ContentHandleFactory = {
	fromBytes(data: Uint8Array): ContentHandle {
		if (data.length === 0) {
			return EMPTY_HANDLE
		}
		return new ByteContentHandle(data)
	},

	fromString(data: string): ContentHandle {
		if (data.length === 0) {
			return EMPTY_HANDLE
		}
		return new ByteContentHandle(textEncoder.encode(data))
	},

	empty(): ContentHandle {
		return EMPTY_HANDLE
	},
}
