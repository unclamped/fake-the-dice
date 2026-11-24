# fake-the-dice

> [!WARNING]
> **This project no longer works.** It is published only for conservation
> purposes, as a record of what it was. It is not maintained, and no support
> or fixes will be provided.

A small Node.js script for Team Fortress 2 that fakes "Roll the Dice"
(RTD2-style) perks on a local server. It tails TF2's `console.log`, parses the
perk list from `rtd2_perks.default.cfg`, and sends chat messages and commands
to the server over RCON.

## Original usage (historical)

```sh
pnpm install
node index.js
```

It expected a local server with RCON on `0.0.0.0:27015` and TF2 installed at
`~/.steam/steam/steamapps/common/Team Fortress 2`.
