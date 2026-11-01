import { describe, expect, test } from 'claude-code/testing'
import { check, type Options } from './rules'

const ps51: Options = { powershell: '5.1' }
const ps7: Options = { powershell: '7' }

const ps = (command: string, options: Options = ps51) => check('powershell', command, options)
const bash = (command: string) => check('bash', command, ps51)

describe('powershell', () => {
  test('lets normal commands through', async () => {
    expect(ps('Get-ChildItem -Force')).toEqual([])
    expect(ps('git status; git log --oneline -5')).toEqual([])
    expect(ps('npm test 2>$null')).toEqual([])
    expect(ps('& "C:\\Program Files\\Git\\bin\\git.exe" --version')).toEqual([])
    expect(ps('$env:PATH -split ";"')).toEqual([])
    expect(ps('foreach ($PATH in $list) { $PATH }')).toEqual([])
    expect(ps('cd C:\\')).toEqual([])
    expect(ps('ls -r')).toEqual([])
    expect(ps('Get-Process | Where-Object { $_.CPU -gt 10 } | % { $_.Name }')).toEqual([])
  })

  test('ignores what sits inside strings and comments', async () => {
    expect(ps('git commit -m "fix && cleanup"')).toEqual([])
    expect(ps("Write-Output 'head -5 < file'")).toEqual([])
    expect(ps('git status # then && push')).toEqual([])
    expect(ps('<# rm -rf && export X=1 #> Get-Date')).toEqual([])
    expect(ps("git commit -m @'\nuse && here\nexport FOO=1\n'@")).toEqual([])
  })

  test('&& and || only on 5.1', async () => {
    expect(ps('npm ci && npm test')).toHaveLength(1)
    expect(ps('test-thing || exit 1')).toHaveLength(1)
    expect(ps('npm ci && npm test', ps7)).toEqual([])
  })

  test('catches unix habits', async () => {
    expect(ps('head -20 log.txt')[0]).toContain('TotalCount')
    expect(ps('Get-Content log.txt | tail -5')[0]).toContain('-Last')
    expect(ps('export NODE_ENV=production')[0]).toContain('$env:NAME')
    expect(ps('which node')[0]).toContain('Get-Command')
    expect(ps('rm -rf node_modules')[0]).toContain('-Recurse -Force')
    expect(ps('ls -la')[0]).toContain('-Force')
    expect(ps('npm test > /dev/null 2>&1')[0]).toContain('$null')
    expect(ps('NODE_ENV=test npm test')[0]).toContain("$env:NODE_ENV = 'test'")
    expect(ps('cat <<EOF\nhi\nEOF')[0]).toContain('here-string')
    expect(ps('sort < input.txt')[0]).toContain('Get-Content')
    expect(ps('if [ -f x ]; then echo y; fi').length).toBeGreaterThan(0)
    expect(ps('echo %USERPROFILE%')[0]).toContain('$env:USERPROFILE')
    expect(ps('cd $USERPROFILE')[0]).toContain('$env:USERPROFILE')
    expect(ps('npm run build \\\n  --prod')[0]).toContain('backtick')
  })

  test('grep.exe is allowed', async () => {
    expect(ps('grep.exe -r foo .')).toEqual([])
  })

  test('the ignore comment turns it off', async () => {
    expect(ps('head -5 x # shell-guard: ignore')).toEqual([])
  })
})

describe('bash', () => {
  test('lets normal commands through', async () => {
    expect(bash('ls -la && git status')).toEqual([])
    expect(bash('npm test > /dev/null 2>&1 &')).toEqual([])
    expect(bash('echo "$HOME" | grep -c x')).toEqual([])
    expect(bash('powershell -Command Get-ChildItem')).toEqual([])
  })

  test('ignores strings, comments and heredoc bodies', async () => {
    expect(bash("echo 'Get-ChildItem $env:PATH'")).toEqual([])
    expect(bash('git commit -m "use Set-Location and 2>$null"')).toEqual([])
    expect(bash('ls # Get-ChildItem')).toEqual([])
    expect(bash("cat > run.ps1 <<'EOF'\nGet-ChildItem $env:TEMP 2>$null\nEOF\nbash run.sh")).toEqual([])
  })

  test('catches powershell habits', async () => {
    expect(bash('Get-ChildItem -Recurse')[0]).toContain('ls')
    expect(bash('cd /c && Remove-Item foo')[0]).toContain('rm')
    expect(bash('echo $env:USERPROFILE')[0]).toContain('$USERPROFILE')
    expect(bash('npm test 2>$null')[0]).toContain('/dev/null')
    expect(bash('cd %APPDATA%')[0]).toContain('$APPDATA')
  })
})
