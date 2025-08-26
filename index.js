import { getContext } from "../../../extensions.js";

const extensionName = "sillytavern-extension-imgbackup";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

async function downloadImage(url, savePath) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    const blob = await response.blob();

    // Convert blob → ArrayBuffer → Base64
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Save through ST backend API
    const res = await fetch("/api/filesystem/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: savePath, base64 })
    });

    if (!res.ok) throw new Error("Filesystem save failed");
    console.log(`Saved: ${savePath}`);
    return true;
  } catch (err) {
    console.error("Image download failed:", url, err);
    return false;
  }
}

function extractMarkdownLinks(text) {
  const regex = /\!\[[^\]]*\]\((.*?)\)|\[[^\]]*\]\((.*?)\)/g;
  let match;
  const urls = [];
  while ((match = regex.exec(text)) !== null) {
    const url = match[1] || match[2];
    if (url && url.startsWith("http")) urls.push(url);
  }
  return urls;
}

async function processCharacter(character) {
  const name = character.name || "Unknown";
  const folder = `data/default-user/user/images/${name}`;

  const firstMessages = character.data?.first_mes || [];
  const allMessages = Array.isArray(firstMessages) ? firstMessages : [firstMessages];

  const foundLinks = allMessages.flatMap(mes => extractMarkdownLinks(mes));
  console.log(`[${name}] Found links:`, foundLinks);

  for (const url of foundLinks) {
    const filename = url.split("/").pop().split("?")[0];
    const savePath = `${folder}/${filename}`;
    await downloadImage(url, savePath);
  }
}

async function runBackup() {
  const { characters } = getContext();
  $("#imgbackup-status").text("Status: Running...");

  for (const char of characters) {
    await processCharacter(char);
  }

  $("#imgbackup-status").text("Status: Done!");
}

jQuery(async () => {
  const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
  $("#extensions_settings").append(settingsHtml);

  $("#imgbackup-run").on("click", runBackup);
});
