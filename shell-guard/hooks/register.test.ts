import { expect, test } from 'claude-code/testing'

test('a bad PowerShell command never reaches the shell', async ($, on) => {
  let ran = false
  on('tool.call', () => {
    ran = true
    return { result: {} }
  })

  const result = await $.tool.call({ tool: 'PowerShell', command: 'npm ci && npm test' })

  expect(ran).toBe(false)
  expect(result.deny).toContain('Use `A; if ($?) { B }`')
})

test('a fine command goes through', async ($, on) => {
  let ran = false
  on('tool.call', () => {
    ran = true
    return { result: {} }
  })

  await $.tool.call({ tool: 'Bash', command: 'ls -la && git status' })

  expect(ran).toBe(true)
})

test('PowerShell 7 allows &&', { options: { powershell: '7' } }, async ($, on) => {
  let ran = false
  on('tool.call', () => {
    ran = true
    return { result: {} }
  })

  await $.tool.call({ tool: 'PowerShell', command: 'npm ci && npm test' })

  expect(ran).toBe(true)
})
