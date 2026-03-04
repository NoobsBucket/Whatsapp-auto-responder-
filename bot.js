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

const delay = (ms) => new Promise(res => setTimeout(res, ms))
const randomDelay = () => Math.floor(Math.random() * (3000 - 500 + 1)) + 500

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

// ✅ Time-based reply arrays
const replies = {
    morning: {
        hours: { from: 6, to: 10 },
        messages: [
            "kya mila yai sub ker kai haan:(",
            "dhokaibaaz ho tum",
            "apni property merai naam kerdo please",
            "so jaa ",
            "mai tou so raha tusi vi so jaow",
            "aap ko kya lagata hai kon jetai gaa india yaa pakistan",
            "or bataow melai babu nai thana thayaa aaa ",
            "oo wrong number",
            "subha Subha Message , Iss time yaa tou mai soo raha howga yaa tou university kai liyai nikal gaya hou ga",
            "Ayo Jethalal itni subha subha message ker rahai hoo",
            "aaj saturday hai yaa sunday ? ager hai tou !!! tub tou mai so raha huuu",
            "Subha subha message? Bhai iss waqt yaa tou mai kambal mein mummy se 5 minute aur mang raha hou ga 😴",
            "Bro itni subha kaun active hota hai? Sirf doodh wala aur tension 😭",
            "Ager aaj weekday hai tou on my way chasing the attendance lala late ho jeyega mai class kai liyai 🏃‍♂️💨",
            "Ager Saturday hai tou mai alarm ko ignore kar gadhai ghodai bech ker so raha hoo 😌",
            "Subha ka message dekh kar mera phone bhi kehta hai 'bhai baad mein' 📵",
            "Itni subha message ker ke kya hasil karna chahte ho Jethalal ji? 😏",
            "Is time ya tou mai dream mein billionaire hou ga ya attendance ke liye struggle 😭 life so hard lala",
            "Is waqt sirf do log jaag rahe hote hain: doodh wala aur tum. Dono sone dai mujhey lala 😭",
            "la lala lalal ree re ga ma dhaa ne saa ma pa re so nai dai re jehtalal",
            "Aaeyai aap ka intezar hai",
            "Ager Sunday hai tou mai officially duniya se offline ho 🌍❌",
            "itni subha subha message kerne walay log secretly aliens hote hain 👽",
            "Is waqt mai ya tou ready ho raha hou ga ya phir ready hone ka drama kar raha hou ga 🤡",
            "Ager emergency nahi hai tou shaam tak wait karlo reply kerdoga otherwise call kerlo 😌 gg bilkul ignore ker raha huu"
        ]
    },
    afternoon: {
        hours: { from: 10, to: 15 },
        messages: [
            "kya mila yai sub ker kai haan:(",
            "dhokaibaaz ho tum",
            "apni property merai naam kerdo please",
            "so jaa ",
            "mai tou so raha tusi vi so jaow",
            "aap ko kya lagata hai kon jetai gaa india yaa pakistan",
            "or bataow melai babu nai thana thayaa aaa ",
            "oo wrong number",
            "class time class kai baad he message keroga",
            "In class rn! 📖 message keorga baad mein",
            "call kerlo ager internet off hai tou samjh jaow university mai idher udher feriya maar raha houga",
            "haye re haye re haye haye haye haye haye",
            "mai tera jabra fan hogaya",
            "sahi kehtai hain log",
            "4 log kya kehai gai ",
            "sharam tou nahi aati naa",
            "fhir khenaa bota gaala kad da vaa",
            "or bataow khana khayaa",
            "na munna naa",
            "ohh please tang mut kero",
            "joke sunai ga",
            "free fire khelaiga",
            "kya baat hai bataow bataow",
            "hnn tou ki haal chaal dosto mai ho neon man",
            "tum he ho abb tum he hoo",
            "mera assignment likh do please",
            "mirza ghalib ko aam pasand thai",
            "wo aap ki kidneys mil jati tou !! ahm ahmm",
            "merai paisa kub lota raha hai bhai ?!!",
            "wo mai keh rha tha ki",
            "hairfall ho raha hai reee",
            "hathi udda",
            "aik titli udnai lagi udd naa saki mujhe nahi yaad wo peom yaar",
            "yai mai kya suun raha hoo",
            "tappu tou school kyu nahi gaya",
            "why this kolaveri kolaveri di"
        ]
    },
    evening: {
        hours: { from: 15, to: 20 },
        messages: [
            "kya mila yai sub ker kai haan:(",
            "dhokaibaaz ho tum",
            "apni property merai naam kerdo please",
            "so jaa ",
            "mai tou so raha tusi vi so jaow",
            "aap ko kya lagata hai kon jetai gaa india yaa pakistan",
            "or bataow melai babu nai thana thayaa aaa ",
            "oo wrong number",
            "yai mai kya suun raha hoo",
            "tappu tou school kyu nahi gaya",
            "why this kolaveri kolaveri di",
            "Aww are you okeyy bacha !? call keru :)",
            "wesai tou mai kabhi nahi padhta lekien as a bahana it is very good excuse dekh lala padhnai dai mujhe",
            "acting kai badhshah jo ji",
            "sonai dai mujhe",
            "ohh !!! munna please kaam kernai doo 🙏",
            "munna please sonai doo",
            "munna please khana khani doo",
            "merai pass or sabd nahi hain , mai chhuti chaahata huu",
            "kya howa reply nahi ker raha huuu mai , asal mai i have no awnser for this",
            "merai pasiay kub dega bai",
            "kesa laga mera mazakkkkkkkkk",
            "our bataow chai peogai",
            "baby are you fine ?",
            "aag lagai basti mai jaat dont care",
            "i know im annoying",
            "choti bachi ho kya",
            "samjh nahi aata kya jethalaal",
            "kya itna bura hu mai maa",
            "bus meri bus ho gayi hai",
            "life so hard rn ! aap ki kideny mil sukti hai kya"
        ]
    },
    night: {
        hours: { from: 20, to: 24 },
        messages: [
            "kya mila yai sub ker kai haan:(",
            "dhokaibaaz ho tum",
            "apni property merai naam kerdo please",
            "so jaa ",
            "mai tou so raha tusi vi so jaow",
            "aap ko kya lagata hai kon jetai gaa india yaa pakistan",
            "or bataow melai babu nai thana thayaa aaa ",
            "oo wrong number",
            "yai mai kya suun raha hoo",
            "tappu tou school kyu nahi gaya",
            "why this kolaveri kolaveri di",
            "life so hard rn ! aap ki kideny mil sukti hai kya",
            "rakh phone rakh sone jaa",
            "sone dai bahi",
            "aap ko neend nahi aati kya",
            "abhi tuk jaag rahai hoo",
            "why this kolaveri kolaveri di !!",
            "kya aap kai toothpaste mai namak hai",
            "10 mai sai 12 dentist ka bharosa colgate",
            "sonai ja sonai",
            "kya aap ko pata hai 2+2 = 67 ",
            "waow kya baat hai jethalal",
            "come on superman say your stupid line",
            "mera assignment likh do please",
            "wo din bhi kya din thai",
            "haan tou ki haal chaal mitro ",
            "mitro khaow piyo aaish kero",
            "mujhe aap sai baat nahi kerni mai naraz huu ;(",
            "one day i will be phamous",
            "sorry kya kaha sunayi nahi diya mujhe",
            "bahi sahaab re ",
            "why this kolaveri kolaveri di",
            "choti bachi ho kya",
            "wohe 100-200 millon daaler ki diket"
        ]
    },
    latenight: {
        hours: { from: 0, to: 6 },
        messages: [
            "kya mila yai sub ker kai haan:(",
            "dhokaibaaz ho tum",
            "apni property merai naam kerdo please",
            "so jaa ",
            "mai tou so raha tusi vi so jaow",
            "aap ko kya lagata hai kon jetai gaa india yaa pakistan",
            "or bataow melai babu nai thana thayaa aaa ",
            "oo wrong number",
            "merai pass or sabd nahi hain , mai chhuti chaahata huu",
            "kya howa reply nahi ker raha huuu mai , asal mai i have no awnser for this",
            "merai pasiay kub dega bai",
            "kesa laga mera mazakkkkkkkkk",
            "our bataow chai peogai",
            "baby are you fine ?",
            "sonai ja sonai",
            "kya aap ko pata hai 2+2 = 67 ",
            "waow kya baat hai jethalal",
            "come on superman say your stupid line",
            "mera assignment likh do please",
            "wo din bhi kya din thai",
            "haan tou ki haal chaal mitro ",
            "mitro khaow piyo aaish kero",
            "mujhe aap sai baat nahi kerni mai naraz huu ;(",
            "one day i will be phamous",
            "Itni raat ko text? Ya tou breakup hua hai ya tum bore ho 😭",
            "Itni raat ko! 😱 Sab theek hai? call keru!",
            "Are you okay bacha ??",
            "Sleeping zzzz 😴 reply in the morning!"

        ]
    }
}

function getRandomReply() {
    const hour = new Date().getHours()
    const slot = Object.values(replies).find(
        (r) => hour >= r.hours.from && hour < r.hours.to
    )
    const messages = slot ? slot.messages : replies.evening.messages
    return messages[Math.floor(Math.random() * messages.length)]
}

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

                const waitTime = randomDelay()
                console.log(`⏳ Waiting ${waitTime}ms before replying...`)
                await delay(waitTime)

                const reply = getRandomReply()
                await sock.sendMessage(jid, { text: reply })
                console.log(`✅ Auto-replied to ${jid} | hour: ${new Date().getHours()} | msg: "${reply}"`)

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