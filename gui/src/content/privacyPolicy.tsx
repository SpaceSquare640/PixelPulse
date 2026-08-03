interface Props {
  lang: 'en' | 'zh'
}

const LAST_UPDATED = '2026-08-03'

function En() {
  return (
    <div className="help-content">
      <p className="help-content__meta">Last updated: {LAST_UPDATED}</p>

      <p>
        <strong>Short version: PixelPulse does not collect, transmit, or store any of your data anywhere outside your
        own computer.</strong> The details below explain exactly why.
      </p>

      <h3>How PixelPulse is built</h3>
      <p>
        PixelPulse has two parts that run on your machine: a Python engine that captures the screen and simulates
        input, and this Electron/React window. They talk to each other over a WebSocket that, by default, only binds
        to <code>127.0.0.1</code> (your own computer's loopback address) — it is never exposed to your local network
        or the internet unless you deliberately reconfigure it with an advanced command-line flag.
      </p>

      <h3>Screen captures and images</h3>
      <p>
        When you select a region or a point on screen, the captured image is saved as a file inside your own{' '}
        <code>targets/</code> folder, on your own disk. It is never uploaded, emailed, or sent to any server —
        there isn't one to send it to. You can open, inspect, or delete these files yourself at any time.
      </p>

      <h3>Rules and settings</h3>
      <p>
        Your rules (what to watch for, and what to do about it) are stored in a plain <code>rules.json</code> file on
        your own disk, in whatever folder you chose to run PixelPulse from. Nothing about your rules is sent
        anywhere.
      </p>

      <h3>No telemetry, analytics, or tracking</h3>
      <p>
        PixelPulse does not include any analytics SDK, crash reporter, telemetry, or third-party tracking code. It
        does not know how you use it, and neither do we.
      </p>

      <h3>No accounts, no ads</h3>
      <p>There's no sign-up, no login, and no advertising anywhere in the Software.</p>

      <h3>Third-party services you point PixelPulse at</h3>
      <p>
        PixelPulse automates actions against whatever is on your screen — that might be a game, a website, or another
        application. This Privacy Policy covers PixelPulse itself; it has no bearing on the privacy practices of
        whatever software or service you're interacting with when PixelPulse clicks or types on your behalf.
      </p>

      <h3>Children's privacy</h3>
      <p>PixelPulse doesn't knowingly collect personal information from anyone, of any age, because it doesn't collect personal information at all.</p>

      <h3>Changes to this policy</h3>
      <p>
        If this policy ever changes — for example, if a future version adds an optional, clearly-disclosed feature
        that does send data somewhere — the current version will always live with the Software's source and
        documentation on GitHub.
      </p>

      <h3>Questions</h3>
      <p>
        PixelPulse is maintained on GitHub at{' '}
        <a href="https://github.com/SpaceSquare640/PixelPulse" target="_blank" rel="noreferrer">
          github.com/SpaceSquare640/PixelPulse
        </a>
        . Open an issue there for questions about this policy.
      </p>
    </div>
  )
}

function Zh() {
  return (
    <div className="help-content">
      <p className="help-content__meta">最後更新：{LAST_UPDATED}</p>

      <p>
        <strong>簡短版本：PixelPulse 不會把你的任何資料蒐集、傳送、或儲存到你自己的電腦以外的任何地方。</strong>
        以下說明為什麼是這樣。
      </p>

      <h3>PixelPulse 是怎麼運作的</h3>
      <p>
        PixelPulse 在你的電腦上執行兩個部分：一個負責擷取螢幕、模擬輸入的 Python 引擎，以及這個 Electron/React 視窗。
        兩者透過 WebSocket 溝通，預設只會綁定在 <code>127.0.0.1</code>（你自己電腦的迴環位址）—— 除非你自己刻意用
        進階的命令列參數重新設定，否則永遠不會對外開放到你的區域網路或網際網路。
      </p>

      <h3>螢幕截圖與圖片</h3>
      <p>
        當你在螢幕上框選一塊區域或一個點時，擷取到的圖片會存成檔案，放在你自己電腦裡的 <code>targets/</code> 資料夾裡。
        這些圖片永遠不會被上傳、寄出，或傳送到任何伺服器 —— 因為根本沒有這樣的伺服器存在。你隨時都可以自己開啟、
        檢視、或刪除這些檔案。
      </p>

      <h3>規則與設定</h3>
      <p>
        你的規則（要監控什麼、命中後要做什麼）會以純文字的 <code>rules.json</code> 檔案，存放在你執行 PixelPulse
        所在的那個資料夾裡，一樣在你自己的電腦上。你的規則內容不會被傳送到任何地方。
      </p>

      <h3>沒有遙測、分析或追蹤</h3>
      <p>
        PixelPulse 沒有內建任何分析 SDK、當機回報、遙測，或第三方追蹤程式碼。它不知道你怎麼使用它，我們也不知道。
      </p>

      <h3>沒有帳號、沒有廣告</h3>
      <p>本軟體裡沒有註冊、沒有登入，也完全沒有任何廣告。</p>

      <h3>你讓 PixelPulse 操作的第三方服務</h3>
      <p>
        PixelPulse 會針對你螢幕上顯示的內容執行自動化動作 —— 那可能是遊戲、網站，或其他應用程式。這份隱私權政策
        涵蓋的是 PixelPulse 本身；它不涉及、也無法規範你讓 PixelPulse 代為點擊或輸入的那個軟體或服務本身的隱私權
        做法。
      </p>

      <h3>兒童隱私</h3>
      <p>PixelPulse 不會刻意蒐集任何年齡層使用者的個人資料，因為它本來就完全不蒐集個人資料。</p>

      <h3>政策異動</h3>
      <p>
        如果這份政策未來有變動 —— 例如日後版本新增了某個會明確告知、且會傳送資料出去的可選功能 —— 最新版本一律
        會隨本軟體的原始碼與文件一起放在 GitHub 上。
      </p>

      <h3>有問題怎麼辦</h3>
      <p>
        PixelPulse 維護於 GitHub：{' '}
        <a href="https://github.com/SpaceSquare640/PixelPulse" target="_blank" rel="noreferrer">
          github.com/SpaceSquare640/PixelPulse
        </a>
        。對這份政策有任何問題，歡迎在該處開 issue 詢問。
      </p>
    </div>
  )
}

export function PrivacyPolicyContent({ lang }: Props) {
  return lang === 'zh' ? <Zh /> : <En />
}
