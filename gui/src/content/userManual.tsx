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
          <strong>Trigger</strong> — choose <em>Image (template)</em> to match a picture, or <em>Pixel colour</em> to
          match a single point's colour. For an image trigger, pick where the image comes from: <em>Select Region on
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

      <h3>Managing your rules</h3>
      <ul>
        <li>Toggle the checkbox next to a rule's name to enable/disable it without deleting it.</li>
        <li>Click <strong>Edit</strong> to open the same 3-step editor pre-filled with the rule's current settings — change anything and save to update it in place.</li>
        <li>Drag a rule card by its handle (⠿) to reorder the list — rules are scanned in list order.</li>
        <li>Click <strong>Delete</strong> to remove a single rule immediately, or <strong>Delete All</strong> to clear every rule at once (this one asks for confirmation first, since it's harder to walk back). Neither can be undone from the app.</li>
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
          <strong>Trigger（觸發條件）</strong> —— 選「Image (template)」比對圖片，或選「Pixel colour」比對單一座標的
          顏色。選圖片觸發時，先選圖片的來源：<em>Select Region on Screen</em>（整個桌面會變暗，只留下你正在選取的
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

      <h3>管理你的規則</h3>
      <ul>
        <li>點擊規則名稱旁邊的核取方塊，可以在不刪除的情況下啟用/停用該規則。</li>
        <li>點擊 <strong>編輯</strong> 會開啟跟新增規則一樣的三步驟編輯器，並預先帶入這條規則目前的設定 —— 改完存檔就會原地更新。</li>
        <li>拖曳規則卡片左側的把手（⠿）可以調整順序 —— 規則會依照清單順序依序掃描。</li>
        <li>點擊 <strong>刪除</strong> 會立即永久刪除單一規則；點擊 <strong>刪除全部</strong> 會一次清空所有規則（這個會先跳出確認，因為影響範圍較大、比較難挽回）。兩者在應用程式裡都無法復原。</li>
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
