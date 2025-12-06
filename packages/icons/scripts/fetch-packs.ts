import { mkdir, mkdtemp, rm, cp, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import packages from '../src/build/packages.json' assert { type: 'json' }

const execFileAsync = promisify(execFile)
const ICONS_ROOT = path.resolve(process.cwd(), 'src', 'icons')

const ensureDir = async (dir: string) => {
	try {
		await stat(dir)
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			await mkdir(dir, { recursive: true })
		} else {
			throw error
		}
	}
}

const cloneRepo = async (url: string, dest: string) => {
	const repoUrl = url.endsWith('.git') ? url : `${url}.git`
	await execFileAsync('git', ['clone', '--depth', '1', repoUrl, dest])
}

const syncPack = async (
	shortName: string,
	repoUrl: string,
	folderName: string
) => {
	const tempDir = await mkdtemp(path.join(tmpdir(), `icons-pack-${shortName}-`))
	const destDir = path.resolve(ICONS_ROOT, folderName)

	console.log(`📦 syncing ${shortName} from ${repoUrl}`)

	await cloneRepo(repoUrl, tempDir)
	await ensureDir(path.dirname(destDir))
	await rm(destDir, { recursive: true, force: true })
	await cp(tempDir, destDir, { recursive: true })
	await rm(tempDir, { recursive: true, force: true })

	console.log(`✅ ${shortName} icons available at ${path.relative(process.cwd(), destDir)}`)
}

const run = async () => {
	const queue = [...packages]
	const workers = Math.min(
		queue.length,
		Number.parseInt(process.env.ICONS_FETCH_CONCURRENCY ?? '4', 10)
	)

	const work = async (): Promise<void> => {
		const item = queue.shift()
		if (!item) return
		await syncPack(item.shortName, item.url, item.folderName)
		return work()
	}

	await Promise.all(Array.from({ length: workers }, () => work()))
}

run().catch(error => {
	console.error('Failed to fetch icon packs')
	console.error(error)
	process.exitCode = 1
})
