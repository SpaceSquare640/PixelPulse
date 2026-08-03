interface Props {
  lang: 'en' | 'zh'
}

const LAST_UPDATED = '2026-08-03'

function En() {
  return (
    <div className="help-content">
      <p className="help-content__meta">Last updated: {LAST_UPDATED}</p>

      <p>
        Practical things worth knowing before you start using PixelPulse — this is not a legal document; see the
        Disclaimer and Terms of Service tabs for that.
      </p>

      <h3>What PixelPulse actually does</h3>
      <p>
        It watches a region of your screen for an image or pixel colour you configured, and — when it finds a match
        — simulates a mouse click, a key press, typed text, or a multi-step macro. Everything runs locally on your
        own computer; nothing is uploaded anywhere.
      </p>

      <h3>Before you trust a new rule</h3>
      <ul>
        <li>
          <strong>Start with Dry Run on</strong> — it's the default for new rules. It logs matches without actually
          clicking or typing, so you can confirm detection is working before letting it act.
        </li>
        <li>
          Use <strong>Test Match</strong> in the rule editor to check a trigger fires correctly against the current
          screen.
        </li>
        <li>
          Crop template images tightly around just the target — a wider crop is more likely to false-match on
          similar-looking elements elsewhere.
        </li>
      </ul>

      <h3>Safety features you should know about</h3>
      <ul>
        <li><strong>Cooldown</strong> — minimum time between triggers for the same rule, so one match doesn't fire the action repeatedly.</li>
        <li><strong>Max triggers</strong> — an optional cap on how many times a rule is allowed to fire in one run.</li>
        <li>
          <strong>Kill switch</strong> — press <code>Ctrl+Alt+Q</code> at any time to stop the engine immediately,
          from anywhere, even if the GUI window doesn't have focus.
        </li>
      </ul>

      <h3>Things that can break detection</h3>
      <ul>
        <li>Changing screen resolution, display scaling (DPI), or moving/resizing the target window after a rule was created.</li>
        <li>The target application changing its UI (a new icon, a moved button, a theme update).</li>
        <li>Overlapping windows covering the region PixelPulse is watching.</li>
      </ul>
      <p>If a rule stops matching, re-pick the region/point rather than assuming something is broken.</p>

      <h3>Where your data lives</h3>
      <p>
        Rules are stored in <code>rules.json</code> and captured template images in <code>targets/</code>, both on
        your own disk, next to wherever you're running PixelPulse from. See the Privacy Policy tab for the full
        picture.
      </p>

      <h3>Getting more help</h3>
      <p>
        PixelPulse is maintained on GitHub at{' '}
        <a href="https://github.com/SpaceSquare640/PixelPulse" target="_blank" rel="noreferrer">
          github.com/SpaceSquare640/PixelPulse
        </a>
        . Open an issue there for anything not covered here.
      </p>
    </div>
  )
}

function Zh() {
  return (
    <div className="help-content">
      <p className="help-content__meta">最後更新：{LAST_UPDATED}</p>

      <p>開始使用 PixelPulse 之前，值得知道的實務注意事項 —— 這不是法律文件，法律相關內容請見「免責聲明」與「使用條款」分頁。</p>

      <h3>PixelPulse 實際上做什麼</h3>
      <p>
        它會持續監控你螢幕上的某個區域，尋找你設定的目標圖片或像素顏色 —— 一旦命中，就會模擬滑鼠點擊、按鍵、輸入
        文字，或一連串多步驟巨集。所有動作都在你自己的電腦上本機執行，不會有任何東西被上傳到任何地方。
      </p>

      <h3>在你信任一條新規則之前</h3>
      <ul>
        <li>
          <strong>先開著 Dry Run 測試</strong> —— 新規則預設就是這樣。它只會記錄命中結果，不會真的點擊或輸入，
          讓你能在真正放行之前確認辨識是否正確。
        </li>
        <li>在規則編輯器裡用 <strong>測試比對</strong> 確認觸發條件在目前畫面上真的能正確命中。</li>
        <li>樣板圖片要緊密裁切、只包含目標本身 —— 裁切範圍太大，比較容易在畫面其他長得像的元素上誤判命中。</li>
      </ul>

      <h3>你應該知道的安全機制</h3>
      <ul>
        <li><strong>冷卻時間</strong> —— 同一條規則兩次觸發之間的最短間隔，避免一次命中就連續觸發動作。</li>
        <li><strong>最多觸發次數</strong> —— 可選的上限，限制一次執行中某條規則最多能觸發幾次。</li>
        <li>
          <strong>緊急停止（Kill switch）</strong> —— 任何時候按下 <code>Ctrl+Alt+Q</code>，就能立即停止引擎，
          即使 GUI 視窗當下沒有焦點也一樣有效。
        </li>
      </ul>

      <h3>可能導致辨識失效的狀況</h3>
      <ul>
        <li>建立規則之後改變螢幕解析度、顯示器縮放（DPI），或搬動/調整目標視窗的大小。</li>
        <li>目標應用程式改版介面（圖示換了、按鈕位置變了、換了主題）。</li>
        <li>有其他視窗蓋住 PixelPulse 正在監控的區域。</li>
      </ul>
      <p>如果某條規則突然不再命中，優先考慮重新框選區域/點，而不是假設程式壞掉了。</p>

      <h3>你的資料存放在哪裡</h3>
      <p>
        規則存放在 <code>rules.json</code>，擷取到的樣板圖片存放在 <code>targets/</code>，兩者都在你自己的硬碟上，
        就在你執行 PixelPulse 的那個資料夾旁邊。完整說明請見「隱私權政策」分頁。
      </p>

      <h3>想找更多說明</h3>
      <p>
        PixelPulse 維護於 GitHub：{' '}
        <a href="https://github.com/SpaceSquare640/PixelPulse" target="_blank" rel="noreferrer">
          github.com/SpaceSquare640/PixelPulse
        </a>
        。這裡沒提到的問題，歡迎在該處開 issue 詢問。
      </p>
    </div>
  )
}

export function UserNoticeContent({ lang }: Props) {
  return lang === 'zh' ? <Zh /> : <En />
}
