interface Props {
  lang: 'en' | 'zh'
}

const LAST_UPDATED = '2026-08-03'

function En() {
  return (
    <div className="help-content">
      <p className="help-content__meta">Last updated: {LAST_UPDATED}</p>

      <p>
        <strong>PixelPulse is provided "as is," without warranty of any kind.</strong> See the full legal text in the
        project's <code>LICENSE</code> file (MIT License). This page restates the key risk points in plain language.
      </p>

      <h3>No warranty</h3>
      <p>
        PixelPulse is free, open-source software, provided without warranty of any kind, express or implied —
        including but not limited to warranties of merchantability, fitness for a particular purpose, and
        non-infringement. The maintainers and contributors are not liable for any claim, damages, or other liability
        arising from its use.
      </p>

      <h3>Automation carries real risk</h3>
      <p>
        PixelPulse works by matching an image or pixel colour on your screen and then simulating real mouse/keyboard
        input. Screen detection is not perfect — lighting, resolution, DPI scaling, window position, or a UI update
        in the target application can all cause a false match or a missed one. Always test a new rule with{' '}
        <strong>Dry Run</strong> enabled, and supervise the Software the first few times a rule runs unattended.
      </p>

      <h3>Automating a third-party service is at your own risk</h3>
      <p>
        Many games, websites, and online services explicitly prohibit automation, macros, or bots in their own terms
        of service. If you point PixelPulse at such a service:
      </p>
      <ul>
        <li>You are solely responsible for checking whether doing so is allowed.</li>
        <li>
          Any consequence — including account suspension, a ban, or loss of access — is between you and that
          third-party service.
        </li>
        <li>
          The PixelPulse project has no relationship with, and no control over, how any third-party service enforces
          its own rules.
        </li>
      </ul>

      <h3>Not for bypassing security controls or unlawful use</h3>
      <p>
        Do not use PixelPulse to bypass CAPTCHAs, anti-bot, anti-fraud, or other security/access-control systems
        without the authorization of the system's owner, or for any unlawful purpose.
      </p>

      <h3>Your responsibility</h3>
      <p>
        You are responsible for how you configure and use PixelPulse, for verifying its behaviour before letting it
        run unattended, and for complying with all applicable laws and third-party terms.
      </p>

      <h3>Questions</h3>
      <p>
        PixelPulse is maintained on GitHub at{' '}
        <a href="https://github.com/SpaceSquare640/PixelPulse" target="_blank" rel="noreferrer">
          github.com/SpaceSquare640/PixelPulse
        </a>
        . Open an issue there for questions about this disclaimer.
      </p>
    </div>
  )
}

function Zh() {
  return (
    <div className="help-content">
      <p className="help-content__meta">最後更新：{LAST_UPDATED}</p>

      <p>
        <strong>PixelPulse 按「現狀」提供，不附帶任何形式的保證。</strong>完整法律文字請見專案的{' '}
        <code>LICENSE</code> 檔案（MIT License）。本頁用白話文重述其中的關鍵風險提醒。
      </p>

      <h3>不附帶任何保證</h3>
      <p>
        PixelPulse 是免費的開源軟體，不附帶任何明示或默示的保證，包括但不限於適售性、特定用途適用性、不侵權等保證。
        維護者與貢獻者對於因使用本軟體所產生的任何請求、損害，或其他責任，一概不負責任。
      </p>

      <h3>自動化本身就有風險</h3>
      <p>
        PixelPulse 的運作方式是比對螢幕上的圖片或像素顏色，然後模擬真實的滑鼠/鍵盤輸入。螢幕辨識不會百分之百準確
        —— 光線、解析度、DPI 縮放、視窗位置，或目標應用程式的介面更新，都可能造成誤判命中或漏判。請務必先在啟用
        <strong>Dry Run</strong> 的情況下測試新規則，並在規則剛開始無人看管執行的前幾次親自監督。
      </p>

      <h3>把本軟體用在第三方服務上，風險自負</h3>
      <p>許多遊戲、網站、線上服務都在自己的使用條款裡明文禁止自動化、巨集，或機器人程式。如果你把 PixelPulse 用在這類服務上：</p>
      <ul>
        <li>你必須自行負責確認這麼做是否被允許。</li>
        <li>任何後果 —— 包括帳號被停權、封鎖，或喪失存取權限 —— 都是你與該第三方服務之間的事。</li>
        <li>PixelPulse 專案跟任何第三方服務都沒有關係，也無法控制對方如何執行自己的規則。</li>
      </ul>

      <h3>不得用於繞過安全機制或不法用途</h3>
      <p>
        不得使用 PixelPulse 在未經系統擁有者授權的情況下繞過驗證碼（CAPTCHA）、反機器人、反詐欺，或其他安全性/
        存取控制機制，也不得將本軟體用於任何不法目的。
      </p>

      <h3>你的責任</h3>
      <p>你要自己負責如何設定與使用 PixelPulse，在讓它無人看管執行之前驗證其行為，並遵守所有適用法律及第三方條款。</p>

      <h3>有問題怎麼辦</h3>
      <p>
        PixelPulse 維護於 GitHub：{' '}
        <a href="https://github.com/SpaceSquare640/PixelPulse" target="_blank" rel="noreferrer">
          github.com/SpaceSquare640/PixelPulse
        </a>
        。對本免責聲明有任何問題，歡迎在該處開 issue 詢問。
      </p>
    </div>
  )
}

export function DisclaimerContent({ lang }: Props) {
  return lang === 'zh' ? <Zh /> : <En />
}
