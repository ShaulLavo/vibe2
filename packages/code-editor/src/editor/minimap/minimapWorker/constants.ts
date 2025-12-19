// ============================================================================
// Constants (matches VS Code)
// ============================================================================

export const Constants = {
	START_CH_CODE: 32, // Space
	END_CH_CODE: 126, // Tilde (~)
	CHAR_COUNT: 126 - 32 + 2, // +1 for unknown char

	SAMPLED_CHAR_HEIGHT: 16,
	SAMPLED_CHAR_WIDTH: 10,

	BASE_CHAR_HEIGHT: 2,
	BASE_CHAR_WIDTH: 1,

	RGBA_CHANNELS_CNT: 4,
} as const

// Background color (dark editor background)
export const BACKGROUND_R = 24 // #18181b (zinc-900)
export const BACKGROUND_G = 24
export const BACKGROUND_B = 27

// Font variant intensity ratios (from VS Code)
export const NORMAL_FONT_RATIO = 12 / 15 // ~0.8
export const LIGHT_FONT_RATIO = 50 / 60 // ~0.83
