process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.stack || err);
});

process.on("unhandledRejection", (reason, p) => {
  console.error("Unhandled Promise Rejection:", reason);
});

const axios = require("axios");
const pino = require("pino");
const NodeCache = require("node-cache");
const config = require("./settings");
const l = console.log;
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  isJidBroadcast,
  getContentType,
  proto,
  makeCacheableSignalKeyStore,
  generateWAMessageContent,
  generateWAMessage,
  AnyMessageContent,
  prepareWAMessageMedia,
  areJidsSameUser,
  downloadContentFromMessage,
  MessageRetryMap,
  generateForwardMessageContent,
  generateWAMessageFromContent,
  generateMessageID,
  delay,
  makeInMemoryStore,
  jidDecode,
  fetchLatestBaileysVersion,
  Browsers,
} = require(config.BAILEYS);

const {
  getBuffer,
  getGroupAdmins,
  getRandom,
  h2k,
  isUrl,
  Json,
  runtime,
  sleep,
  fetchJson,
} = require("./lib/functions");
const {
  AntiDelDB,
  initializeAntiDeleteSettings,
  setAnti,
  getAnti,
  getAllAntiDeleteSettings,
  saveContact,
  loadMessage,
  getName,
  getChatSummary,
  saveGroupMetadata,
  getGroupMetadata,
  saveMessageCount,
  getInactiveGroupMembers,
  getGroupMembersMessageCount,
  saveMessage,
} = require("./data");
const fsSync = require("fs");
const fs = require("fs").promises;
const ff = require("fluent-ffmpeg");
const P = require("pino");
const GroupEvents = require("./lib/groupevents");
const { PresenceControl, BotActivityFilter } = require("./data/presence");
const qrcode = require("qrcode-terminal");
const StickersTypes = require("wa-sticker-formatter");
const util = require("util");
const { sms, downloadMediaMessage, AntiDelete } = require("./lib");
const FileType = require("file-type");
const bodyparser = require("body-parser");
const chalk = require("chalk");
const os = require("os");
const Crypto = require("crypto");
const path = require("path");
const { getPrefix } = require("./lib/prefix");
const readline = require("readline");

const ownerNumber = ["2349117525115"];

const ENV_PATH = path.join(__dirname, ".env");
function ensureEnv(envPath) {
  try {
    const defaults = [
      "SESSION_ID=",
      "PAIRING_CODE=false",
      "MODE=public",
      "OWNER_NUMBER=2349117525115",
      "ANTI_CALL=false",
      "READ_MESSAGE=false",
      "AUTO_STATUS_SEEN=false",
      "AUTO_STATUS_REACT=false",
      "AUTO_STATUS_REPLY=false",
      "AUTO_STATUS_MSG=Hello 👋",
      "AUTO_REACT=false",
      "CUSTOM_REACT=false",
      "CUSTOM_REACT_EMOJIS=🥲,😂,👍🏻,🙂,😔",
      "HEART_REACT=false",
      "DEV="
    ];
    if (!fsSync.existsSync(envPath)) {
      fsSync.writeFileSync(envPath, defaults.join("\n") + "\n");
      console.log(chalk.green(`.env created at ${envPath}`));
      console.log(chalk.yellow("Set SESSION_ID to vortex~<base64 json creds> for seamless login."));
      return;
    }
    const existing = fsSync.readFileSync(envPath, "utf8");
    const existingKeys = new Set(
      existing.split("\n").map(l => l.trim()).filter(Boolean).map(l => l.split("=")[0])
    );
    const missing = defaults.filter(d => !existingKeys.has(d.split("=")[0]));
    if (missing.length) {
      fsSync.appendFileSync(envPath, missing.join("\n") + "\n");
      console.log(chalk.green(".env updated with missing defaults"));
    }
  } catch (e) {
    console.error(chalk.red("Failed to ensure .env:", e.message));
  }
}
ensureEnv(ENV_PATH);
require("dotenv").config({ path: ENV_PATH });

