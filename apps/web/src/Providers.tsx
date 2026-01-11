import {
	ColorModeProvider,
	ColorModeScript,
	createLocalStorageManager,
} from '@kobalte/core'
import { type ParentComponent } from 'solid-js'
import { ThemedToaster } from './ThemedToaster'
import { FocusProvider } from './focus/focusManager'
import { FsProvider } from './fs/context/FsProvider'
import { FontRegistryProvider } from './fonts'
import { SettingsProvider } from './settings/SettingsProvider'
import { SettingsEffects } from './settings/SettingsEffects'
import { KeymapProvider } from './keymap/KeymapContext'
import { FontZoomProvider } from './hooks/FontZoomProvider'
import { Modal } from '@repo/ui/modal'
import { ThemeProvider } from '@repo/theme'
import { CommandPaletteProvider } from './command-palette/CommandPaletteProvider'
import { CommandPalette } from './command-palette/CommandPalette'

export const storageManager = createLocalStorageManager('ui-theme')

export const Providers: ParentComponent = (props) => {
	return (
		<>
			<ColorModeScript storageType={storageManager.type} />
			<ColorModeProvider storageManager={storageManager}>
				<ThemeProvider>
					<SettingsProvider>
						<SettingsEffects />
						<KeymapProvider>
							<FocusProvider>
								<FontZoomProvider>
									<FsProvider>
										<FontRegistryProvider>
											<CommandPaletteProvider>
												<ThemedToaster />
												<Modal />
												<CommandPalette />
												{props.children}
											</CommandPaletteProvider>
										</FontRegistryProvider>
									</FsProvider>
								</FontZoomProvider>
							</FocusProvider>
						</KeymapProvider>
					</SettingsProvider>
				</ThemeProvider>
			</ColorModeProvider>
		</>
	)
}
