export const constants = {
	Z_BEST_COMPRESSION: 9,
	Z_BEST_SPEED: 1,
	Z_DEFAULT_COMPRESSION: -1,
}

export const gzipSync = () => {
	throw new Error('node:zlib is not available in the browser')
}

export const gunzipSync = () => {
	throw new Error('node:zlib is not available in the browser')
}
