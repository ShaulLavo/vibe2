import type { TerminalLike } from './localEcho/types'

/**
 * Types out text character by character with a realistic typing effect
 */
export async function typeEffect(
	terminal: TerminalLike,
	text: string,
	delay: number = 100
) {
	for (let i = 0; i < text.length; i++) {
		terminal.write(text.charAt(i))
		const randomDelay = delay + Math.floor(Math.random() * 50 - 25) // Adding randomness to the delay
		await new Promise((resolve) => setTimeout(resolve, randomDelay))
	}
	terminal.write('\r\n')
}

/**
 * Creates a snake animation that moves around a square border
 */
export function createSnakeSquareAnimation(size: number): string[] {
	const frames: string[] = []
	const total = (size - 1) * 4 // Total positions around the border

	for (let pos = 0; pos < total; pos++) {
		const lines: string[] = []
		for (let y = 0; y < size; y++) {
			let row = ''
			for (let x = 0; x < size; x++) {
				const cellPos = getPositionOnBorder(x, y, size)
				row += cellPos === pos ? '█' : '·'
			}
			lines.push(row)
		}
		frames.push(lines.join('\n'))
	}

	return frames
}

/**
 * Gets the position index of a cell on the border of a square
 */
function getPositionOnBorder(x: number, y: number, size: number): number {
	// Top edge (left to right)
	if (y === 0) return x
	// Right edge (top to bottom, excluding corner)
	if (x === size - 1 && y > 0) return size - 1 + y
	// Bottom edge (right to left, excluding corner)
	if (y === size - 1 && x < size - 1) return 2 * (size - 1) + (size - 1 - x)
	// Left edge (bottom to top, excluding corners)
	if (x === 0 && y > 0 && y < size - 1) return 3 * (size - 1) + (size - 1 - y)
	return -1
}

/**
 * Gets loading stage messages for different operations
 */
export function getLoadingStages(type: string): string[] {
	switch (type) {
		case 'build':
			return [
				'Compiling...',
				'Bundling modules...',
				'Optimizing assets...',
				'Generating output...',
				'Build complete!',
			]
		case 'install':
			return [
				'Resolving dependencies...',
				'Fetching packages...',
				'Linking modules...',
				'Building native extensions...',
				'Installation complete!',
			]
		case 'deploy':
			return [
				'Preparing deployment...',
				'Uploading files...',
				'Configuring environment...',
				'Starting services...',
				'Deployment complete!',
			]
		default:
			return ['Loading...', 'Processing...', 'Almost there...', 'Done!']
	}
}

/**
 * Runs a loading animation with spinner and stages
 */
export async function loadingAnimation(
	terminal: TerminalLike,
	type: string,
	options: { duration?: number; showStages?: boolean } = {}
): Promise<void> {
	const { duration = 2000, showStages = true } = options
	const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
	const stages = showStages ? getLoadingStages(type) : ['Loading...']
	const stageInterval = duration / stages.length
	const frameInterval = 80

	let currentStage = 0
	let frameIndex = 0
	const startTime = Date.now()

	while (Date.now() - startTime < duration) {
		const elapsed = Date.now() - startTime
		currentStage = Math.min(
			Math.floor(elapsed / stageInterval),
			stages.length - 1
		)

		terminal.write(`\r${spinnerFrames[frameIndex]} ${stages[currentStage]}`)
		frameIndex = (frameIndex + 1) % spinnerFrames.length

		await new Promise((resolve) => setTimeout(resolve, frameInterval))
	}

	// Clear the line and show completion
	terminal.write('\r\x1b[K')
	terminal.write(`✓ ${stages[stages.length - 1]}\r\n`)
}

// Default welcome message
export const WELCOME_MESSAGE = `Welcome to vibe shell (powered by just-bash)
Type \`help\` to see available commands.`
