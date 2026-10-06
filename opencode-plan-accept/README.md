# opencode-plan-accept

An [OpenCode](https://opencode.ai) 2 plugin that accepts a plan: it compacts the
session, switches to the build agent, and starts building.

OpenCode has no plan-approval dialog. The plan agent presents a plan, and you
switch agents by hand. This plugin adds one command, `/accept`, that does the
switch for you.

## Install

```sh
opencode plugin add 'github:Vortiago/Verktoykasse#main::path:opencode-plan-accept'
```

## Use

1. Run `/plan <task>`. The plan agent researches the task, presents the plan,
   and writes it to `~/.opencode/plan`.
2. Read the plan. Reply to the plan agent to change it.
3. Run `/accept`. It reads the plan this session wrote, compacts the session,
   switches to the build agent and its model, and sends the plan to it.

The command sends the plan with the prompt, so the plan survives the compact.

## Licence

MIT
