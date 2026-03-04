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

// ✅ Track manual replies
const recentlyReplied = new Map()
const MANUAL_REPLY_COOLDOWN = 10 * 60 * 1000 // 10 minutes

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

const replies = {
    morning: {
        hours: { from: 6, to: 10 },
        messages: [
            "Kya mila yeh subha-subha 😅 :(",
            "Dhokaibaaz ho tum 😏",
            "Apni property mera naam kar do please 🏡",
            "So jaa 😴",
            "Main tou so raha, tusi vi so jao 😌",
            "Aapko kya lagta hai, kon jeetega India ya Pakistan? 🇮🇳🇵🇰",
            "Aur batao, mela babu nahi thana thaya aa? 😂",
            "Oo wrong number 🤷‍♂️",
            "Subha subha message? Iss waqt ya tou mai so raha hou ga ya tou university ke liye nikal gaya hou ga 🏃‍♂️💨",
            "Ayo Jethalal itni subha subha message kar rahe ho 😭",
            "Aaj Saturday hai ya Sunday? Agar hai tou mai so raha huuu 😴",
            "Bhai iss waqt ya tou mai kambal mein mummy se 5 minute aur mang raha hou ga 😆",
            "Bro itni subha kaun active hota hai? Sirf doodh wala aur tension 😭",
            "On my way chasing attendance, lala late ho jayega 🏃‍♂️💨",
            "Agar Saturday hai tou mai alarm ignore kar ke so raha hoo 😌",
            "Subha ka message dekh kar mera phone bhi kehta hai 'bhai baad mein' 📵",
            "Itni subha message karke kya hasil karna chahte ho Jethalal ji? 😏",
            "Dream mein billionaire hou ga ya attendance ke liye struggle 😭 life so hard lala",
            "Is waqt sirf do log jaag rahe hote hain: doodh wala aur tum 😭",
            "La lala lalal ree re ga, ma dhaa ne saa ma pa re, so nai dai re Jehtalal 🎶",
            "Aaeyai, aap ka intezar hai 😎",
            "Agar Sunday hai tou mai officially duniya se offline ho 🌍❌",
            "Itni subha-subha message karne walay log secretly aliens hote hain 👽",
            "Ready ho raha hou ya ready hone ka drama kar raha hou ga 🤡",
            "Agar emergency nahi hai tou shaam tak wait karlo, otherwise call kar lo 😌 gg bilkul ignore kar raha huu"
        ]
    },
    afternoon: {
        hours: { from: 10, to: 15 },
        messages: [
            "Kya mila yeh sub kar ke 😅 :(",
            "Dhokaibaaz ho tum 😏",
            "Apni property mera naam kar do please 🏡",
            "So jaa 😴",
            "Main tou so raha, tusi vi so jao 😌",
            "Aapko kya lagta hai, kon jeetega India ya Pakistan? 🇮🇳🇵🇰",
            "Aur batao, mela babu nahi thana thaya aa? 😂",
            "Oo wrong number 🤷‍♂️",
            "Class time hai, baad mein message karunga 📖",
            "In class rn! Message baad mein karenge 🙈",
            "Call kar lo agar internet off hai, university mein idher udher ghoom raha houga 📚",
            "Haye re haye re haye 😅",
            "Main tera jabra fan ho gaya 😎",
            "Sahi kehte hain log 👍",
            "Chaar log kya kehte gaye? 🤔",
            "Sharam tou nahi aati naa 😏",
            "Phir khana bota gaala kad da vaa 🍲",
            "Aur batao, khana khaya? 🍽️",
            "Na Munna na 😅",
            "Ohh please tang mat karo 🙏",
            "Joke sunao 😆",
            "Free Fire khelaiga? 🔥",
            "Kya baat hai, batao batao 🤩",
            "Hnn tou, ki haal chaal dosto? 😎",
            "Tum he ho ab, tum he ho 😏",
            "Mera assignment likh do please 📄",
            "Mirza Ghalib ko aam pasand the 🍎",
            "Wo aapki kidneys mil jati tou!! 😱",
            "Mera paisa kab lota raha hai bhai? 💸",
            "Wo mai keh raha tha ki… 🤔",
            "Hairfall ho raha hai reee 😩",
            "Hathi ud gaya 🐘",
            "Aik titli udni lagi, udd na saki… mujhe nahi yaad wo poem yaar 🦋",
            "Yai mai kya sun raha hou 🤷‍♂️",
            "Tappu tou school kyu nahi gaya? 🏫",
            "Why this kolaveri kolaveri di? 🎶"
        ]
    },
    evening: {
        hours: { from: 15, to: 20 },
        messages: [
            "Kya mila yeh sub kar ke 😅",
            "Dhokaibaaz ho tum :(",
            "Apni property mera naam kar do please 🏡",
            "So jaa 😴",
            "Main tou so raha, tusi vi so jao 😌",
            "Aapko kya lagta hai, kon jeetega India ya Pakistan? ",
            "Aur batao, melai babu nahi thana thaya aa? 😂",
            "Oo wrong number 🤷‍♂️",
            "Yai Duniya Chouk Kaha hai",
            "Bhaiya ternol Jaanai kaa kitna logai",
            "Awwwwwwwwwww",
            "Dhoom macha lai dhoom",
            "Kirish Ka gana sunai ga",
            "Software glitch aa raha",
            "Mai kiya laadlai",
            "Yai mai kya sun raha hou 🤔",
            "Tappu tou school kyu nahi gaya? 🏫",
            "Why this kolaveri kolaveri di? 🎶",
            "Aww are you okay bacha? Call karu :) ❤️",
            "Waisay tou mai kabhi nahi padhta, lekin excuse acha hai 😅",
            "Acting ka badshah hou mai 😎",
            "Sona dai mujhe 😴",
            "Ohh !!! Munna please kaam karne do 🙏",
            "Munna please sonai do 😴",
            "Munna please khana khanai do 🍲",
            "Mere paas aur shabd nahi hain, mai chhuti chahta hou 😌",
            "Kya hua, reply nahi kar raha huuu? Asal mai I have no answer 😅",
            "Mere paisay kab dega bai? 💸",
            "Kaisa laga mera mazakkkkkkkkk 😆",
            "Aur batao, chai peogai? ☕",
            "Baby are you fine? 😘",
            "Aag lagai basti mai, jaat don't care 🔥",
            "I know I'm annoying 😜",
            "Choti bachi ho kya? 🤭",
            "Samajh nahi aata kya Jethalal? 🤔",
            "Kya itna bura hu mai maa? 😅",
            "Bus meri bus ho gayi hai 🚌",
            "Life so hard rn! Aapki kidney mil sakti hai kya? 😭"
        ]
    },
    night: {
        hours: { from: 20, to: 24 },
        messages: [
            "Kya mila yeh sub kar ke 😅 :(",
            "Dhokaibaaz ho tum 😏",
            "Apni property mera naam kar do please 🏡",
            "So jaa 😴",
            "Main tou so raha, tusi vi so jao 😌",
            "Aapko kya lagta hai, kon jeetega India ya Pakistan? 🇮🇳🇵🇰",
            "Aur batao, mela babu nahi thana thaya aa? 😂",
            "Oo wrong number 🤷‍♂️",
            "Yai mai kya sun raha hou 🤔",
            "Tappu tou school kyu nahi gaya? 🏫",
            "Why this kolaveri kolaveri di? 🎶",
            "Life so hard rn! Aapki kidney mil sakti hai kya? 😭",
            "Rakh phone rakh, sone jaa 😴",
            "Sone dai bahi 😌",
            "Aapko neend nahi aati kya? 🛌",
            "Abhi tak jaag rahe ho? 😅",
            "Why this kolaveri kolaveri di!! 🎶",
            "Kya aapke toothpaste me namak hai? 😳",
            "10 mai se 12 dentist ka bharosa Colgate 😆",
            "Sona jaa sona 😴",
            "Kya aapko pata hai 2+2 = 67? 🤯",
            "Waow kya baat hai Jethalal 😎",
            "Come on Superman, say your stupid line 🦸‍♂️",
            "Mera assignment likh do please 📄",
            "Wo din bhi kya din the 😅",
            "Haan tou ki haal chaal mitro? 😎",
            "Mitro, khao piyo, aaish karo 🍽️",
            "Mujhe aap se baat nahi karni, mai naraz hu ;(",
            "One day I will be famous 😎",
            "Sorry, kya kaha? Sunayi nahi diya mujhe 😅",
            "Bahi sahaab re 😎",
            "Why this kolaveri kolaveri di 🎶",
            "Choti bachi ho kya? 🤭",
            "Wohe 100-200 million dollar ki dikkat 💸"
        ]
    },
    latenight: {
        hours: { from: 0, to: 6 },
        messages: [
            "Kya mila yeh sub kar ke 😅 :(",
            "Dhokaibaaz ho tum 😏",
            "Apni property mera naam kar do please 🏡",
            "So jaa 😴",
            "Main tou so raha, tusi vi so jao 😌",
            "Aapko kya lagta hai, kon jeetega India ya Pakistan? 🇮🇳🇵🇰",
            "Aur batao, mela babu nahi thana thaya aa? 😂",
            "Oo wrong number 🤷‍♂️",
            "Mere paas aur shabd nahi hain, mai chhuti chahta hou 😌",
            "Kya hua, reply nahi kar raha huuu? Asal mai I have no answer 😅",
            "Mere paisay kab dega bai? 💸",
            "Kaisa laga mera mazakkkkkkkkk 😆",
            "Aur batao, chai peogai? ☕",
            "Baby are you fine? 😘",
            "Sona jaa sona 😴",
            "Kya aapko pata hai 2+2 = 67? 🤯",
            "Waow kya baat hai Jethalal 😎",
            "Come on Superman, say your stupid line 🦸‍♂️",
            "Mera assignment likh do please 📄",
            "Wo din bhi kya din the 😅",
            "Haan tou ki haal chaal mitro? 😎",
            "Mitro, khao piyo, aaish karo 🍽️",
            "Mujhe aap se baat nahi karni, mai naraz hu ;(",
            "One day I will be famous 😎",
            "Itni raat ko text? Ya tou breakup hua hai ya tum bore ho 😭",
            "Itni raat ko! 😱 Sab theek hai? Call karu?",
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
                <h1 style="color:green"> Bot is Connected!</h1>
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
                <h1>Scan QR Code with WhatsApp</h1>
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
            <h1>Starting bot...</h1>
            <p>Please wait, QR code will appear here shortly.</p>
            <script>setTimeout(() => location.reload(), 3000)</script>
        </body></html>
    `)
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`)
    console.log(` Open your Railway URL to scan the QR code`)
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
                console.log("Connected to WhatsApp successfully!")

                myNumber = sock.user?.id?.split(":")[0] + "@s.whatsapp.net"
                console.log(`Bot number: ${myNumber}`)

                healthCheckInterval = setInterval(async () => {
                    try {
                        await sock.sendPresenceUpdate("available")
                        console.log("Heartbeat OK")
                    } catch (err) {
                        console.log("Heartbeat failed, reconnecting...")
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

                const jid = msg.key.remoteJid
                if (!jid) return
                if (msg.key.fromMe) {
                    recentlyReplied.set(jid, Date.now())
                    console.log(`You replied to ${jid} — bot paused for 10 mins`)
                    return
                }
                if (jid.endsWith("@g.us")) return
                if (jid.endsWith("@broadcast")) return
                if (myNumber && jid === myNumber) return

                const lastManualReply = recentlyReplied.get(jid)
                if (lastManualReply && Date.now() - lastManualReply < MANUAL_REPLY_COOLDOWN) {
                    console.log(`Skipping auto-reply to ${jid} — you replied manually recently`)
                    return
                }
                console.log(`Message received from ${jid}`)
                const waitTime = randomDelay()
                console.log(`Waiting ${waitTime}ms before replying...`)
                await delay(waitTime)

                const reply = getRandomReply()
                await sock.sendMessage(jid, { text: reply })
                console.log(`Auto-replied to ${jid} | hour: ${new Date().getHours()} | msg: "${reply}"`)

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