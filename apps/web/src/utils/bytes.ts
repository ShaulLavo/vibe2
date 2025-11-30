const formatBytes = (bytes: number): string => {
	if (bytes === 0) return '0 Bytes'

	const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'] as const
	const index = Math.floor(Math.log(bytes) / Math.log(1024))

	const value = (bytes / 1024 ** index).toFixed(2)

	return `${value} ${units[index]}`
}
export { formatBytes }
