class DualStorage implements Storage {
	private getUniqueKeys(): string[] {
		const sessionLength = sessionStorage.length
		const localLength = localStorage.length
		const keys: string[] = []
		const seen = new Set<string>()

		for (let i = 0; i < sessionLength; i++) {
			const key = sessionStorage.key(i)
			if (key && !seen.has(key)) {
				keys.push(key)
				seen.add(key)
			}
		}

		for (let i = 0; i < localLength; i++) {
			const key = localStorage.key(i)
			if (key && !seen.has(key)) {
				keys.push(key)
				seen.add(key)
			}
		}

		return keys
	}

	get length(): number {
		return this.getUniqueKeys().length
	}

	clear(): void {
		sessionStorage.clear()
		localStorage.clear()
	}

	getItem(key: string): string | null {
		return sessionStorage.getItem(key) ?? localStorage.getItem(key)
	}

	key(index: number): string | null {
		const keys = this.getUniqueKeys()
		return keys[index] ?? null
	}

	removeItem(key: string): void {
		sessionStorage.removeItem(key)
		localStorage.removeItem(key)
	}

	setItem(key: string, value: string): void {
		sessionStorage.setItem(key, value)
		localStorage.setItem(key, value)
	}
}

export const dualStorage = new DualStorage()
