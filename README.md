# modbox

Small mods for Claude Code.

| Mod | What it does |
| --- | --- |
| [activity](activity) | A pane beside the chat with the session at a glance: duration, prompts, tool calls, context and token usage, cost, and a small bouncing Claude. |
| [shell-guard](shell-guard) | For Windows. Stops Claude from running Bash syntax in PowerShell (and the other way round) and tells it what to write instead. |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install activity --marketplace dani3lfrenc/modbox
/plugin install shell-guard --marketplace dani3lfrenc/modbox
```

The first time, answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install shell-guard --marketplace dani3lfrenc/modbox
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `dani3lfrenc/modbox`, then Add plugin.

## License

MIT
