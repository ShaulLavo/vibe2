import { render } from 'vitest-browser-solid'
import { page } from 'vitest/browser'
import { describe, it, expect, vi } from 'vitest'
import { DiffView } from './DiffView'
import type { ConflictInfo } from '../types'

describe('DiffView', () => {
	const mockConflictInfo: ConflictInfo = {
		path: 'test/file.ts',
		baseContent: 'line 1\nline 2\nline 3',
		localContent: 'line 1\nlocal change\nline 3',
		externalContent: 'line 1\nexternal change\nline 3',
		lastModified: Date.now(),
		conflictTimestamp: Date.now(),
	}

	it('renders diff view when open', () => {
		const onMergeComplete = vi.fn()
		const onCancel = vi.fn()

		render(() => (
			<DiffView
				conflictInfo={mockConflictInfo}
				isOpen={true}
				onMergeComplete={onMergeComplete}
				onCancel={onCancel}
			/>
		))

		expect(page.getByText('Resolve Conflict: file.ts')).toBeInTheDocument()
		expect(page.getByText('Your Changes (Local)')).toBeInTheDocument()
		expect(page.getByText('External Changes')).toBeInTheDocument()
		expect(page.getByText('Merged Result')).toBeInTheDocument()
	})

	it('does not render when closed', () => {
		const onMergeComplete = vi.fn()
		const onCancel = vi.fn()

		render(() => (
			<DiffView
				conflictInfo={mockConflictInfo}
				isOpen={false}
				onMergeComplete={onMergeComplete}
				onCancel={onCancel}
			/>
		))

		expect(page.getByText('Resolve Conflict: file.ts')).not.toBeVisible()
	})

	it('displays local and external content', () => {
		const onMergeComplete = vi.fn()
		const onCancel = vi.fn()

		render(() => (
			<DiffView
				conflictInfo={mockConflictInfo}
				isOpen={true}
				onMergeComplete={onMergeComplete}
				onCancel={onCancel}
			/>
		))

		// Check that content is displayed (using partial text matching)
		expect(page.getByText(/local change/)).toBeInTheDocument()
		expect(page.getByText(/external change/)).toBeInTheDocument()
	})

	it('calls onCancel when cancel button is clicked', () => {
		const onMergeComplete = vi.fn()
		const onCancel = vi.fn()

		render(() => (
			<DiffView
				conflictInfo={mockConflictInfo}
				isOpen={true}
				onMergeComplete={onMergeComplete}
				onCancel={onCancel}
			/>
		))

		const cancelButton = page.getByText('Cancel')
		cancelButton.click()

		expect(onCancel).toHaveBeenCalledOnce()
	})

	it('calls onMergeComplete when save merge button is clicked', () => {
		const onMergeComplete = vi.fn()
		const onCancel = vi.fn()

		render(() => (
			<DiffView
				conflictInfo={mockConflictInfo}
				isOpen={true}
				onMergeComplete={onMergeComplete}
				onCancel={onCancel}
			/>
		))

		const saveMergeButton = page.getByText('Save Merge')
		saveMergeButton.click()

		expect(onMergeComplete).toHaveBeenCalledOnce()
		expect(onMergeComplete).toHaveBeenCalledWith(mockConflictInfo.localContent)
	})

	it('updates merged content when use all local button is clicked', () => {
		const onMergeComplete = vi.fn()
		const onCancel = vi.fn()

		render(() => (
			<DiffView
				conflictInfo={mockConflictInfo}
				isOpen={true}
				onMergeComplete={onMergeComplete}
				onCancel={onCancel}
			/>
		))

		const useLocalButton = page.getByText('Use All Local')
		useLocalButton.click()

		const saveMergeButton = page.getByText('Save Merge')
		saveMergeButton.click()

		expect(onMergeComplete).toHaveBeenCalledWith(mockConflictInfo.localContent)
	})

	it('updates merged content when use all external button is clicked', () => {
		const onMergeComplete = vi.fn()
		const onCancel = vi.fn()

		render(() => (
			<DiffView
				conflictInfo={mockConflictInfo}
				isOpen={true}
				onMergeComplete={onMergeComplete}
				onCancel={onCancel}
			/>
		))

		const useExternalButton = page.getByText('Use All External')
		useExternalButton.click()

		const saveMergeButton = page.getByText('Save Merge')
		saveMergeButton.click()

		expect(onMergeComplete).toHaveBeenCalledWith(mockConflictInfo.externalContent)
	})

	it('allows manual editing of merged content', () => {
		const onMergeComplete = vi.fn()
		const onCancel = vi.fn()

		render(() => (
			<DiffView
				conflictInfo={mockConflictInfo}
				isOpen={true}
				onMergeComplete={onMergeComplete}
				onCancel={onCancel}
			/>
		))

		const textarea = page.getByPlaceholder('Edit the merged content here...')
		const customContent = 'line 1\ncustom merge\nline 3'
		
		textarea.fill(customContent)

		const saveMergeButton = page.getByText('Save Merge')
		saveMergeButton.click()

		expect(onMergeComplete).toHaveBeenCalledWith(customContent)
	})
})