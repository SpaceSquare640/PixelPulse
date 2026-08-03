interface Props {
  lang: 'en' | 'zh'
}

function En() {
  return (
    <div className="help-content">
      <h3>What is PixelPulse?</h3>
      <p>
        PixelPulse watches a region of your screen. When it sees a target image or a specific pixel colour, it
        automatically clicks, presses a key, types text, or runs a multi-step macro.
      </p>

      <h3>Connecting</h3>
      <p>
        The status bar at the top shows <strong>Connected</strong> once the GUI has a live connection to the Python
        engine running on your machine (<code>127.0.0.1:8765</code>). If it says <strong>Disconnected</strong>, make
        sure <code>python -m core.server</code> is running, then wait a moment — the app retries automatically.
      </p>

      <h3>Starting and stopping the engine</h3>
      <p>
        The <strong>Start</strong> / <strong>Stop</strong> button controls whether your rules are actively scanning.
        Stopping the engine doesn't delete anything — it just pauses all scanning. You can safely leave the engine
        stopped while you build and test new rules.
      </p>

      <h3>Creating a rule</h3>
      <p>Click <strong>New Rule</strong> to open the 3-step editor:</p>
      <ol>
        <li>
          <strong>Trigger</strong> — choose <em>Image (template)</em> to match a picture, <em>Pixel colour</em> to
          match a single point's colour, or <em>Pixel Map</em> for a target that moves and rotates (see below). For
          an image trigger, pick where the image comes from: <em>Select Region on
          Screen</em> (the whole desktop dims except the area you're selecting — drag a box and release, it's
          captured immediately) or <em>Browse for Image File</em> (choose an existing image from disk). A
          screen-cropped region can optionally check <strong>Scan the whole screen</strong> to match the target
          anywhere instead of only where it was captured; an uploaded file always scans the whole screen (there's no
          region to fall back to). Use <strong>Test Match</strong> to confirm it detects correctly on the current
          screen before moving on. For template triggers, avoid a completely flat/solid-colour crop (e.g. a plain
          button background with no icon or text) — with nothing to match against, detection can behave
          unpredictably.
        </li>
        <li>
          <strong>Action</strong> — click, double-click, press a key, type text, or build a <em>Macro</em> (see
          below).
        </li>
        <li>
          <strong>Safety</strong> — give the rule a name, an optional maximum trigger count, and whether it starts in
          dry-run. Then choose how it re-fires: a <strong>cooldown</strong> (minimum time between triggers), or
          <strong> Only trigger once until it disappears and reappears</strong> — for a rule that should fire the
          instant its target shows up, with nothing else to configure.
        </li>
      </ol>

      <h3>Dry-run mode</h3>
      <p>
        Every new rule starts with <strong>dry-run</strong> enabled: it logs matches in the Activity panel but never
        actually clicks or types anything. Watch it for a while, confirm it's detecting the right thing at the right
        time, then switch it off from the rule's checkbox in the rule list.
      </p>

      <h3>Macros (multi-step actions)</h3>
      <p>Pick "Macro (multi-step)" as the action to chain several steps together instead of one:</p>
      <ul>
        <li><strong>Click / Double-click</strong> — pick a target image; the macro re-locates it fresh each time it runs.</li>
        <li><strong>Wait for image</strong> — pause until a target image appears (e.g. wait for the next screen to load).</li>
        <li><strong>Press key / Type text</strong> — same as the single-step actions.</li>
      </ul>
      <p>
        Each step can have a delay before it runs, and steps that locate a target on screen have a timeout and retry
        count. If the target still isn't found, the macro stops by default (you'll see this reported in the Activity
        panel) rather than continuing blindly.
      </p>

      <h3>Pixel Map trigger (for targets that move and rotate)</h3>
      <p>
        Image matching only tolerates a target moving, not rotating — a target that spins or turns will stop matching
        the instant it no longer looks like the original capture. Pixel colour matching only checks a single fixed
        screen point, so it can't follow a moving target either. <strong>Pixel Map</strong> is built for targets that
        do both: it records a handful of key colours from the target and matches wherever several of them cluster
        together on screen, regardless of the target's current rotation.
      </p>
      <ul>
        <li>
          <strong>Auto-Detect Colours</strong> — select a region on screen and the app automatically picks out its
          most prominent colours.
        </li>
        <li>
          <strong>Pick Colours with Magnifier</strong> — opens the pixel magnifier tool (see below) so you can choose
          colours by hand.
        </li>
        <li>
          <strong>Minimum colours to match</strong> — how many of the key colours need to be found clustered together
          to count as a hit; lower this if the target is sometimes partially obscured.
        </li>
        <li>
          <strong>Cluster search radius</strong> — how close together the colours need to appear.
        </li>
      </ul>
      <p>
        Because it doesn't check the colours' relative layout, only that they're near each other, a Pixel Map trigger
        can have more false positives than an image trigger if the same colours happen to cluster elsewhere on
        screen — tune the tolerance, colour count, and minimum-matches if that happens. It always scans the whole
        screen.
      </p>

      <h3>Pixel magnifier</h3>
      <p>
        A standalone tool for inspecting screen colours: open it from <strong>Settings → Tools → Open Pixel
        Magnifier</strong>, or from the Pixel Map trigger's colour-picking step. Move your mouse anywhere on screen to
        see that point's RGB value live, click to add it to your list, then press <strong>Enter</strong> to finish (or
        <strong> Esc</strong> to cancel).
      </p>

      <h3>Managing your rules</h3>
      <ul>
        <li>Toggle the checkbox next to a rule's name to enable/disable it without deleting it.</li>
        <li>Click <strong>Edit</strong> to open the same 3-step editor pre-filled with the rule's current settings — change anything and save to update it in place.</li>
        <li>Drag a rule card by its handle (⠿) to reorder the list — rules are scanned in list order.</li>
        <li>Click <strong>Delete</strong> to remove a single rule immediately, or <strong>Delete All</strong> to clear every rule at once (this one asks for confirmation first, since it's harder to walk back). Neither can be undone from the app.</li>
        <li>
          <strong>Batch Upload</strong> — pick several image files at once to create one rule per image in a single
          step (template trigger, whole-screen scan, click action, dry-run). Each starts out named with a plain
          number ("1", "2", ...); rename any of them afterward with <strong>Edit</strong>.
        </li>
      </ul>

      <h3>Safety features</h3>
      <ul>
        <li>
          <strong>Emergency stop</strong> — press <code>Ctrl+Alt+Q</code> at any time to immediately stop the engine,
          no matter what it's doing.
        </li>
        <li><strong>Cooldown</strong> — stops a rule from firing repeatedly in a tight loop.</li>
        <li>
          <strong>Once per appearance</strong> — an alternative to cooldown: fires once when the target appears, then
          stays quiet until it disappears and reappears, instead of repeatedly firing on a timer while it's visible.
        </li>
        <li><strong>Max triggers</strong> — optionally caps how many times a rule can ever fire in one run.</li>
        <li>
          <strong>Closing the window</strong> doesn't quit the app — it minimizes to the system tray, and the engine
          keeps running. Use the tray icon's <em>Quit</em> to actually exit.
        </li>
      </ul>

      <h3>Updates</h3>
      <p>
        The installed app checks for a newer version on GitHub once per launch. If one's found, you'll see a
        confirmation dialog — nothing downloads or installs until you click <strong>Update Now</strong>. If the
        engine is running when an update is found, you'll be asked to stop it first rather than having it
        interrupted. Once confirmed, the update downloads, the app closes, reinstalls itself, and reopens
        automatically — your rules and captured images aren't touched.
      </p>

      <h3>Good habits</h3>
      <ul>
        <li>Keep your ROI (the region you select) as small as you can — smaller regions are scanned faster and cause fewer false matches.</li>
        <li>Use a distinctive crop for template images, not a blank/solid-colour area.</li>
        <li>Test a rule with dry-run before trusting it to click or type for real.</li>
        <li>Only automate things you're allowed to automate — see the Terms of Service tab.</li>
      </ul>
    </div>
  )
}

