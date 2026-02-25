<div align="center">

# Discord Quest Spoofer

Auto-complete Discord quests from the console.

`VIDEO` · `GAME` · `STREAM` · `ACTIVITY`

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Discord-5865F2.svg)](https://discord.com)

</div>

## Recommended Clients

For the best experience, use a client with DevTools enabled by default:

| Client | DevTools | Game/Stream Quests | Link |
|:-------|:---------|:-------------------|:-----|
| **Discord PTB** | Built-in | Full support | [Download](https://discord.com/api/downloads/distributions/app/installers/latest?channel=ptb&platform=win&arch=x64) |
| **Discord Canary** | Built-in | Full support | [Download](https://discord.com/api/downloads/distributions/app/installers/latest?channel=canary&platform=win&arch=x64) |
| **Vencord** | Built-in | Full support | [Install](https://vencord.dev) |
| Discord Stable | Needs manual enable | Full support | [Download](https://discord.com/download) |
| Browser (discord.com) | Built-in | Video only | — |

> The web version only supports video quests. Game and stream quests require a desktop client.

## Setup

1. Accept quests in the **Quests** tab
2. `Ctrl+Shift+I` to open the Console
3. Type `allow pasting` then Enter
4. Paste `DiscordQuestSpoofer.js` and Enter

The script runs automatically. Progress is printed live in the console and visible in the Quests tab.

## Quest Types

| Type | Method | Platform |
|:-----|:-------|:---------|
| **Video** | Synthetic timestamps sent to the progress API | Any |
| **Game** | Ghost process injected into the game store | Desktop |
| **Stream** | Stream metadata override | Desktop + 1 viewer in VC |
| **Activity** | Periodic heartbeat pulses | Any |

For streams, share any window in a voice channel with at least one other person.

## Preview

```
[QS] Modules charges
[QS] 3 quete(s) detectee(s):
  1. [VIDEO] Wuthering Waves — 0/900s
  2. [JEU] Valorant — 0/900s
  3. [STREAM] Fortnite — 0/900s

[QS] [VIDEO] Wuthering Waves
  ████████████████████ 100% (900/900s) ~0min
[QS] Wuthering Waves terminee

[QS] 3 OK
```

## How It Works

DiscordQuestSpoofer scans Discord's webpack module cache at runtime. Instead of relying on hardcoded minified variable names that break on every update, it identifies modules by **what they do** (method signatures) rather than what they're called.

Once located, all modules are grouped into a single context object. Quests are sorted (fastest first) and processed sequentially with full error isolation.

**Built-in safeguards:**

- **Retry** : API calls retry 3x with increasing delays
- **Timeout** : 2.5x safety margin on game/stream quests
- **Cleanup** : `try/finally` on every store patch
- **Lock** : prevents double-execution
- **Ordering** : videos (~30s) run before games (~15min)

## Troubleshooting

| Problem | Fix |
|:--------|:----|
| Nothing happens / prints `undefined` | DevTools HTTP bug. Restart Discord, try again |
| `Ctrl+Shift+I` doesn't work | Use the [PTB client](https://discord.com/api/downloads/distributions/app/installers/latest?channel=ptb&platform=win&arch=x64) or [enable DevTools](https://www.reddit.com/r/discordapp/comments/sc61n3/comment/hu4fw5x/) |
| Takes a screenshot instead | Disable `Ctrl+Shift+I` in AMD Radeon settings |
| Syntax error when pasting | Disable browser auto-translate / translator extensions |
| "App desktop requise" | Use the [real Discord app](https://discord.com/download), not Vesktop or browser |
| Expired quest | Can't be completed, no workaround |

## License

[MIT](LICENSE)

*Educational and research purposes only. Use at your own risk.*
