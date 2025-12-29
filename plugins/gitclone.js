

const { malvin } = require("../malvin");
const fetch = require("node-fetch");

malvin({
  pattern: 'gitclone',
  alias: ["git"],
  desc: "Download GitHub repository as a zip file.",
  react: '📦',
  category: "download",
  filename: __filename
}, async (malvin, m, store, { from, args, reply }) => {
  if (!args[0]) {
    return reply(
      "❌ *GitHub link missing!*\n\n" +
      "Usage example:\n" +
      "`.gitclone https://github.com/username/repository`\n"
    );
  }

  if (!/^(https?:\/\/)?github\.com\/.+/.test(args[0])) {
    return reply("⚠️ *Invalid GitHub URL!*\nPlease provide a valid GitHub repository link.");
  }

  try {
    // Extract username and repo from URL
    const regex = /github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?/i;
    const match = args[0].match(regex);

    if (!match) throw new Error("Invalid GitHub URL format.");

    const [, username, repo] = match;
    const zipUrl = `https://api.github.com/repos/${username}/${repo}/zipball`;

    // Check if repo exists by HEAD request
    const headResp = await fetch(zipUrl, { method: "HEAD" });
    if (!headResp.ok) throw new Error("Repository not found or inaccessible.");

    // Extract filename from headers or fallback
    const contentDisp = headResp.headers.get("content-disposition") || "";
    const fileNameMatch = contentDisp.match(/filename="?(.+)"?/);
    const fileName = fileNameMatch ? fileNameMatch[1] : `${repo}.zip`;

    // Stylish info message before sending
    await reply(
  `📥 *Downloading Repository...*\n\n` +
  `╭──〔 📂 ʀᴇᴘᴏ ᴅᴏᴡɴʟᴏᴀᴅ 〕──\n` +
  `│\n` +
  `├─ 📑 ʀᴇᴘᴏsɪᴛᴏʀʏ: ${username}/${repo}\n` +
  `├─ 📄 ғɪʟᴇ: ${fileName}\n` +
  `│\n` +
  `╰──────────────\n` +
  `> ᴍᴀᴅᴇ ʙʏ KC`
);

    // Send the zip file document with some custom contextInfo flair
    await malvin.sendMessage(from, {
      document: { url: zipUrl },
      fileName,
      mimetype: 'application/zip',
      contextInfo: {
        mentionedJid: [m.sender],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '0029Vb7Ew0t8fewhGUdO1J0s@newsletter',
          newsletterName: 'ⱽᴼᴿᵀᴱˣ ˢ²',
          serverMessageId: 143
        }
      }
    }, { quoted: m });

  } catch (error) {
    console.error("GitClone error:", error);
    reply(`❌ *Download failed!*\n${error.message || "Please try again later."}`);
  }
});
