# shell-guard

A Claude Code mod for Windows. Claude gets two shells there, Bash and PowerShell, and it mixes them up: `&&` in PowerShell 5.1, `head` and `export` where they don't exist, `$env:PATH` in Bash, `2>$null` where it should be `/dev/null`. The command fails, Claude reads the error, tries again.

shell-guard looks at each command before it runs. If it uses the other shell's syntax, the command is stopped and Claude gets a short note saying what to write instead, so it gets it right on the second try instead of the fourth.

Strings, comments, here-strings and heredoc bodies are skipped, so `git commit -m "a && b"` or writing a `.ps1` file from Bash is fine.

## What it catches

In PowerShell:

- `&&` and `||` (5.1 only)
- `head`, `tail`, `touch`, `export`, `which`, `grep`, `sed`, `wc`, `xargs` and friends
- `rm -rf`, `ls -la`
- `> /dev/null`, `<` input redirection, heredocs
- `VAR=value command`
- `if [ ... ]`, `for x in`, `fi`, `done`
- a trailing `\` used as line continuation
- `%VAR%` and `$PATH`, `$USERPROFILE`, `$TEMP` used without `env:`

In Bash:

- cmdlets like `Get-ChildItem` or `Remove-Item` as a command
- `$env:NAME`
- `2>$null`
- `%VAR%`

If you really have `grep` or `sed` installed for PowerShell, call them as `grep.exe`. If a check is wrong, put `# shell-guard: ignore` in the command.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install shell-guard --marketplace dani3lfrenc/modbox
```

From a shell:

```
claude plugin install shell-guard --marketplace dani3lfrenc/modbox
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `dani3lfrenc/modbox`, then Add plugin.

## PowerShell 7

The default is Windows PowerShell 5.1. If Claude runs `pwsh` 7, where `&&` works, pick 7 under the `powershell` option in `/config`.

## License

MIT