function Zh() {
  return (
    <div className="help-content">
      <h3>PixelPulse 是什麼？</h3>
      <p>
        PixelPulse 會持續監控你螢幕上的某個區域。當它看到指定的目標圖片、或某個座標出現特定顏色時，就會自動幫你點擊、
        按鍵、輸入文字，或執行一整串多步驟的巨集。
      </p>

      <h3>連線狀態</h3>
      <p>
        畫面最上方的狀態列會顯示 <strong>Connected</strong>，代表 GUI 已經跟你電腦上執行的 Python 引擎
        （<code>127.0.0.1:8765</code>）連上線了。如果顯示 <strong>Disconnected</strong>，請確認
        <code>python -m core.server</code> 有在執行，稍等一下就好 —— 應用程式會自動重新連線。
      </p>

      <h3>啟動與停止引擎</h3>
      <p>
        <strong>Start</strong> / <strong>Stop</strong> 按鈕控制你的規則是否正在實際掃描。停止引擎不會刪除任何東西，
        只是暫停所有掃描而已。你可以放心地在建立、測試新規則的時候讓引擎保持停止狀態。
      </p>

      <h3>建立規則</h3>
      <p>點擊 <strong>New Rule</strong> 開啟三步驟編輯器：</p>
      <ol>
        <li>
          <strong>Trigger（觸發條件）</strong> —— 選「Image (template)」比對圖片、選「Pixel colour」比對單一座標的
          顏色，或選「Pixel Map（像素圖）」給會移動又旋轉的目標用（見下方說明）。選圖片觸發時，先選圖片的來源：<em>Select Region on Screen</em>（整個桌面會變暗，只留下你正在選取的
          範圍；拖曳框選一塊區域後放開，會立即擷取）或 <em>Browse for Image File</em>（從硬碟選一張既有的圖片）。
          框選出來的區域可以另外勾選 <strong>Scan the whole screen</strong>，讓目標在螢幕任何地方出現都算命中，
          而不限於當初框選的那塊區域；上傳的圖片檔案則一律掃描整個螢幕（因為沒有對應的框選區域可以退回去用）。用
          <strong>Test Match</strong> 確認能在目前畫面正確偵測到，再繼續下一步。樣板圖片請避免選到完全單色、
          沒有任何圖案或文字的區域 —— 沒有東西可以比對，辨識結果可能會不穩定。
        </li>
        <li>
          <strong>Action（動作）</strong> —— 點擊、雙擊、按鍵、輸入文字，或建立一個 <em>Macro（巨集）</em>（見下方說明）。
        </li>
        <li>
          <strong>Safety（安全參數）</strong> —— 幫規則取個名字、設定可選的最多觸發次數，以及要不要一開始就是
          dry-run（僅記錄不執行）。接著選擇規則要怎麼重新觸發：<strong>冷卻時間</strong>（兩次觸發之間至少間隔
          多久），或 <strong>Only trigger once until it disappears and reappears</strong>（只在目標出現時觸發一次，
          直到它消失後重新出現才會再觸發）—— 給那種「目標一出現就要立刻反應、不需要另外設定」的規則用。
        </li>
      </ol>

      <h3>Dry-run（僅記錄不執行）模式</h3>
      <p>
        每條新規則預設都是 <strong>dry-run</strong>：只會在活動紀錄裡顯示命中結果，不會真的點擊或輸入任何東西。
        先觀察一段時間，確認辨識的時機、位置都正確，再到規則清單把該規則的開關切成正式執行。
      </p>

      <h3>巨集（多步驟動作）</h3>
      <p>動作選「Macro (multi-step)」可以把好幾個步驟串在一起，取代單一動作：</p>
      <ul>
        <li><strong>Click / Double-click</strong> —— 框選一張目標圖片；巨集每次執行時都會重新找出它目前的位置。</li>
        <li><strong>Wait for image</strong> —— 等到某張目標圖片出現才繼續（例如等下一個畫面載入完成）。</li>
        <li><strong>Press key / Type text</strong> —— 跟單步驟動作一樣。</li>
      </ul>
      <p>
        每個步驟都可以設定執行前的延遲；需要在畫面上找目標的步驟另外有逾時時間與重試次數。如果重試完還是找不到，
        巨集預設會直接中止（你會在活動紀錄裡看到這個結果），而不是盲目繼續執行下去。
      </p>

      <h3>像素圖（Pixel Map）觸發條件——給會移動又旋轉的目標用</h3>
      <p>
        圖片比對只耐得住目標移動位置，耐不住旋轉——目標一轉角度，跟截圖不像了就比對失敗。像素顏色比對只檢查
        螢幕上單一固定座標，同樣沒辦法跟著移動的目標跑。<strong>像素圖</strong> 就是為了「又會移動、又會旋轉」的
        目標而設計：記錄目標身上幾個關鍵顏色，偵測時只要這些顏色在畫面上某處群聚在一起就算命中，不管目標現在轉到
        哪個角度。
      </p>
      <ul>
        <li>
          <strong>自動偵測顏色</strong> —— 在螢幕上框選一個區域，應用程式會自動抓出裡面最主要的幾個顏色。
        </li>
        <li>
          <strong>使用放大鏡挑選顏色</strong> —— 開啟像素放大鏡工具（見下方說明），自己手動挑顏色。
        </li>
        <li>
          <strong>至少要命中幾個顏色</strong> —— 需要有幾個關鍵顏色群聚在一起才算命中；如果目標常常被部分遮擋，
          可以調低這個數字。
        </li>
        <li>
          <strong>群聚搜尋半徑</strong> —— 這些顏色要多靠近才算「群聚在一起」。
        </li>
      </ul>
      <p>
        因為不檢查顏色之間的相對排列，只看它們是否彼此靠近，像素圖規則的誤判機率可能會比圖片比對高一些——如果畫面
        上剛好有別的地方也有相同顏色群聚，就可能誤判。遇到這種情況可以調整容許誤差、顏色數量、或最低命中數。
        像素圖一律掃描整個螢幕。
      </p>

      <h3>像素放大鏡</h3>
      <p>
        一個獨立的螢幕顏色檢視工具：可以從 <strong>設定 → 工具 → 開啟像素放大鏡</strong> 開啟，或是在「像素圖」
        觸發條件的挑色步驟裡開啟。把滑鼠移到螢幕任何地方，就能即時看到該處的 RGB 值，點擊即可把它加進清單，最後
        按 <strong>Enter</strong> 完成（按 <strong>Esc</strong> 取消）。
      </p>

      <h3>管理你的規則</h3>
      <ul>
        <li>點擊規則名稱旁邊的核取方塊，可以在不刪除的情況下啟用/停用該規則。</li>
        <li>點擊 <strong>編輯</strong> 會開啟跟新增規則一樣的三步驟編輯器，並預先帶入這條規則目前的設定 —— 改完存檔就會原地更新。</li>
        <li>拖曳規則卡片左側的把手（⠿）可以調整順序 —— 規則會依照清單順序依序掃描。</li>
        <li>點擊 <strong>刪除</strong> 會立即永久刪除單一規則；點擊 <strong>刪除全部</strong> 會一次清空所有規則（這個會先跳出確認，因為影響範圍較大、比較難挽回）。兩者在應用程式裡都無法復原。</li>
        <li>
          <strong>批量上傳</strong> —— 一次選取好幾張圖片檔案，一步就能為每張圖片各自建立一條規則（樣板觸發、
          全螢幕掃描、點擊動作、dry-run）。每條規則預設用單純的數字命名（「1」、「2」...）；之後隨時可以用
          <strong>編輯</strong> 幫任何一條改名。
        </li>
      </ul>

      <h3>安全機制</h3>
      <ul>
        <li>
          <strong>緊急停止</strong> —— 任何時候按下 <code>Ctrl+Alt+Q</code>，都能立即讓引擎停止，不管它正在做什麼。
        </li>
        <li><strong>冷卻時間</strong> —— 避免同一條規則在短時間內反覆觸發。</li>
        <li>
          <strong>每次出現觸發一次</strong> —— 冷卻時間以外的另一種選擇：目標出現時觸發一次，之後保持沉默，直到它
          消失後重新出現才會再觸發，而不是它持續可見時每隔固定時間就重複觸發。
        </li>
        <li><strong>最多觸發次數</strong> —— 可選擇限制一條規則在單次執行期間最多能觸發幾次。</li>
        <li>
          <strong>關閉視窗</strong>不會結束程式 —— 只會縮到系統匣，引擎會繼續在背景執行。要真的離開，請用系統匣選單裡
          的 <em>Quit</em>。
        </li>
      </ul>

      <h3>更新機制</h3>
      <p>
        安裝好的 App 每次啟動都會檢查一次 GitHub 上有沒有新版本。發現新版本時會跳出確認對話框 —— 在你按下
        <strong>Update Now</strong> 之前，不會下載或安裝任何東西。如果發現新版本時引擎正在執行，會請你先手動停止，
        而不是強行中斷它。確認之後，更新會自動下載、程式會關閉、重新安裝，並自動重新開啟 —— 你的規則與擷取到的
        圖片不會受到影響。
      </p>

      <h3>建議的使用習慣</h3>
      <ul>
        <li>把 ROI（你框選的範圍）盡量縮小 —— 範圍越小，掃描越快，也越不容易誤判。</li>
        <li>樣板圖片要選有明顯特徵的區域，不要選空白或單一顏色的地方。</li>
        <li>正式讓規則點擊/輸入之前，先用 dry-run 測試過一遍。</li>
        <li>只自動化你被允許自動化的事情 —— 詳見「使用條款」分頁。</li>
      </ul>
    </div>
  )
}

export function UserManualContent({ lang }: Props) {
  return lang === 'zh' ? <Zh /> : <En />
}
