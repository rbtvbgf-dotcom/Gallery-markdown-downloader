const extensionName = "sillytavern-extension-imgbackup";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

async function getExistingFiles(charName) {
  try {
    const res = await fetch(`/api/files/list?path=images/${encodeURIComponent(charName)}`);
    if (!res.ok) throw new Error(await res.text());
    const files = await res.json();
    return files.map(f => f.toLowerCase());
  } catch (err) {
    console.error(`[${charName}] Failed to list files`, err);
    return [];
  }
}

async function uploadImage(fileBlob, filename, charName) {
  const formData = new FormData();
  formData.append("file", fileBlob, filename);
  formData.append("path", `images/${charName}`);

  try {
    const res = await fetch("/api/files/upload", {
      method: "POST",
      body: formData
    });
    if (!res.ok) throw new Error(await res.text());
    console.log(`✔ Saved ${filename} → ${charName}`);
    return true;
  } catch (err) {
    console.error("Upload failed:", filename, err);
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
  const firstMessages = character.data?.first_mes || [];
  const allMessages = Array.isArray(firstMessages) ? firstMessages : [firstMessages];

  const foundLinks = allMessages.flatMap(mes => extractMarkdownLinks(mes));
  console.log(`[${name}] Found links:`, foundLinks);

  const existingFiles = await getExistingFiles(name);

  for (const url of foundLinks) {
    try {
      const filename = url.split("/").pop().split("?")[0] || "image.png";
      if (existingFiles.includes(filename.toLowerCase())) {
        console.log(`[${name}] Skipping duplicate: ${filename}`);
        continue;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed: " + url);
      const blob = await response.blob();

      await uploadImage(blob, filename, name);
    } catch (err) {
      console.error(`[${name}] Failed to fetch ${url}`, err);
    }
  }
}

async function runBackup() {
  const { characters } = getContext();
  const selectedNames = $("#imgbackup-charlist").val() || [];

  if (selectedNames.length === 0) {
    $("#imgbackup-status").text("Status: No characters selected.");
    return;
  }

  $("#imgbackup-status").text("Status: Running...");

  for (const char of characters) {
    if (selectedNames.includes(char.name)) {
      await processCharacter(char);
    }
  }

  $("#imgbackup-status").text("Status: Done!");
}

function populateCharacterList() {
  const { characters } = getContext();
  const $list = $("#imgbackup-charlist");
  $list.empty();

  for (const char of characters) {
    $list.append(`<option value="${char.name}">${char.name}</option>`);
  }
}

jQuery(async () => {
  const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
  $("#extensions_settings").append(settingsHtml);

  populateCharacterList();

  $("#imgbackup-run").on("click", runBackup);
});

