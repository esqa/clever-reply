# CleverReply

A [Vencord](https://github.com/Vendicated/Vencord) plugin that adds a Cleverbot reply button to Discord messages. Hover over any message, click the robot icon, and Cleverbot's response gets sent as your message.

![Vencord](https://img.shields.io/badge/Vencord-plugin-blue)

## Features

- Robot button appears in the message hover toolbar
- Maintains separate conversations per channel
- Uses Cleverbot's free web interface (no API key needed)
- "Thinking..." toast notification while waiting for a response

## One-Click Install (Windows)

1. Download or clone this repo
2. Right-click `install.ps1` → **Run with PowerShell**

The script handles everything automatically:
- Installs Git, Node.js, and pnpm (if missing)
- Clones the Vencord source
- Copies the plugin files
- Builds Vencord
- Injects into Discord

After installation, open Discord and enable the plugin in **Settings → Vencord → Plugins → CleverReply**.

## Manual Install

1. Copy the plugin folder into your Vencord source:
   ```
   cp -r clever-reply/ Vencord/src/userplugins/CleverReply/
   ```
2. Build Vencord:
   ```
   cd Vencord && pnpm build
   ```
3. Restart Discord and enable **CleverReply** in Vencord plugin settings.

## Files

| File | Description |
|------|-------------|
| `index.tsx` | Plugin entry point — button, click handler, toast notifications |
| `cleverbot.ts` | Cleverbot client — free scraping protocol, conversation state, inline MD5 |
| `native.ts` | Electron main-process HTTP requests (bypasses CORS) |
| `install.ps1` | Automated installer script for Windows |

## Settings

| Option | Default | Description |
|--------|---------|-------------|
| Show Toasts | `true` | Show a "Thinking..." notification while waiting for Cleverbot |

## License

GPL-3.0-or-later
