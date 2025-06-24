# 🌐 The Internet Browser

> **The browser *is* the network.**  
> A decentralized, peer-to-peer browser that replaces DNS, hosting, and servers with magnet links, WebTorrent, and WebRTC.  
> No signups. No gatekeepers. No backdoors. Just code, peers, and signal.

---

## ⚡ What is it?

**The Internet Browser** is a desktop browser built with **Electron + Svelte + Vite**, designed to make the traditional web stack obsolete.

It empowers users to:

- 📦 Open web apps directly from **magnet links**
- 📤 **Send** any file or folder via WebTorrent
- 📥 **Receive** content from peers, in real time
- 📛 Replace DNS with a **decentralized @name system** (via Nostr)
- ❤️ Like = Pin = Seed = Support your favorite apps
- 🧪 Run or remix full web apps using **WebContainers** (for dev mode)
- 🧭 Browse with tabs, address bar, and a growing developer sidebar

---

## 🧠 Core Features

| Feature             | Description |
|---------------------|-------------|
| 🔗 Magnet-Driven     | Sites and apps are loaded via magnet links (WebTorrent) |
| 🌍 No Hosting        | Content is shared P2P — no servers or DNS required |
| 🗂 Tabbed UI         | Each tab runs in its own process, like Chrome |
| 🧰 Dev Sidebar       | Built-in developer tools, starting with a live console |
| 📨 Send & Receive    | Share files and folders with a click |
| 💾 Pin to Like       | Pin content to seed and support it (acts like a “Like”) |
| 🧭 @Name Resolution  | Human-readable names mapped to magnet links via Nostr |
| 🛠 Remix Support     | WebContainers allow apps to be run or edited from source |

---

## 🛠️ Tech Stack

- 🧠 **Electron** – Cross-platform desktop shell
- ⚡ **Vite + Svelte** – UI framework and fast dev environment
- 🧲 **WebTorrent** – Peer-to-peer file and app sharing
- 🛰 **WebRTC + Nostr** – Real-time peer communication and decentralized name resolution
- 🔥 **WebContainer** – Run dev environments in-browser (optional)

---

## 🚀 Getting Started

1. **Clone the repository**
   ```
   git clone https://github.com/your-username/your-repo-name.git
   cd your-repo-name
   ```

2. **Install dependencies**

   ```
   npm install
   ```

3. **Build the Electron main process**

   ```
   mkdir dist-electron
   cp electron/main.js dist-electron/
   cp electron/preload.js dist-electron/
   ```

---

## 🛠 Development

### Run in Development Mode

Start the app with hot-reloading:

```
npm run electron:dev
```

This will:

* Start the Vite development server
* Launch Electron with hot reload

---

## 📦 Build for Production

1. **Build the application**

   ```
   npm run build
   ```

2. **Package the Electron app**

   ```
   npm run electron:pack
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:

1. Check the console output in developer tools
2. Review the application logs
3. File issues with detailed reproduction steps

## All Features

✅ Full WebTorrent client with real P2P functionality
✅ File seeding and downloading with progress tracking
✅ Tracker support for popular WebTorrent trackers
✅ Stream-based file handling for large files
✅ Error handling and timeout management

### Enhanced Security Implementation
Content Security Policy (CSP):

✅ Strict CSP headers preventing XSS attacks
✅ Protocol restrictions blocking dangerous schemes
✅ Domain validation with private network protection

Process Isolation:

✅ BrowserView integration for isolated web content
✅ Sandboxed tab processes with limited permissions
✅ IPC validation with input sanitization

Security Monitoring:

✅ Real-time threat detection and rate limiting
✅ Suspicious activity monitoring with automated warnings
✅ Security audit logging and metrics tracking

### Production Deployment Features
Code Signing & Distribution:

✅ Electron Builder configuration for all platforms
✅ Code signing setup for Windows and macOS
✅ Auto-updater integration with security verification
✅ Protocol handler registration for magnet links

Performance Optimizations:

✅ Efficient memory management with cleanup procedures
✅ Background process management for torrent operations
✅ Optimized WebTorrent settings for production use

Monitoring & Debugging:

✅ Comprehensive logging system with log levels
✅ Error reporting and crash analytics
✅ Performance metrics and security auditing

### Security Best Practices Implemented
✅ Input Validation: All user inputs validated and sanitized
✅ URL Security: Malicious URL detection and blocking
✅ File Validation: Safe file handling with size/type restrictions
✅ Rate Limiting: Prevents abuse and DOS attacks
✅ Memory Safety: Secure cleanup and garbage collection
✅ Protocol Security: Safe handling of magnet links and web content
✅ Update Security: Signed updates with integrity verification