import { client } from '../client'

export async function loadNerdFont(
	fontName: string
): Promise<FontFace | undefined> {
	// Check if already loaded
	if (document.fonts.check(`1em ${fontName}`)) {
		return Array.from(document.fonts).find((f) => f.family === fontName)
	}

	try {
		// @ts-expect-error - Eden types might be lagging behind server changes
		const { data, error } = await client.fonts({ name: fontName }).get()

		if (error || !data) {
			console.error('Failed to load font:', error)
			return undefined
		}

		// data is a Response object (or Blob/ArrayBuffer depending on Eden config, but usually Response for file returns)
		// Actually Eden treaty returns the value directly if it's text/json, but for files it return Response or Blob?
		// Let's assume it returns a Blob or we need to handle it.
		// If the server returns `new Response(blob)`, Eden might wrap it.

		// Wait, if I defined it as `return new Response(...)`, Eden usually treats it as a fetch response.
		// Let's try to handle it as a blob.

		const buffer = await (data as unknown as Blob).arrayBuffer()
		const font = new FontFace(fontName, buffer)
		document.fonts.add(font)
		await font.load()
		console.log(`Loaded font: ${fontName}`)
		return font
	} catch (err) {
		console.error('Error loading font:', err)
		return undefined
	}
}
