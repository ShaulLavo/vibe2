import type { Component } from 'solid-js'
import { createSignal, createMemo, createEffect } from 'solid-js'
import {
	Editor,
	type TextEditorDocument,
	type EditorError,
} from '@repo/code-editor'
import { ensureFs } from '../../fs/runtime/fsRuntime'
import { useSettings } from '../SettingsProvider'
import { createPieceTableSnapshot } from '@repo/utils'

const SETTINGS_FILE_PATH = '/.system/settings.json'

export const SettingsJSONTab: Component = () => {
	const [settingsState, settingsActions] = useSettings()
	const [fileContent, setFileContent] = createSignal('')
	const [isLoaded, setIsLoaded] = createSignal(false)
	const [pieceTable, setPieceTable] = createSignal(createPieceTableSnapshot(''))
	const [validationErrors, setValidationErrors] = createSignal<EditorError[]>(
		[]
	)
	const [lastSavedContent, setLastSavedContent] = createSignal('')

	// Validate JSON content and return errors
	const validateJSON = (content: string): EditorError[] => {
		const errors: EditorError[] = []

		try {
			JSON.parse(content)
			// If parsing succeeds, no errors
		} catch (error) {
			if (error instanceof SyntaxError) {
				// Try to extract position information from the error message
				const message = error.message
				let startIndex = 0
				let endIndex = content.length

				// Look for position information in the error message
				const positionMatch = message.match(/position (\d+)/)
				if (positionMatch) {
					const position = parseInt(positionMatch[1], 10)
					startIndex = Math.max(0, position - 1)
					endIndex = Math.min(content.length, position + 1)
				}

				errors.push({
					startIndex,
					endIndex,
					message: `JSON Syntax Error: ${message}`,
					isMissing: false,
				})
			}
		}

		return errors
	}

	// Load settings file content
	const loadSettingsFile = async () => {
		try {
			const ctx = await ensureFs('opfs')
			const exists = await ctx.exists(SETTINGS_FILE_PATH)

			let content = ''
			if (exists) {
				const file = ctx.file(SETTINGS_FILE_PATH, 'r')
				content = await file.text()
			} else {
				// Create initial empty settings file if it doesn't exist
				content = JSON.stringify(settingsState.values, null, 2)
				await ctx.ensureDir('/.system')
				await ctx.write(SETTINGS_FILE_PATH, content)
			}

			setFileContent(content)
			setLastSavedContent(content)
			setPieceTable(createPieceTableSnapshot(content))
			setValidationErrors(validateJSON(content))
			setIsLoaded(true)
		} catch (error) {
			console.error('[SettingsJSONTab] Failed to load settings file:', error)
			// Fallback to current settings values
			const content = JSON.stringify(settingsState.values, null, 2)
			setFileContent(content)
			setLastSavedContent(content)
			setPieceTable(createPieceTableSnapshot(content))
			setValidationErrors(validateJSON(content))
			setIsLoaded(true)
		}
	}

	// Save settings file content
	const saveSettingsFile = async (content: string) => {
		try {
			// Validate JSON format first
			const errors = validateJSON(content)
			if (errors.length > 0) {
				console.error('[SettingsJSONTab] Cannot save invalid JSON:', errors)
				return false
			}

			const parsed = JSON.parse(content)

			// TODO: Auto-format JSON on save (not yet supported by code editor)
			// For now, we save the content as-is

			// Save to VFS
			const ctx = await ensureFs('opfs')
			await ctx.ensureDir('/.system')
			await ctx.write(SETTINGS_FILE_PATH, content)

			// Update settings store with parsed values
			// Reset all settings first, then apply the new values
			settingsActions.resetAllSettings()
			for (const [key, value] of Object.entries(parsed)) {
				settingsActions.setSetting(key, value)
			}

			setLastSavedContent(content)
			console.log('[SettingsJSONTab] Settings saved successfully')
			return true
		} catch (error) {
			console.error('[SettingsJSONTab] Failed to save settings:', error)
			return false
		}
	}

	// Initialize on mount
	createEffect(() => {
		if (settingsState.isLoaded && !isLoaded()) {
			void loadSettingsFile()
		}
	})

	// Validate content on change and update errors
	createEffect(() => {
		const content = fileContent()
		if (content !== lastSavedContent()) {
			const errors = validateJSON(content)
			setValidationErrors(errors)
		}
	})

	// Create editor document
	const editorDocument: TextEditorDocument = {
		filePath: () => SETTINGS_FILE_PATH,
		content: fileContent,
		pieceTable: pieceTable,
		updatePieceTable: (updater) => {
			const current = pieceTable()
			const updated = updater(current)
			if (updated) {
				setPieceTable(updated)
				// Update file content from piece table
				const newContent = updated.text
				setFileContent(newContent)
			}
		},
		isEditable: () => true,
	}

	// Handle save action (Ctrl+S)
	const handleSave = () => {
		void saveSettingsFile(fileContent())
	}

	// Editor stats (for syntax highlighting)
	const editorStats = createMemo(() => ({
		language: 'json',
		size: fileContent().length,
		lines: fileContent().split('\n').length,
	}))

	// Check if content has unsaved changes
	const hasUnsavedChanges = createMemo(() => {
		return fileContent() !== lastSavedContent()
	})

	return (
		<div class="flex flex-col h-full bg-background">
			{isLoaded() ? (
				<>
					{/* Status bar showing validation errors and save status */}
					{(validationErrors().length > 0 || hasUnsavedChanges()) && (
						<div class="flex-shrink-0 px-4 py-2 border-b border-border bg-muted/50">
							{validationErrors().length > 0 && (
								<div class="text-sm text-destructive">
									⚠️ JSON validation errors: {validationErrors().length}{' '}
									error(s)
								</div>
							)}
							{hasUnsavedChanges() && validationErrors().length === 0 && (
								<div class="text-sm text-muted-foreground">
									• Unsaved changes (Ctrl+S to save)
								</div>
							)}
						</div>
					)}

					<Editor
						document={editorDocument}
						isFileSelected={() => true}
						stats={() => editorStats()}
						fontSize={() => 14}
						fontFamily={() => 'JetBrains Mono'}
						cursorMode={() => 'regular' as const}
						tabSize={() => 2}
						onSave={handleSave}
						errors={() => validationErrors()}
					/>
				</>
			) : (
				<div class="flex items-center justify-center h-full text-muted-foreground">
					Loading settings...
				</div>
			)}
		</div>
	)
}
