import type { Register } from 'claude-code'
import { check, explain, type Options } from './rules'

export const register: Register = (on, config) => {
  const options: Options = { powershell: config.powershell === '7' ? '7' : '5.1' }

  on('tool.call', { tool: 'PowerShell' }, ($, e, next) => {
    const problems = check('powershell', e.command, options)
    return problems.length > 0 ? { deny: explain('powershell', problems, options) } : next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    const problems = check('bash', e.command, options)
    return problems.length > 0 ? { deny: explain('bash', problems, options) } : next(e)
  }).catch(($, e, next) => next(e))
}
