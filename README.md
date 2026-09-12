# Antigravity Conversation Token Tracker Extension

A VS Code extension built for Antigravity IDE to monitor live token usage and estimated costs per conversation in real-time.

## Features
- **Real-Time Status Bar**: Displays current conversation total tokens and cost (`$(pulse) 24.5k tok (~$0.02)`). Click to focus the sidebar.
- **Interactive Webview Sidebar**: Displays real-time conversation metrics (Prompt vs Completion tokens, cost, steps) and an interactive Recent Sessions table with live status indicators, session titles, workspace/project tags, and one-click transcript navigation.
- **Session Title & Workspace Resolution**: Automatically resolves readable session titles and workspace names directly from Antigravity IDE SQLite databases (real-time conversation DB and global storage).
- **Dynamic Hybrid Session Watching**: Automatically detects new sessions as they are created and switches active session monitoring in real-time using hybrid directory watching and heartbeat polling, keeping the Status Bar and Webview synchronized whenever you switch sessions or focus the IDE.
- **Customizable Pricing Profile**: Default rates configured for Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 1.5 Flash, and Gemini 1.5 Pro.

---

## How to Build VSIX Package

### Prerequisites
- Node.js (>= v20)
- npm

### 1. Build Extension VSIX
Run the packaging command:
```bash
# Install dependencies if not already done
npm install

# Compile TypeScript and generate .vsix file
npx @vscode/vsce package --no-dependencies --allow-missing-repository
```
Or use the npm script:
```bash
npm run package
```

Sau khi chạy xong, file package sẽ được tạo ra tại thư mục gốc:
`antigravity-token-tracker-0.1.0.vsix`

---

## How to Install into Antigravity IDE

### Method 1: Via Antigravity CLI (Recommended)
Chạy lệnh sau trên terminal để cài đặt trực tiếp vào Antigravity IDE:
```bash
~/.antigravity-ide/antigravity-ide/bin/antigravity-ide --install-extension antigravity-token-tracker-0.1.0.vsix
```

### Method 2: Via Antigravity IDE UI
1. Mở Antigravity IDE, nhấn `Cmd+Shift+X` (macOS) hoặc `Ctrl+Shift+X` (Linux/Windows) để mở tab **Extensions**.
2. Nhấp vào biểu tượng menu `...` (Views and More Actions) ở góc trên bên phải panel Extensions.
3. Chọn **Install from VSIX...** và chọn file `antigravity-token-tracker-0.1.0.vsix`.
4. Nhấn `Cmd+Shift+P` ➔ chọn `Developer: Reload Window` để tải lại IDE.

### Method 3: Development & Debugging (F5)
1. Mở thư mục dự án này trong Antigravity IDE.
2. Nhấn `F5` để mở cửa sổ Extension Development Host chạy thử nghiệm extension.

---

## Commands
- `antigravityTokenTracker.refresh`: Force-refresh token metrics for the active session.
- `antigravityTokenTracker.openTranscript`: Open the active session's `transcript.jsonl` file directly in the editor.

## Settings
- `antigravityTokenTracker.brainPath`: Path to Antigravity brain directory (defaults to `~/.gemini/antigravity-ide/brain`).
- `antigravityTokenTracker.model`: Model pricing profile to estimate costs (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`, `gemini-1.5-pro`).
