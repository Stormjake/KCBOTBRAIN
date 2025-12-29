
const config = require('../settings');
const { malvin } = require('../malvin');
const { runtime } = require('../lib/functions');

const more = String.fromCharCode(8206);
const readMore = more.repeat(100); // Compact expandable section

malvin({
    pattern: "support",
    alias: ["follow", "links"],
    desc: "Display support and follow links for KC",
    category: "main",
    react: "📡",
    filename: __filename
}, 
async (malvin, mek, m, {
    from, reply, pushname
}) => {
    try {
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const uptimeFormatted = runtime(process.uptime());

        const message = `
✨ *ᴄᴏɴɴᴇᴄᴛ ᴡɪᴛʜ KC* ${readMore}
🎥 *ʏᴏᴜᴛᴜʙᴇ ᴄʜᴀɴɴᴇʟ*  
🔗 https://www.youtube.com/@badJoker-g2q

📞 *ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴠᴇʟᴏᴘᴇʀ*  
🔗 wa.me/2349117525115?text=Hi%20mx,%20I%20need%20support!
> *ᴍᴀᴅᴇ ʙʏ KC*  
  

        `.trim();

        await malvin.sendMessage(from, {
            image: { url: 'https://i.ibb.co/Q7Lv5JBk/zenitsu-agatsuma-3840x2160-24472.png' },
            caption: message,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '0029Vb7Ew0t8fewhGUdO1J0s@newsletter',
                    newsletterName: 'mxgamecoder',
                    serverMessageId: 143
                }
            }
        }, { quoted: mek });

    } catch (e) {
        console.error("Support Cmd Error:", e);
        reply(`⚠️ Error: ${e.message}`);
    }
});