const tempDir = path.join(os.tmpdir(), "cache-temp");
if (!fsSync.existsSync(tempDir)) {
  fsSync.mkdirSync(tempDir, { recursive: true });
}
const clearTempDir = () => {
  fsSync.readdir(tempDir, (err, files) => {
    if (err) {
      console.error(chalk.red("Error clearing temp directory:", err.message));
      return;
    }
    for (const file of files) {
      fsSync.unlink(path.join(tempDir, file), (err) => {
        if (err) console.error(chalk.red(`Error deleting temp file ${file}:`, err.message));
      });
    }
  });
};
setInterval(clearTempDir, 5 * 60 * 1000);

const express = require("express");
const app = express();
const port = process.env.PORT || 7860;

let malvin;
const sessionDir = path.join(__dirname, "./sessions");
const credsPath = path.join(sessionDir, "creds.json");
if (!fsSync.existsSync(sessionDir)) {
  fsSync.mkdirSync(sessionDir, { recursive: true });
}

async function loadSession() {
  const isInteractive = process.stdin.isTTY;
  let sessionId = process.env.SESSION_ID || config.SESSION_ID;

  if (!sessionId && isInteractive) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    sessionId = await new Promise((resolve) => {
      rl.question(
        chalk.cyan("Paste your SESSION_ID (KC~xxxx): "),
        (answer) => {
          rl.close();
          resolve(answer.trim());
        }
      );
    });
  }

  if (!sessionId) {
    console.error(chalk.red("SESSION_ID is required. Set it or paste it."));
    process.exit(1);
  }

  if (!sessionId.startsWith("kc:~")) {
    console.error(chalk.red("Invalid SESSION_ID format"));
    process.exit(1);
  }

  try {
    console.log(chalk.yellow("Decoding session..."));
    const decoded = Buffer.from(sessionId.replace("kc:~", ""), "base64");
    fsSync.writeFileSync(credsPath, decoded);
    console.log(chalk.green("Session loaded successfully"));
    return JSON.parse(decoded.toString());
  } catch (e) {
    console.error(chalk.red("Failed to decode SESSION_ID:", e.message));
    process.exit(1);
  }
}

async function connectWithPairing(malvin, useMobile) {
  if (useMobile) {
    throw new Error("Cannot use pairing code with mobile API");
  }
  if (!process.stdin.isTTY) {
    console.error(chalk.red("Cannot prompt for phone number in non-interactive environment"));
    process.exit(1);
  }

  console.log(chalk.bgYellow.black(" ACTION REQUIRED "));
  console.log(chalk.green("┌" + "─".repeat(46) + "┐"));
  console.log(chalk.green("│ ") + chalk.bold("Enter WhatsApp number to receive pairing code") + chalk.green(" │"));
  console.log(chalk.green("└" + "─".repeat(46) + "┘"));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const question = (text) => new Promise((resolve) => rl.question(text, resolve));

  let number = await question(chalk.cyan("» Enter your number (e.g., +2349117525115): "));
  number = number.replace(/[^0-9]/g, "");
  rl.close();

  if (!number) {
    console.error(chalk.red("No phone number provided"));
    process.exit(1);
  }

  try {
    let code = await malvin.requestPairingCode(number);
    code = code?.match(/.{1,4}/g)?.join("-") || code;
    console.log("\n" + chalk.bgGreen.black(" SUCCESS ") + " Use this pairing code:");
    console.log(chalk.bold.yellow("┌" + "─".repeat(46) + "┐"));
    console.log(chalk.bold.yellow("│ ") + chalk.bgWhite.black(code) + chalk.bold.yellow(" │"));
    console.log(chalk.bold.yellow("└" + "─".repeat(46) + "┘"));
    console.log(chalk.yellow("Enter this code in WhatsApp:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap 'Link a Device'\n4. Enter the code"));
  } catch (err) {
    console.error(chalk.red("Error getting pairing code:", err.message));
    process.exit(1);
  }
}

