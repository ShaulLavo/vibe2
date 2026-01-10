import type { KeymapController } from '../../keymap/KeymapContext'

/**
 * Registers settings keyboard shortcuts with the KeymapController
 *
 * Shortcuts:
 * - Cmd/Ctrl+,: Open settings
 */
export function registerSettingsShortcuts(
	controller: KeymapController,
	openSettings: () => Promise<void>
) {
	// Register keybindings for settings shortcuts
	const cmdCommaBinding = controller.registerKeybinding({
		shortcut: 'meta+comma',
		id: 'settings.open-meta-comma',
		options: {
			preventDefault: true,
		},
	})

	const ctrlCommaBinding = controller.registerKeybinding({
		shortcut: 'ctrl+comma',
		id: 'settings.open-ctrl-comma',
		options: {
			preventDefault: true,
		},
	})

	// Register command for opening settings
	const openSettingsCommand = controller.registerCommand({
		id: 'settings.open',
		run: openSettings,
	})

	// Bind commands to keybindings in global scope
	const cmdCommaCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'settings.open-meta-comma',
		commandId: 'settings.open',
	})

	const ctrlCommaCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'settings.open-ctrl-comma',
		commandId: 'settings.open',
	})

	// Return cleanup function to unregister all shortcuts
	return () => {
		// Dispose command bindings
		cmdCommaCommandBinding()
		ctrlCommaCommandBinding()

		// Dispose commands
		openSettingsCommand()

		// Dispose keybindings
		cmdCommaBinding.dispose()
		ctrlCommaBinding.dispose()
	}
}
