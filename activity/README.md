# Activity

A Claude Code mod that opens a pane beside the chat showing what is happening in the current session:

- **Session**: how long it has been running, prompts sent, tool calls and errors
- **Tokens**: context window usage bar, input and output tokens, cache reads and writes, and the session cost
- **Most used**: the tools called most often
- **Recent activity**: the latest tool calls with their outcome (✓ ok, ✗ error, ⊘ denied, … running)
- A small Claude mascot bouncing at the top of the pane

Colors come from your active theme. With a custom theme (`custom:<name>`), the pane background is read from
`background` in `~/.claude/themes/<name>.json` (or `$CLAUDE_CONFIG_DIR/themes/<name>.json`).

The pane opens by itself when a session starts; if you close it, reopen it with `/activity`.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install activity --marketplace dani3lfrenc/modbox
```

From a shell:

```
claude plugin install activity --marketplace dani3lfrenc/modbox
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `dani3lfrenc/modbox`, then Add plugin.