async function connectToWA() {
  console.log(chalk.cyan("Connecting to WhatsApp..."));

  const creds = await loadSession();

  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(__dirname, "./sessions"),
    { creds: creds || undefined }
  );

  const msgRetryCounterCache = new NodeCache();

  const { version } = await fetchLatestBaileysVersion();

  const pairingCode = config.PAIRING_CODE === "true" || process.argv.includes("--pairing-code");
  const useMobile = process.argv.includes("--mobile");

  malvin = makeWASocket({
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    syncFullHistory: true,
    auth: state,
    version,
    getMessage: async () => ({}),
  });

  if (pairingCode && !state.creds.registered) {
    await connectWithPairing(malvin, useMobile);
  }

  malvin.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log(chalk.red("[ 🛑 ] Connection closed, please change session ID or re-authenticate"));
        if (fsSync.existsSync(credsPath)) {
          fsSync.unlinkSync(credsPath);
        }
        process.exit(1);
      } else {
        console.log(chalk.red("[ ⏳️ ] Connection lost, reconnecting..."));
        setTimeout(connectToWA, 5000);
      }
    } else if (connection === "open") {
      console.log(chalk.green("[ 🤖 ] KC Connected ✅"));

      // Load plugins
      const pluginPath = path.join(__dirname, "plugins");
      try {
        fsSync.readdirSync(pluginPath).forEach((plugin) => {
          if (path.extname(plugin).toLowerCase() === ".js") {
            require(path.join(pluginPath, plugin));
          }
        });
        console.log(chalk.green("[ ✅ ] Plugins loaded successfully"));
      } catch (err) {
        console.error(chalk.red("[ ❌ ] Error loading plugins:", err.message));
      }

      // Send connection message
try {
  await sleep(2000);
  const jid = malvin.decodeJid(malvin.user.id);
  if (!jid) throw new Error("Invalid JID for bot");

  const botname = "KC";
  const ownername = "KIRITO";
  const prefix = getPrefix();
  const username = "KIRITO";
  const mrmalvin = `https://github.com/${username}`;
  const repoUrl = "https://github.com/msgamecoder/vortex-s2";
  const welcomeAudio = "https://files.catbox.moe/jlf4l2.mp3";
  
  // Get current date and time
  const currentDate = new Date();
  const date = currentDate.toLocaleDateString();
  const time = currentDate.toLocaleTimeString();
  
  // Format uptime
  function formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds %= 24 * 60 * 60;
    const hours = Math.floor(seconds / (60 * 60));
    seconds %= 60 * 60;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
  
  const uptime = formatUptime(process.uptime());

const upMessage = `
*┏━━〔 🔥 KC IS BACK 🔥 〕━━⊷*
*┃ 😈 The demon has awakened again…*
*┃*
*┃ ⚙️ Prefix : ${prefix}*
*┃ 📅 Date   : ${date}*
*┃ ⏰ Time   : ${time}*
*┃ ⏳ Uptime : ${uptime}*
*┃ 👑 Owner  : ${ownername}*
*┃*
*┃ 📢 Follow Group*
*┃ 🔗 https://chat.whatsapp.com/DXasbP5xOeT77AmzaPykEw*
*┗━━━━━━━━━━━━━━━━━━⊷*
> ⚠️ *Report any error to the dev immediately*`;

  try {
    await malvin.sendMessage(jid, {
      image: { url: "https://i.ibb.co/Q7Lv5JBk/zenitsu-agatsuma-3840x2160-24472.png" },
      caption: upMessage,
    }, { quoted: null });
    console.log(chalk.green("[ 📩 ] Connection notice sent successfully with image"));

    await malvin.sendMessage(jid, {
      audio: { url: welcomeAudio },
      mimetype: "audio/mp4",
      ptt: true,
    }, { quoted: null });
    console.log(chalk.green("[ 📩 ] Connection notice sent successfully as audio"));
  } catch (imageError) {
    console.error(chalk.yellow("[ ⚠️ ] Image failed, sending text-only:"), imageError.message);
    await malvin.sendMessage(jid, { text: upMessage });
    console.log(chalk.green("[ 📩 ] Connection notice sent successfully as text"));
  }
} catch (sendError) {
  console.error(chalk.red(`[ 🔴 ] Error sending connection notice: ${sendError.message}`));
  await malvin.sendMessage(ownerNumber[0], {
    text: `Failed to send connection notice: ${sendError.message}`,
  });
}

// Follow newsletters
      const newsletterChannels = [                      "",
        "120363401297349965@newsletter",
        "",
        ];
      let followed = [];
      let alreadyFollowing = [];
      let failed = [];

      for (const channelJid of newsletterChannels) {
        try {
          console.log(chalk.cyan(`[ 📡 ] Checking metadata for ${channelJid}`));
          const metadata = await malvin.newsletterMetadata("jid", channelJid);
          if (!metadata.viewer_metadata) {
            await malvin.newsletterFollow(channelJid);
            followed.push(channelJid);
            console.log(chalk.green(`[ ✅ ] Followed newsletter: ${channelJid}`));
          } else {
            alreadyFollowing.push(channelJid);
            console.log(chalk.yellow(`[ 📌 ] Already following: ${channelJid}`));
          }
        } catch (error) {
          failed.push(channelJid);
          console.error(chalk.red(`[ ❌ ] Failed to follow ${channelJid}: ${error.message}`));
          await malvin.sendMessage(ownerNumber[0], {
            text: `Failed to follow ${channelJid}: ${error.message}`,
          });
        }
      }

      console.log(
        chalk.cyan(
          `📡 Newsletter Follow Status:\n✅ Followed: ${followed.length}\n📌 Already following: ${alreadyFollowing.length}\n❌ Failed: ${failed.length}`
        )
      );

      // Join WhatsApp group
      const inviteCode = "GKh3HJcMkmxJQQaDQI54W1";
      try {
        await malvin.groupAcceptInvite(inviteCode);
        console.log(chalk.green("[ ✅ ] joined the WhatsApp group successfully"));
      } catch (err) {
        console.error(chalk.red("[ ❌ ] Failed to join WhatsApp group:", err.message));
        await malvin.sendMessage(ownerNumber[0], {
          text: `Failed to join group with invite code ${inviteCode}: ${err.message}`,
        });
      }
    }

    if (qr && !pairingCode) {
      console.log(chalk.red("[ 🟢 ] Scan the QR code to connect or use --pairing-code"));
      qrcode.generate(qr, { small: true });
    }
  });


  malvin.ev.on("creds.update", saveCreds);

