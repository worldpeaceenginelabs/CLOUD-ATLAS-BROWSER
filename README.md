![image](https://github.com/user-attachments/assets/10dd098c-957e-4d56-864a-d7ac396f48e1)

# 🌐 Cloud Atlas Browser

> **The browser *is* the network.**  
> A decentralized, peer-to-peer browser that replaces DNS, hosting, and servers with keypair signed whitelists, magnet links, WebTorrent, and WebRTC.  
> 🚫 No surveillance. 🚫 No middlemen. 🚫 No gatekeepers. 🚫 No servers required. 🚫 No backdoors. Just code, peers, and signal.

<br><br>

## ⚡ What is it?

**Cloud Atlas Browser** is a next-gen Chromium-based browser built for the decentralized internet with **Electron + Svelte + Vite**, designed to make the traditional web stack obsolete.

**💡 Why Svelte?**  
*Explainer at the end of this document. You’ll never go back—promise!*

<br><br>

## 🧠 Core Features

Cloud Atlas Browser is more than a browser. It’s a decentralized runtime, app launcher, and seeding engine in one.

It empowers users to:

- 📦 Open full web apps directly from **magnet links** (coming soon)
- 📤 **Send** files or folders to peers via WebTorrent (working)
- 📥 **Receive** content in real time, peer-to-peer (working)
- 🎬 Stream video/audio from torrents with **sticky media player** (working)
- 🖼️ Preview images instantly via system viewer (working)
- ❤️ **Like = Pin** = Seed and support your favorite apps with bandwidth (coming soon)
- 🧪 Run or remix full web apps using **WebContainers** (coming soon)
- 🧭 Browse with tabs, address bar, and a growing dev tools sidebar (working)
- 🛠 Fork and republish apps with **`.atlasmeta.json`** versioning (decentralized GitHub) (coming soon)
- 🔐 Use Nostr for **portable identity** (coming soon)
- 🧾 Register your dApp name for a one-time lifetime fee — human verification + lifetime hosting + infinite global scale (no servers, no middlemen, ever) (coming soon)
- 📚 Discover approved dApps via the keypair signed **whitelist** (coming soon)
- 🔗 Seamlessly connect to and power the **Cloud Atlas OS** (coming soon)

<br><br>

## 🔧 Feature Table

| Feature                    | Description                                                                 |
|----------------------------|-----------------------------------------------------------------------------|
| 🔗 Magnet-Driven Apps       | Load sites and dApps via magnet links using WebTorrent                     |
| 🌍 No Hosting Required      | Everything is peer-to-peer; apps load from magnet links, not URLs          |
| 📛 @Name System             | Human-readable name to magnet link resolution                              |
| ❤️ Like = Pin               | Liking seeds bandwidth—support apps you believe in                         |
| 📨 Send/Receive Files       | Share files or entire folders P2P instantly                                |
| 🎬 Collapsible Media Player | Sticky, always-visible player for torrent-based media playback             |
| 📹 Smart File Detection     | Auto-detect video/audio/image types and show relevant action buttons       |
| 🎵 Stream & Preview         | One-click stream (video/audio) or preview (images) with native controls    |
| 🖼️ Image Viewer Support     | Uses system default viewer (cross-platform via shell.openPath)             |
| 💻 WebContainer Support     | Apps with `package.json` auto-open in dev mode                             |
| 🧰 Dev Sidebar              | Live console, editing tools, and future plugin API                         |
| 🔁 Remix + Re-publish       | Fork apps and re-seed them instantly with `.atlasmeta.json`                |
| 🧾 Dev Registry             | Whitelist and publish apps to the ecosystem                                |
| 📚 Whitelist Browser        | Curated magnet apps searchable from within the browser                     |
| 🔗 Cloud Atlas OS Bridge    | Acts as a node and launcher for the full Cloud Atlas OS                    |

<br><br>

## 🛠️ Tech Stack

- 🧠 **Electron** – Cross-platform desktop shell
- ⚡ **Vite + Svelte** – UI framework and fast dev environment
- 🧲 **WebTorrent** – Peer-to-peer file and app sharing
- 🛰 **WebRTC + Bittorrent** – Real-time peer communication and signaling
- 🔐 **Nostr** – Keypair-based auth
- 🔥 **WebContainer** – Run dev environments in-browser

<br><br>

## 🔒 Security

We leverage the **Electron and Chrome team’s ongoing Chromium patch pipeline**, meaning:

- ✅ No need to maintain our own browser engine
- ✅ All V8, WebRTC, and rendering bugs patched upstream
- ✅ Chromium sandboxing and TLS security included out-of-the-box

> ⚠️ Unlike most “decentralized” stacks, **Cloud Atlas Browser is secure by design**, without sacrificing power.

<br><br>

## 🚀 Getting Started – 🛠 Development

### Run in Development Mode

```bash
npm run electron:dev
````

This will:

* Start the Vite development server
* Wait for the frontend to be ready on port `5173`
* Launch Electron with `IS_DEV=true` for dev mode

<br><br>

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

<br><br>

## Support

For issues and questions:

1. Check the console output in developer tools
2. Review the application logs
3. File issues with detailed reproduction steps

<br><br>

### Enhanced Security Implementation (coming soon)
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

<br><br>

## 🧾 Developer Note: What Svelte Actually Is (and Isn’t)

Before we go any further:  
**Svelte is not a language** (yet). It’s best described as a **frontend compiler + WYSIWYG-like dev experience** that just *feels* like a new language.

<br><br>

## ✅ “Know JavaScript? You already know Svelte.”

![image](https://github.com/user-attachments/assets/b7a2321a-c68b-4807-a1a7-1417e9b2eb48)

<br><br>

### 🧠 Here’s the truth:

- **Svelte is a compiler**, not a framework.
- It takes `.svelte` files—each with `<script>`, `<style>`, and HTML markup—and compiles them into optimized vanilla JavaScript at build time.
- The result? **No virtual DOM**, minimal runtime overhead, and **super-fast apps** that run anywhere (browser, edge, CDN, local).

Svelte’s structure feels clean and expressive:
- Every component = a mini app  
- Every page = a Svelte component  
- Bindings and reactivity are native to the syntax  
- It’s **JS-first**, not opinionated or bloated

<br><br>

## 💡 Why We Use Svelte for Cloud Atlas

Cloud Atlas Browser and OS are designed according to the JAM stack to run **in the browser**, **at the edge**, or **entirely offline**—with as little server dependency as possible. That’s why we avoid SvelteKit (which adds server-side behavior) and stick with **pure Svelte via Vite**:

```bash
npm create vite@latest
````

# Choose 'Svelte' and then 'JavaScript' or 'TypeScript' when prompted

- ✅ You get a fast, preconfigured local dev environment with hot reload  
- ✅ Builds are static, lightweight, and ready for WebTorrent, WebRTC, and CDN distribution  

> **TL;DR:** Svelte gives you full control, near-zero runtime, and the power to build dApps that don’t need a cloud to run.
