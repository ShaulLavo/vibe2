#!/usr/bin/env node
import { build } from 'vite'

async function runBuild() {
  try {
    console.log('Starting Vite build...')
    await build({
      logLevel: 'info',
    })
    console.log('Build completed successfully!')
  } catch (error) {
    console.error('\n========== BUILD ERROR DETAILS ==========')
    console.error('Error name:', error?.name)
    console.error('Error message:', error?.message)
    console.error('Error code:', error?.code)
    console.error('Error cause:', error?.cause)
    if (error?.plugin) {
      console.error('Plugin:', error.plugin)
    }
    if (error?.frame) {
      console.error('Frame:', error.frame)
    }
    if (error?.id) {
      console.error('File ID:', error.id)
    }
    if (error?.loc) {
      console.error('Location:', JSON.stringify(error.loc))
    }
    console.error('\nFull error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    console.error('\nStack trace:', error?.stack)
    console.error('==========================================\n')
    process.exit(1)
  }
}

runBuild()
