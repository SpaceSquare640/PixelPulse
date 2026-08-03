// Checks GitHub Releases for a newer version once per launch, and -- only
// after the user explicitly confirms -- downloads the new installer, quits,
// and runs it silently. This is *not* an in-place/overwrite update: the
// NSIS installer we already ship (see gui/package.json's "nsis" config)
// detects the existing install at the same location and uninstalls it
// before laying down the new version's files, exactly like a clean
// reinstall, without us having to delete anything ourselves.
//
// 每次啟動檢查一次 GitHub Releases 有沒有新版本，只有在使用者明確確認之後，
// 才會下載新安裝檔、結束程式、靜默執行它。這**不是**原地覆蓋式更新：我們已經
// 在用的 NSIS 安裝檔（見 gui/package.json 的 "nsis" 設定）本身就會偵測到
// 同一個路徑已經裝過舊版，並在放入新版檔案之前先解除安裝舊版 —— 效果就像
// 乾淨重裝，不需要我們自己手動刪除任何檔案。

import { app, dialog } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = "SpaceSquare640/PixelPulse";
const HEALTH_URL = "http://127.0.0.1:8765/health";

function parseVersion(raw) {
  // "v0.9.0" or "0.9.0" -> [0, 9, 0]. Returns null if it doesn't look like
  // a plain X.Y.Z version (pre-release tags, malformed input, etc.) --
  // callers should treat null as "can't compare, skip".
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(raw.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isNewer(latest, current) {
  for (let i = 0; i < 3; i++) {
    if (latest[i] !== current[i]) return latest[i] > current[i];
  }
  return false;
}

async function fetchLatestRelease() {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  return response.json();
}

async function isEngineRunning() {
  try {
    const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data.running);
  } catch {
    // Server not up yet / not reachable -- treat as "not running" rather
    // than blocking the update on a transient startup timing issue.
    // 伺服器還沒啟動/連不到 -- 當作「沒在執行」處理，而不是因為啟動時序上的
    // 暫時性問題就擋住更新。
    return false;
  }
}

async function downloadInstaller(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

export async function checkForUpdates() {
  if (!app.isPackaged) return;

  const current = parseVersion(app.getVersion());
  if (!current) return;

  let release;
  try {
    release = await fetchLatestRelease();
  } catch (err) {
    console.error("Update check failed:", err);
    return;
  }

  const latest = parseVersion(release.tag_name ?? "");
  if (!latest || !isNewer(latest, current)) return;

  const asset = (release.assets ?? []).find((a) => a.name.endsWith("-windows.exe"));
  if (!asset) {
    console.error(`Update check: release ${release.tag_name} has no Windows installer asset.`);
    return;
  }

  const versionLabel = release.tag_name;
  console.log(`Update available: ${versionLabel} (running ${app.getVersion()}), asset ${asset.name}`);

  if (await isEngineRunning()) {
    await dialog.showMessageBox({
      type: "info",
      title: "Update available",
      message: `PixelPulse ${versionLabel} is available.`,
      detail:
        "The engine is currently running, so this update can't install right now. Stop the engine from the Rules page, then restart PixelPulse to be prompted again.",
      buttons: ["OK"],
    });
    return;
  }

  const { response } = await dialog.showMessageBox({
    type: "info",
    title: "Update available",
    message: `PixelPulse ${versionLabel} is available. You're running ${app.getVersion()}.`,
    detail: "Updating will close PixelPulse, install the new version, and reopen it automatically.",
    buttons: ["Update Now", "Later"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return;

  const installerPath = path.join(app.getPath("temp"), asset.name);
  try {
    await downloadInstaller(asset.browser_download_url, installerPath);
  } catch (err) {
    console.error("Update download failed:", err);
    await dialog.showMessageBox({
      type: "error",
      title: "Update failed",
      message: "Couldn't download the update. Please try again later.",
      buttons: ["OK"],
    });
    return;
  }

  // /S = silent NSIS install, no wizard -- the user already confirmed above.
  // detached + unref so the installer survives after this process exits.
  spawn(installerPath, ["/S"], { detached: true, stdio: "ignore" }).unref();
  app.quit();
}
