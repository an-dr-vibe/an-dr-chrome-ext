# an-dr Chrome Extensions

Personal Chrome extensions for Jira and beyond.

## Install on a new machine

Paste this into PowerShell:

```powershell
irm https://raw.githubusercontent.com/YOUR_USER/an-dr-chrome-ext/main/bootstrap.ps1 | iex
```

This will:

1. Clone the repo to `~\.chrome-an-dr`
2. Open `chrome://extensions`
3. Print each extension path to load

Then in Chrome:

- Enable **Developer mode** (toggle, top-right of `chrome://extensions`)
- Click **Load unpacked** and select the printed folder

## Update

```powershell
& "$HOME\.chrome-an-dr\install.ps1"
```

Or re-run the bootstrap — it pulls latest automatically.

## Extensions

| Folder                   | Name                   | Description                                                |
|--------------------------|------------------------|------------------------------------------------------------|
| `an-dr-jira/`            | an-dr: Jira            | Highlights watched Jira fields for quick access            |
| `an-dr-confluence-axis/` | an-dr: Confluence Axis | Shows Jira story titles on widgets in Confluence edit mode |
