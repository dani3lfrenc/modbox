export type Shell = 'bash' | 'powershell'

export type Options = { powershell: '5.1' | '7' }

const IGNORE = /shell-guard:\s*ignore/i

const UNIX_ONLY: Record<string, string> = {
  head: 'Get-Content <file> -TotalCount N, or ... | Select-Object -First N',
  tail: 'Get-Content <file> -Tail N, or ... | Select-Object -Last N',
  touch: 'if (-not (Test-Path <file>)) { New-Item -ItemType File <file> }',
  export: '$env:NAME = "value"',
  unset: 'Remove-Item Env:NAME',
  which: '(Get-Command <name>).Source',
  grep: 'Select-String -Pattern <regex> -Path <file>',
  sed: "(Get-Content <file>) -replace 'a', 'b'",
  awk: 'ForEach-Object with -split',
  wc: '(Get-Content <file> | Measure-Object -Line).Lines',
  xargs: 'ForEach-Object { ... }',
  chmod: 'icacls, if you really need it',
  chown: 'icacls, if you really need it',
  ln: 'New-Item -ItemType SymbolicLink -Path <link> -Target <target>',
  source: '. .\\script.ps1',
  uname: '[Environment]::OSVersion',
  nproc: '$env:NUMBER_OF_PROCESSORS',
}

const CMDLET_VERBS = new Set([
  'Add', 'Clear', 'Compress', 'Convert', 'ConvertFrom', 'ConvertTo', 'Copy', 'Expand',
  'Export', 'ForEach', 'Format', 'Get', 'Group', 'Import', 'Invoke', 'Join', 'Measure',
  'Move', 'New', 'Out', 'Remove', 'Rename', 'Resolve', 'Select', 'Set', 'Sort', 'Split',
  'Start', 'Stop', 'Test', 'Where', 'Write',
])

const BASH_FOR: Record<string, string> = {
  'Get-ChildItem': 'ls',
  'Get-Content': 'cat',
  'Set-Content': 'echo ... > file',
  'Set-Location': 'cd',
  'Get-Location': 'pwd',
  'Remove-Item': 'rm',
  'Copy-Item': 'cp',
  'Move-Item': 'mv',
  'New-Item': 'mkdir -p or touch',
  'Select-String': 'grep',
  'Test-Path': 'test -e',
  'Write-Host': 'echo',
  'Write-Output': 'echo',
  'Select-Object': 'head or tail',
  'Measure-Object': 'wc',
}

const WINDOWS_VARS = [
  'PATH', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'USERNAME',
  'COMPUTERNAME', 'PROGRAMFILES', 'SYSTEMROOT', 'WINDIR', 'PROGRAMDATA',
]

export function check(shell: Shell, command: string, options: Options): string[] {
  if (IGNORE.test(command)) return []
  return shell === 'bash' ? checkBash(command) : checkPowerShell(command, options)
}

export function explain(shell: Shell, problems: string[], options: Options): string {
  const name = shell === 'bash' ? 'Bash' : `PowerShell ${options.powershell}`
  const lines = problems.map(p => `- ${p}`).join('\n')
  return `shell-guard: this won't run the way you expect in ${name}.\n${lines}\nRewrite it for ${name} and run it again. If the check is wrong, add a comment "shell-guard: ignore".`
}