// =====================================
	 
  malvin.ev.on('messages.update', async updates => {
    for (const update of updates) {
      if (update.update.message === null) {
        console.log("Delete Detected:", JSON.stringify(update, null, 2));
        await AntiDelete(malvin, updates);
      }
    }
  });

// anti-call

malvin.ev.on('call', async (calls) => {
  try {
    if (config.ANTI_CALL !== 'true') return;

    for (const call of calls) {
      if (call.status !== 'offer') continue; // Only respond on call offer

      const id = call.id;
      const from = call.from;

      await malvin.rejectCall(id, from);
      await malvin.sendMessage(from, {
        text: config.REJECT_MSG || '*вυѕу ¢αℓℓ ℓαтєя*'
      });
      console.log(`Call rejected and message sent to ${from}`);
    }
  } catch (err) {
    console.error("Anti-call error:", err);
  }
});	
	
//=========WELCOME & GOODBYE =======
	
malvin.ev.on('presence.update', async (update) => {
    await PresenceControl(malvin, update);
});

// always Online 

malvin.ev.on("presence.update", (update) => PresenceControl(malvin, update));

	
BotActivityFilter(malvin);	
	
 /// READ STATUS       
  malvin.ev.on('messages.upsert', async(mek) => {
    mek = mek.messages[0]
    if (!mek.message) return
    mek.message = (getContentType(mek.message) === 'ephemeralMessage') 
    ? mek.message.ephemeralMessage.message 
    : mek.message;
    //console.log("New Message Detected:", JSON.stringify(mek, null, 2));
  if (config.READ_MESSAGE === 'true') {
    await malvin.readMessages([mek.key]);  // Mark message as read
    console.log(`Marked message from ${mek.key.remoteJid} as read.`);
  }
    if(mek.message.viewOnceMessageV2)
    mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
    if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_SEEN === "true"){
      await malvin.readMessages([mek.key])
    }

  const newsletterJids = [
        "120363401297349965@newsletter",
        "",
        "",
  ];
  const emojis = ["😂", "🥺", "👍", "☺️", "🥹", "♥️", "🩵"];

  if (mek.key && newsletterJids.includes(mek.key.remoteJid)) {
    try {
      const serverId = mek.newsletterServerId;
      if (serverId) {
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        await malvin.newsletterReactMessage(mek.key.remoteJid, serverId.toString(), emoji);
      }
    } catch (e) {
    
    }
  }	  
	  
  if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_REACT === "true"){
    const jawadlike = await malvin.decodeJid(malvin.user.id);
    const emojis =  ['❤️', '💸', '😇', '🍂', '💥', '💯', '🔥', '💫', '💎', '💗', '🤍', '🖤', '👀', '🙌', '🙆', '🚩', '🥰', '💐', '👏', '🤎', '✅', '🫀', '🧡', '😶', '🥹', '🌸', '🕊️', '🌷', '⛅', '🌟', '🥺', '🇵🇰', '💜', '💙', '🌝', '🖤', '💚'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    await malvin.sendMessage(mek.key.remoteJid, {
      react: {
        text: randomEmoji,
        key: mek.key,
      } 
    }, { statusJidList: [mek.key.participant, jawadlike] });
  }                       
  if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_REPLY === "true"){
  const user = mek.key.participant
  const text = `${config.AUTO_STATUS_MSG}`
  await malvin.sendMessage(user, { text: text, react: { text: '💜', key: mek.key } }, { quoted: mek })
            }
            await Promise.all([
              saveMessage(mek),
            ]);
  const m = sms(malvin, mek)
  const type = getContentType(mek.message)
  const content = JSON.stringify(mek.message)
  const from = mek.key.remoteJid
  const quoted = type == 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : []
  const body = (type === 'conversation') ? mek.message.conversation : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type == 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : (type == 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : ''
  const prefix = getPrefix();
  const isCmd = body.startsWith(prefix)
  var budy = typeof mek.text == 'string' ? mek.text : false;
  const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : ''
  const args = body.trim().split(/ +/).slice(1)
  const q = args.join(' ')
  const text = args.join(' ')
  const isGroup = from.endsWith('@g.us')
  const sender = mek.key.fromMe ? (malvin.user.id.split(':')[0]+'@s.whatsapp.net' || malvin.user.id) : (mek.key.participant || mek.key.remoteJid)
  const senderNumber = sender.split('@')[0]
  const botNumber = malvin.user.id.split(':')[0]
  const pushname = mek.pushName || 'Sin Nombre'
  const isMe = botNumber.includes(senderNumber)
  const isOwner = ownerNumber.includes(senderNumber) || isMe
  const botNumber2 = await jidNormalizedUser(malvin.user.id);
  const groupMetadata = isGroup ? await malvin.groupMetadata(from).catch(e => {}) : ''
  const groupName = isGroup ? groupMetadata.subject : ''
  const participants = isGroup ? await groupMetadata.participants : ''
  const groupAdmins = isGroup ? await getGroupAdmins(participants) : ''
  const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false
  const isAdmins = isGroup ? groupAdmins.includes(sender) : false
  const isReact = m.message.reactionMessage ? true : false
  const reply = (teks) => {
  malvin.sendMessage(from, { text: teks }, { quoted: mek })
  }
  
  const ownerNumbers = ["2349117525115"];
      const sudoUsers = JSON.parse(fsSync.readFileSync("./lib/sudo.json", "utf-8") || "[]");
      const devNumber = config.DEV ? String(config.DEV).replace(/[^0-9]/g, "") : null;
      const creatorJids = [
        ...ownerNumbers,
        ...(devNumber ? [devNumber] : []),
        ...sudoUsers,
      ].map((num) => num.replace(/[^0-9]/g, "") + "@s.whatsapp.net");
      const isCreator = creatorJids.in
