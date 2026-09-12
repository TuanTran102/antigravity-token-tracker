# Antigravity Conversation Token Tracker Extension

A VS Code extension built for Antigravity IDE to monitor live token usage and estimated costs per conversation.

## Features
- **Real-Time Status Bar**: Displays current conversation total tokens and cost (`$(pulse) 24.5k tok (~$0.02)`). Click to focus the sidebar.
- **Activity Bar Sidebar**: Break down Prompt (Input) vs Completion (Output) tokens, total steps, and review recent sessions history.
- **Incremental Log Watching**: Watches Antigravity's local transcripts (`~/.gemini/antigravity-ide/brain/<conv-id>/.system_generated/logs/transcript.jsonl`) with minimal resource footprint.
- **Customizable Pricing Profile**: Default rates configured for Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 1.5 Flash, and Gemini 1.5 Pro.

## Commands
- `antigravityTokenTracker.refresh`: Force-refresh token metrics for the active session.
- `antigravityTokenTracker.openTranscript`: Open the active session's `transcript.jsonl` file directly in the editor.

## Settings
- `antigravityTokenTracker.brainPath`: Path to Antigravity brain directory (defaults to `~/.gemini/antigravity-ide/brain`).
- `antigravityTokenTracker.model`: Model pricing profile to estimate costs (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`, `gemini-1.5-pro`).