function checkBash(command: string): string[] {
  const found = new Set<string>()
  const code = maskBash(command)

  for (const segment of segments(code, /&&|\|\||[;\n|]|(?<![>&<])&(?![>&])/)) {
    const words = segment.split(/\s+/)
    const first = words[0] ?? ''
    if (/^(powershell|pwsh|cmd)(\.exe)?$/i.test(first)) continue

    const verb = /^([A-Z][a-zA-Z]+)-[A-Z][a-zA-Z]+$/.exec(first)
    if (verb && CMDLET_VERBS.has(verb[1]!)) {
      const instead = BASH_FOR[first]
      found.add(
        instead
          ? `${first} is a PowerShell cmdlet. In Bash use ${instead}.`
          : `${first} is a PowerShell cmdlet. Use the PowerShell tool, or the Bash equivalent.`,
      )
    }

    const env = /\$\{?env:(\w+)/i.exec(segment)
    if (env) found.add(`$env:${env[1]} is PowerShell. In Bash it's $${env[1]}.`)

    if (/\d?>\s*\$null\b/i.test(segment)) {
      found.add('$null is empty in Bash, so the redirect has no target. Use /dev/null.')
    }

    const percent = /%([A-Z_][A-Z0-9_]*)%/.exec(segment)
    if (percent) found.add(`%${percent[1]}% is cmd.exe syntax. In Bash it's $${percent[1]}.`)
  }

  return [...found]
}

function checkPowerShell(command: string, options: Options): string[] {
  const found = new Set<string>()
  const code = maskPowerShell(command)

  if (options.powershell === '5.1' && /&&|\|\|/.test(code)) {
    found.add('&& and || don\'t exist in 5.1. Use `A; if ($?) { B }`, or `A; B` if B should run anyway.')
  }

  if (/\d?>\s*\/dev\/null/.test(code)) {
    found.add('/dev/null doesn\'t exist here. Use 2>$null, or pipe to Out-Null.')
  }

  if (/<</.test(code)) {
    found.add("There are no heredocs. Use a here-string: @' on its own line, the text, then '@ at the start of a line.")
  } else if (/</.test(code)) {
    found.add('< is reserved in PowerShell. Pipe instead: Get-Content <file> | <command>.')
  }

  if (/[ \t]\\[ \t]*$/m.test(code)) {
    found.add('A trailing \\ doesn\'t continue the line. Use a backtick, or put it on one line.')
  }

  for (const segment of segments(code, /&&|\|\||[;\n|]/)) {
    const words = segment.split(/\s+/)
    const first = words[0] ?? ''
    if (first === '&' || /^(bash|sh|wsl)(\.exe)?$/i.test(first)) continue

    const unix = UNIX_ONLY[first]
    if (unix) found.add(`${first} isn't a PowerShell command. Use ${unix}. (If it's installed, call ${first}.exe.)`)

    if (/^(rm|del|ri|rmdir)$/i.test(first) && words.some(w => /^-[rRfF]{2,}$/.test(w))) {
      found.add('rm -rf fails here: PowerShell won\'t split combined flags. Use Remove-Item -Recurse -Force <path>.')
    }

    if (/^(ls|dir|gci)$/i.test(first) && words.some(w => /^-(?=[a-z]*[la])[a-z]{1,3}$/.test(w))) {
      found.add('ls -la doesn\'t work here. Use Get-ChildItem -Force to include hidden files.')
    }

    const assign = /^([A-Za-z_]\w*)=(\S*)/.exec(first)
    if (assign) {
      found.add(`${assign[1]}=... is Bash. Set it with $env:${assign[1]} = '${assign[2]}'; then run the command.`)
    }

    if (/^(if|while|until)\s+\[/.test(segment) || /^for\s+\w+\s+in\b/.test(segment) || /^(fi|done|esac|then)$/.test(first)) {
      found.add('That\'s Bash control flow. PowerShell uses if (...) { }, foreach ($x in $list) { } and so on.')
    }

    const percent = /%([A-Z_][A-Z0-9_]*)%/.exec(segment)
    if (percent) found.add(`%${percent[1]}% is cmd.exe syntax. In PowerShell it's $env:${percent[1]}.`)
  }

  for (const name of WINDOWS_VARS) {
    const used = new RegExp(`\\$${name}\\b(?!:)`).test(code)
    const defined = new RegExp(`\\$${name}\\s*=|\\(\\s*\\$${name}\\s+in\\b|param\\s*\\(`, 'i').test(code)
    if (used && !defined) found.add(`$${name} is an empty variable here. The environment variable is $env:${name}.`)
  }

  return [...found]
}

function segments(code: string, separator: RegExp): string[] {
  return code
    .split(separator)
    .map(s => s.trim().replace(/^[({!\s]+/, '').trim())
    .filter(Boolean)
}

function maskBash(src: string): string {
  let out = ''
  let pending: string[] = []
  let i = 0

  while (i < src.length) {
    const c = src[i]!

    if (c === '\\') {
      out += ' '
      i += 2
    } else if (c === "'") {
      const end = src.indexOf("'", i + 1)
      i = end === -1 ? src.length : end + 1
      out += "''"
    } else if (c === '"') {
      let j = i + 1
      while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1
      i = j + 1
      out += '""'
    } else if (c === '#' && (i === 0 || /\s/.test(src[i - 1]!))) {
      const end = src.indexOf('\n', i)
      i = end === -1 ? src.length : end
    } else if (src.startsWith('<<', i) && src[i + 2] !== '<') {
      const tag = /^<<-?\s*(['"]?)([A-Za-z_][\w-]*)\1/.exec(src.slice(i))
      if (tag) {
        pending.push(tag[2]!)
        out += '<<' + tag[2]
        i += tag[0].length
      } else {
        out += '<<'
        i += 2
      }
    } else if (c === '\n' && pending.length > 0) {
      out += '\n'
      i++
      for (const tag of pending) {
        while (i < src.length) {
          const end = src.indexOf('\n', i)
          const line = src.slice(i, end === -1 ? src.length : end)
          i = end === -1 ? src.length : end + 1
          if (line.trim() === tag) break
        }
      }
      pending = []
    } else {
      out += c
      i++
    }
  }

  return out
}

function maskPowerShell(src: string): string {
  let out = ''
  let i = 0

  while (i < src.length) {
    const c = src[i]!
    const hereString = /^@(['"])[ \t]*\r?\n/.exec(src.slice(i, i + 8))

    if (hereString) {
      const close = src.indexOf('\n' + hereString[1] + '@', i + 2)
      i = close === -1 ? src.length : close + 3
      out += "''"
    } else if (c === '`') {
      out += ' '
      i += 2
    } else if (c === "'") {
      let j = i + 1
      while (j < src.length) {
        if (src[j] === "'" && src[j + 1] === "'") j += 2
        else if (src[j] === "'") break
        else j++
      }
      i = j + 1
      out += "''"
    } else if (c === '"') {
      let j = i + 1
      while (j < src.length) {
        if (src[j] === '`') j += 2
        else if (src[j] === '"' && src[j + 1] === '"') j += 2
        else if (src[j] === '"') break
        else j++
      }
      i = j + 1
      out += '""'
    } else if (src.startsWith('<#', i)) {
      const end = src.indexOf('#>', i + 2)
      i = end === -1 ? src.length : end + 2
      out += ' '
    } else if (c === '#' && (i === 0 || /[\s;|]/.test(src[i - 1]!))) {
      const end = src.indexOf('\n', i)
      i = end === -1 ? src.length : end
    } else {
      out += c
      i++
    }
  }

  return out
}
