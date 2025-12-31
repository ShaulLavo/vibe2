import { Bash } from 'just-bash'
import type { FsContext, FsDirTreeNode } from '@repo/fs'
import { VfsBashAdapter } from './VfsBashAdapter'

export type JustBashAdapter = {
	exec: (
		command: string
	) => Promise<{ stdout: string; stderr: string; exitCode: number }>
	dispose: () => void
	/** Get the VFS adapter if using real filesystem */
	getVfsAdapter: () => VfsBashAdapter | undefined
}

export function createJustBashAdapter(
	fsContext?: FsContext,
	tree?: FsDirTreeNode
): JustBashAdapter {
	const vfsAdapter = fsContext ? new VfsBashAdapter(fsContext, tree) : undefined
	const bash = new Bash({
		fs: vfsAdapter,
		cwd: '/',
	})
	return {
		exec: (cmd: string) => bash.exec(cmd),
		dispose: () => {},
		getVfsAdapter: () => vfsAdapter,
	}
}
