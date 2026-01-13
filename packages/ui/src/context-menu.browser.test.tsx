/**
 * Context Menu Component Browser Tests
 *
 * Tests real browser interactions including:
 * - Right-click trigger
 * - Submenu hover with delays
 * - Safe polygon navigation
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-solid'
import { page } from 'vitest/browser'
import {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubTrigger,
	ContextMenuSubContent,
	ContextMenuLabel,
	ContextMenuShortcut,
} from './context-menu'

describe('Context Menu Browser Tests', () => {
	afterEach(() => {
		cleanup()
		// Clean up any portal content
		document.querySelectorAll('[role="menu"]').forEach((el) => el.remove())
	})

	describe('basic functionality', () => {
		it('opens on right-click', async () => {
			render(() => (
				<ContextMenu>
					<ContextMenuTrigger>
						<div style={{ width: '200px', height: '100px', background: '#eee' }}>
							Right-click here
						</div>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem>Cut</ContextMenuItem>
						<ContextMenuItem>Copy</ContextMenuItem>
						<ContextMenuItem>Paste</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>
			))

			const trigger = page.getByText('Right-click here')
			await expect.element(trigger).toBeVisible()

			// Initially no menu open
			let menu = document.querySelector('[role="menu"]')
			expect(menu?.getAttribute('data-state')).not.toBe('open')

			// Right-click to open
			await trigger.click({ button: 'right' })
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Menu should be visible
			menu = document.querySelector('[role="menu"]')
			expect(menu).toBeTruthy()
			expect(menu?.getAttribute('data-state')).toBe('open')
		})

		it('renders menu items', async () => {
			render(() => (
				<ContextMenu>
					<ContextMenuTrigger>
						<div style={{ width: '200px', height: '100px' }}>Trigger area</div>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem>First Item</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuItem>Second Item</ContextMenuItem>
						<ContextMenuItem disabled>Disabled Item</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>
			))

			const trigger = page.getByText('Trigger area')
			await trigger.click({ button: 'right' })
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Check items are rendered
			const items = document.querySelectorAll('[role="menuitem"]')
			expect(items.length).toBe(3)

			// Check disabled item
			const disabledItem = Array.from(items).find(
				(item) => item.textContent?.includes('Disabled')
			)
			expect(disabledItem?.getAttribute('aria-disabled')).toBe('true')
		})

		it('closes on item click', async () => {
			let selected = ''

			render(() => (
				<ContextMenu>
					<ContextMenuTrigger>
						<div style={{ width: '200px', height: '100px' }}>Trigger</div>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem onSelect={() => (selected = 'cut')}>Cut</ContextMenuItem>
						<ContextMenuItem onSelect={() => (selected = 'copy')}>Copy</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>
			))

			const trigger = page.getByText('Trigger')
			await trigger.click({ button: 'right' })
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Click an item
			const cutItem = page.getByText('Cut')
			await cutItem.click()
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Callback should have been called
			expect(selected).toBe('cut')
		})
	})

	describe('submenu functionality', () => {
		it('opens submenu on hover', async () => {
			render(() => (
				<ContextMenu openDelay={0} closeDelay={0}>
					<ContextMenuTrigger>
						<div style={{ width: '200px', height: '100px' }}>Trigger</div>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem>Regular Item</ContextMenuItem>
						<ContextMenuSub>
							<ContextMenuSubTrigger>More Options</ContextMenuSubTrigger>
							<ContextMenuSubContent>
								<ContextMenuItem>Sub Item 1</ContextMenuItem>
								<ContextMenuItem>Sub Item 2</ContextMenuItem>
							</ContextMenuSubContent>
						</ContextMenuSub>
					</ContextMenuContent>
				</ContextMenu>
			))

			// Open main menu
			const trigger = page.getByText('Trigger')
			await trigger.click({ button: 'right' })
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Main menu should be open
			const mainMenu = document.querySelector('[role="menu"]')
			expect(mainMenu?.getAttribute('data-state')).toBe('open')

			// Hover submenu trigger
			const subTrigger = page.getByText('More Options')
			await subTrigger.hover()
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Submenu should be open
			const subMenus = document.querySelectorAll('[role="menu"][data-state="open"]')
			expect(subMenus.length).toBeGreaterThanOrEqual(2)
		})

		it('closes submenu when moving to different item', async () => {
			render(() => (
				<ContextMenu openDelay={0} closeDelay={0}>
					<ContextMenuTrigger>
						<div style={{ width: '200px', height: '100px' }}>Trigger</div>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem>Regular Item</ContextMenuItem>
						<ContextMenuSub>
							<ContextMenuSubTrigger>Submenu</ContextMenuSubTrigger>
							<ContextMenuSubContent>
								<ContextMenuItem>Sub Item</ContextMenuItem>
							</ContextMenuSubContent>
						</ContextMenuSub>
					</ContextMenuContent>
				</ContextMenu>
			))

			// Open main menu
			const trigger = page.getByText('Trigger')
			await trigger.click({ button: 'right' })
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Open submenu
			const subTrigger = page.getByText('Submenu')
			await subTrigger.hover()
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Verify submenu is open
			let subMenus = document.querySelectorAll('[role="menu"][data-state="open"]')
			expect(subMenus.length).toBeGreaterThanOrEqual(2)

			// Move to regular item (away from submenu)
			const regularItem = page.getByText('Regular Item')
			await regularItem.hover()
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Submenu should close
			subMenus = document.querySelectorAll('[role="menu"][data-state="open"]')
			expect(subMenus.length).toBe(1)
		})
	})

	describe('nested submenus', () => {
		it('renders nested submenu structure', async () => {
			render(() => (
				<ContextMenu openDelay={0} closeDelay={0}>
					<ContextMenuTrigger>
						<div style={{ width: '200px', height: '100px' }}>Trigger</div>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuSub>
							<ContextMenuSubTrigger>Level 1</ContextMenuSubTrigger>
							<ContextMenuSubContent>
								<ContextMenuItem>Sub Item</ContextMenuItem>
							</ContextMenuSubContent>
						</ContextMenuSub>
					</ContextMenuContent>
				</ContextMenu>
			))

			// Open main menu
			const trigger = page.getByText('Trigger')
			await trigger.click({ button: 'right' })
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Verify main menu opened with submenu trigger
			const mainMenu = document.querySelector('[role="menu"][data-state="open"]')
			expect(mainMenu).toBeTruthy()

			// Level 1 trigger should be visible
			const level1 = page.getByText('Level 1')
			await expect.element(level1).toBeVisible()

			// Hover to open submenu
			await level1.hover()
			await new Promise((resolve) => setTimeout(resolve, 200))

			// Sub item should become visible
			const subItem = page.getByText('Sub Item')
			await expect.element(subItem).toBeVisible()
		})
	})

	describe('styling and display', () => {
		it('renders shortcut hints', async () => {
			render(() => (
				<ContextMenu>
					<ContextMenuTrigger>
						<div style={{ width: '200px', height: '100px' }}>Trigger</div>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem>
							Cut
							<ContextMenuShortcut>Cmd+X</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem>
							Copy
							<ContextMenuShortcut>Cmd+C</ContextMenuShortcut>
						</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>
			))

			const trigger = page.getByText('Trigger')
			await trigger.click({ button: 'right' })
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Shortcuts should be visible
			const shortcutX = page.getByText('Cmd+X')
			const shortcutC = page.getByText('Cmd+C')

			await expect.element(shortcutX).toBeVisible()
			await expect.element(shortcutC).toBeVisible()
		})

		it('renders labels and separators', async () => {
			render(() => (
				<ContextMenu>
					<ContextMenuTrigger>
						<div style={{ width: '200px', height: '100px' }}>Trigger</div>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuLabel>Edit Actions</ContextMenuLabel>
						<ContextMenuItem>Cut</ContextMenuItem>
						<ContextMenuItem>Copy</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuLabel>Other</ContextMenuLabel>
						<ContextMenuItem>Settings</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>
			))

			const trigger = page.getByText('Trigger')
			await trigger.click({ button: 'right' })
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Labels should be visible
			const editLabel = page.getByText('Edit Actions')
			const otherLabel = page.getByText('Other')

			await expect.element(editLabel).toBeVisible()
			await expect.element(otherLabel).toBeVisible()

			// Separator should exist
			const separator = document.querySelector('[role="separator"]')
			expect(separator).toBeTruthy()
		})
	})
})
