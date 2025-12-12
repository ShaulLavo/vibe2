import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { iconsEnv } from './env'
import { PACKS, PackConfig } from './packs'

const execFileAsync = promisify(execFile)
const CACHE_ROOT = path.resolve('.cache/icons')

const ensureDir = async (dir: string) => {
	await mkdir(dir, { recursive: true })
}

const cloneRepo = async (repo: string, destination: string) => {
	await execFileAsync('git', ['clone', '--depth', '1', repo, destination])
}

const syncPack = async (pack: PackConfig) => {
	const tempDir = await mkdtemp(path.join(tmpdir(), `icons-${pack.shortName}-`))
	const destDir = path.join(CACHE_ROOT, pack.shortName)

	console.log(
		`📥 fetching ${pack.packName} (${pack.shortName}) from ${pack.repo}`
	)

	await cloneRepo(pack.repo, tempDir)
	await ensureDir(path.dirname(destDir))
	await rm(destDir, { recursive: true, force: true })
	await cp(tempDir, destDir, { recursive: true })
	await rm(tempDir, { recursive: true, force: true })

	console.log(
		`✅ cached ${pack.packName} at ${path.relative(process.cwd(), destDir)}`
	)
}

const selectPacks = () => {
	if (!iconsEnv.isolatePack) return PACKS
	return PACKS.filter((pack) => pack.shortName === iconsEnv.isolatePack)
}

const run = async () => {
	const packs = selectPacks()

	if (!packs.length) {
		console.warn('⚠️ No icon packs matched the current configuration.')
		return
	}

	await ensureDir(CACHE_ROOT)

	const queue = [...packs]
	const workers = Math.min(queue.length, iconsEnv.fetchConcurrency)

	const work = async (): Promise<void> => {
		const pack = queue.shift()
		if (!pack) return
		await syncPack(pack)
		return work()
	}

	await Promise.all(Array.from({ length: workers }, () => work()))
}

run().catch((error) => {
	console.error('Failed to fetch icon packs')
	console.error(error)
	process.exit(1)
})
