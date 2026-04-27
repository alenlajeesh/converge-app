# Converge 🚀

**A Collaborative Developer Workspace Desktop App**

Converge is a powerful all-in-one desktop application designed for development teams to collaborate seamlessly on shared GitHub projects. It combines code editing, communication, and task management into a single unified workspace.

---

## ✨ Features

* 🧑‍💻 **Shared Workspaces**
  Each workspace is linked to a GitHub repository where team members collaborate in real-time.

* 🔗 **Invite-Based Collaboration**
  Join teams instantly using a secure invite code.

* 📝 **Code Editing**
  Built-in Monaco Editor (VS Code–like experience).

* 💬 **Real-Time Chat**
  Workspace-based messaging powered by WebSockets.

* 📞 **Audio & Video Calls**
  Peer-to-peer communication using WebRTC.

* 📋 **Task Management**
  Kanban-style task board with assignment and status tracking.

* 🖥️ **Integrated Terminal**
  Run shell commands directly inside the workspace.

* 📂 **File System Access**
  Create, edit, delete, and manage project files locally.

---

## 🏗️ Tech Stack

### Desktop Shell

* **Tauri v2** — lightweight desktop framework
* **Rust** — backend for system-level operations
* **webkit2gtk** (Linux), **WebView2** (Windows)

### Frontend

* React (Create React App)
* React Router v6
* Monaco Editor
* Socket.io-client
* simple-peer (WebRTC)
* react-icons

### Backend

* Node.js + Express
* Socket.io (real-time communication)
* MongoDB + Mongoose
* JWT Authentication
* bcrypt (password hashing)
* nanoid (invite codes)

### CI/CD

* GitHub Actions
* Tauri Bundler (.deb, .rpm, .AppImage, .exe, .msi)

---

## ⬇️ Download

You can download the desktop application from the **GitHub Releases** section.

* 🐧 Linux: `.deb`, `.rpm`, `.AppImage`
* 🪟 Windows: `.exe`, `.msi`

**Steps:**

1. Go to the repository on GitHub
2. Open the **Releases** section
3. Download the latest version for your OS

---

## 📁 Project Structure

```
converge-app/
├── backend/
├── frontend/
├── src-tauri/
├── .github/
├── assets/
└── package.json
```

---

## 🗄️ Database Models

### User

* username
* email (unique)
* passwordHash

### Workspace

* name
* repoUrl
* localPath
* joinCode (unique)
* members

### Message

* workspaceId
* userId
* username
* message

### Task

* title, description
* assignedTo / assignedBy
* status: `pending | inprogress | done`
* priority: `low | medium | high`

---

## 🔌 API Endpoints

### Auth (`/api/auth`)

* `POST /register`
* `POST /login`
* `GET /me`

### Workspace (`/api/workspace`)

* `POST /create`
* `POST /join`
* `POST /link`
* `GET /:id`

### Chat (`/api/chat`)

* `GET /:workspaceId`
* `DELETE /:messageId`

### Tasks (`/api/tasks`)

* `GET /:workspaceId`
* `GET /:workspaceId/members`
* `POST /`
* `PATCH /:taskId/status`
* `DELETE /:taskId`

---

## ⚡ Real-Time Socket Events

### Chat

* `join-workspace`
* `send-message`
* `receive-message`
* `delete-message`
* `message-deleted`

### Calls (WebRTC Signaling)

* `call-join`, `call-leave`
* `call-offer`, `call-answer`
* `call-ice-candidate`
* `call-user-joined`, `call-user-left`

---

## 🦀 Tauri IPC Commands

* File system: `read_dir`, `read_file`, `write_file`
* Workspace: `create_workspace`, `open_workspace_folder`
* File ops: `create_file`, `delete_path`, `rename_path`
* Terminal: `run_command`
* Linking: `save_workspace_id`

---

## 🧠 Key Design Decisions

### Why Tauri?

* Electron apps: ~150–200MB
* Tauri apps: ~8–15MB
* Uses native OS webview → significantly lighter

### Why WebRTC?

* Peer-to-peer media streaming
* Backend only handles signaling → minimal server load

### Workspace Architecture

* Each workspace = single MongoDB document
* Ensures all members share:

  * chat
  * tasks
  * participants

### Stable Invite Codes

* Generated once using nanoid
* Never changes → prevents sync issues

---

## ⚠️ Known Limitations

* Linux camera/mic requires `xdg-desktop-portal`
* AppImage issues on newer Arch kernels
* WebRTC may fail behind strict NAT (TURN server needed)
* No screen sharing (planned)
* No live collaborative editing yet (planned)

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/converge
JWT_SECRET=your_secret_here
```

### Frontend

```
REACT_APP_API_URL=https://your-backend-url.com
```

---

## 🛠️ Local Development Setup

```bash
# 1. Clone repo
git clone https://github.com/alenlajeesh/converge-app
cd converge-app

# 2. Install dependencies
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# 3. Setup environment variables

# 4. Start backend
npm run backend

# 5. Start frontend
npm run frontend

# 6. Start Tauri app
npx wait-on http://localhost:3000 && npm run tauri:dev
```

---

## 📦 Build

```bash
# Linux build
npm run tauri:build

# Release via GitHub Actions
git tag v1.0.0
git push origin v1.0.0
```

---

## 🚀 Future Roadmap

* Screen sharing
* Live collaborative editing (cursor sync)
* TURN server integration for global WebRTC
* Plugin/extensions system
* Performance optimizations

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

---

## 📄 License

MIT License

---

## 💡 Vision

Converge aims to become the **ultimate developer workspace**, combining the power of VS Code, Slack, and project management tools into a single lightweight desktop experience.

