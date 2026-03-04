const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} = require("baileys")

const qrcode = require("qrcode-terminal")
const QRCode = require("qrcode")
const fs = require("fs")
const pino = require("pino")
const http = require("http")

process.on("uncaughtException", (err) => {
    console.error("⚠️ Uncaught exception (ignored):", err.message)
})

process.on("unhandledRejection", (err) => {
    console.error("⚠️ Unhandled rejection (ignored):", err?.message)
})

let healthCheckInterval = null
let myNumber = null
let latestQR = null
let isConnected = false

// ✅ Simple web server — Railway needs a port open, also shows QR in browser
const server = http.createServer(async (req, res) => {
    if (isConnected) {
        res.writeHead(200, { "Content-Type": "text/html" })
        res.end(`
            <html><body style="font-family:sans-serif;text-align:center;padding:50px">
                <h1 style="color:green">✅ Bot is Connected!</h1>
                <p>WhatsApp bot is running successfully.</p>
                <p>Number: ${myNumber}</p>
            </body></html>
        `)
        return
    }

    if (latestQR) {
        const qrImage = await QRCode.toDataURL(latestQR)
        res.writeHead(200, { "Content-Type": "text/html" })
        res.end(`
            <html><body style="font-family:sans-serif;text-align:center;padding:50px">
                <h1>📱 Scan QR Code with WhatsApp</h1>
                <p>Open WhatsApp → Linked Devices → Link a Device</p>
                <img src="${qrImage}" style="width:300px;height:300px"/>
                <p><small>Page auto-refreshes every 10 seconds</small></p>
                <script>setTimeout(() => location.reload(), 10000)</script>
            </body></html>
        `)
        return
    }

    res.writeHead(200, { "Content-Type": "text/html" })
    res.end(`
        <html><body style="font-family:sans-serif;text-align:center;padding:50px">
            <h1>⏳ Starting bot...</h1>
            <p>Please wait, QR code will appear here shortly.</p>
            <script>setTimeout(() => location.reload(), 3000)</script>
        </body></html>
    `)
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`)
    console.log(`👉 Open your Railway URL to scan the QR code`)
})

async function startBot() {
    try {
        if (healthCheckInterval) {
            clearInterval(healthCheckInterval)
            healthCheckInterval = null
        }

        const { state, saveCreds } = await useMultiFileAuthState("auth")
        const { version, isLatest } = await fetchLatestBaileysVersion()
        console.log(`WA version: ${version.join(".")}, latest: ${isLatest}`)

        const logger = pino({ level: "silent" })

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            logger,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            syncFullHistory: false,
            markOnlineOnConnect: true,
        })

        sock.ev.on("creds.update", saveCreds)

        sock.ev.on("messaging-history.set", () => {
            console.log("📋 Message history synced")
        })

        sock.ev.on("connection.update", (update) => {
            const { connection, qr, lastDisconnect } = update

            if (qr) {
                latestQR = qr
                isConnected = false
                console.log("📱 QR code ready — open your Railway URL to scan it")
                qrcode.generate(qr, { small: true })
            }

            if (connection === "close") {
                isConnected = false
                const statusCode = lastDisconnect?.error?.output?.statusCode
                console.log("Connection closed. Status code:", statusCode)

                if (statusCode === DisconnectReason.loggedOut) {
                    console.log("Logged out! Clearing auth and restarting...")
                    fs.rmSync("auth", { recursive: true, force: true })
                    setTimeout(startBot, 3000)
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log("Connection replaced. Exiting.")
                    process.exit(1)
                } else {
                    console.log("Reconnecting...")
                    setTimeout(startBot, 5000)
                }

            } else if (connection === "open") {
                isConnected = true
                latestQR = null
                console.log("✅ Connected to WhatsApp successfully!")

                myNumber = sock.user?.id?.split(":")[0] + "@s.whatsapp.net"
                console.log(`Bot number: ${myNumber}`)

                healthCheckInterval = setInterval(async () => {
                    try {
                        await sock.sendPresenceUpdate("available")
                        console.log("💓 Heartbeat OK")
                    } catch (err) {
                        console.log("💔 Heartbeat failed, reconnecting...")
                        clearInterval(healthCheckInterval)
                        setTimeout(startBot, 3000)
                    }
                }, 30000)
            }
        })

        sock.ev.on("messages.upsert", async ({ messages, type }) => {
            try {
                if (type !== "notify") return

                const msg = messages[0]
                if (!msg.message) return
                if (msg.key.fromMe) return

                const jid = msg.key.remoteJid
                if (!jid) return
                if (jid.endsWith("@g.us")) return
                if (jid.endsWith("@broadcast")) return
                if (myNumber && jid === myNumber) return

                console.log(`Message received from ${jid}`)

                const currentHour = new Date().getHours()

                if (currentHour >= 15) {
                    await sock.sendMessage(jid, {
                        text: "Aww are you okeyy bacha !? call keru :)"
                    })
                    console.log(`Auto-replied to ${jid}`)
                }

            } catch (err) {
                console.error("Message handler error:", err.message)
            }
        })

    } catch (err) {
        console.error("startBot crashed:", err.message)
        console.log("Restarting in 5 seconds...")
        setTimeout(startBot, 5000)
    }
}

startBot()