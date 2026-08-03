interface Props {
  lang: 'en' | 'zh'
}

const LAST_UPDATED = '2026-08-03'

function En() {
  return (
    <div className="help-content">
      <p className="help-content__meta">Last updated: {LAST_UPDATED}</p>

      <p>
        These Terms govern your use of PixelPulse (the "Software"), an open-source screen-automation tool. By
        downloading, installing, or running the Software, you agree to these Terms. If you don't agree, don't use it.
      </p>

      <h3>1. What the Software does</h3>
      <p>
        PixelPulse watches a region of your screen for a target image or pixel colour, and — when configured to do so
        — automatically performs mouse clicks, keyboard input, or a sequence of such actions ("macros") on your own
        computer. It runs entirely on your machine; it does not act on any other person's device.
      </p>

      <h3>2. Open source, "as is"</h3>
      <p>
        PixelPulse is provided free of charge, without warranty of any kind, express or implied, including but not
        limited to warranties of merchantability, fitness for a particular purpose, and non-infringement. Screen
        detection can be imprecise, and automated input can trigger actions you didn't intend. You are responsible
        for supervising the Software while it runs and for verifying its behaviour (the built-in dry-run mode exists
        for exactly this reason) before letting it act unattended.
      </p>

      <h3>3. Your responsibilities</h3>
      <ul>
        <li>You are solely responsible for how you configure and use the Software.</li>
        <li>
          You must comply with all applicable laws, and with the terms of service, rules, or policies of any other
          software, website, game, or service you point PixelPulse at. Many games and online services explicitly
          prohibit automation, macros, or bots — using PixelPulse against such a service is done entirely at your own
          risk, and may result in your account being suspended, banned, or otherwise penalized by that service. That
          consequence is between you and the third-party service; it is not something the PixelPulse project controls
          or is responsible for.
        </li>
        <li>
          You must not use the Software to bypass CAPTCHAs, anti-bot, anti-fraud, or other security or access-control
          systems without the authorization of the system's owner, or for any unlawful purpose (including fraud,
          harassment, or unauthorized access to computer systems).
        </li>
      </ul>

      <h3>4. Limitation of liability</h3>
      <p>
        To the maximum extent permitted by law, the PixelPulse maintainers and contributors are not liable for any
        damages or losses arising from your use of the Software — including account suspensions or bans by
        third-party services, unintended clicks or input, data loss, or any other direct or indirect damages.
      </p>

      <h3>5. Changes to these Terms</h3>
      <p>
        These Terms may be updated as the project evolves. The current version always lives with the Software's
        source and documentation on GitHub.
      </p>

      <h3>6. Questions</h3>
      <p>
        PixelPulse is maintained on GitHub at{' '}
        <a href="https://github.com/SpaceSquare640/PixelPulse" target="_blank" rel="noreferrer">
          github.com/SpaceSquare640/PixelPulse
        </a>
        . Open an issue there for questions about these Terms.
      </p>
    </div>
  )
}

function Zh() {
  return (
    <div className="help-content">
      <p className="help-content__meta">最後更新：{LAST_UPDATED}</p>

      <p>
        本條款規範你使用 PixelPulse（以下稱「本軟體」）的行為，本軟體是一套開源的螢幕自動化工具。下載、安裝、或執行
        本軟體，即代表你同意本條款；如果不同意，請不要使用本軟體。
      </p>

      <h3>一、本軟體做什麼</h3>
      <p>
        PixelPulse 會持續監控你螢幕上的某個區域，尋找指定的目標圖片或像素顏色 —— 當你設定它這麼做時，會自動在
        <strong>你自己的電腦上</strong>執行滑鼠點擊、鍵盤輸入，或一連串這類動作（「巨集」）。本軟體完全在你自己的機器
        上執行，不會對其他任何人的裝置採取行動。
      </p>

      <h3>二、開源、「按現狀提供」</h3>
      <p>
        PixelPulse 免費提供，不附帶任何明示或默示的保證，包括但不限於適售性、特定用途適用性、不侵權等保證。螢幕辨識
        可能不夠精準，自動化輸入也可能觸發你沒有預期的動作。在讓本軟體無人看管地自動執行之前，你有責任監督它的執行
        狀況並驗證行為是否正確（這正是內建 dry-run 模式存在的理由）。
      </p>

      <h3>三、你的責任</h3>
      <ul>
        <li>你要自己負責如何設定與使用本軟體。</li>
        <li>
          你必須遵守所有適用法律，以及你讓 PixelPulse 操作的其他軟體、網站、遊戲或服務的使用條款、規則或政策。
          許多遊戲與線上服務明文禁止自動化、巨集或機器人程式 —— 若你把 PixelPulse 用在這類服務上，風險完全由你自行
          承擔，可能導致你的帳號被該服務停權、封鎖，或受到其他處分。這個後果是你與該第三方服務之間的事，
          不是 PixelPulse 專案能控制或需要負責的範圍。
        </li>
        <li>
          你不得使用本軟體在未經系統擁有者授權的情況下繞過驗證碼（CAPTCHA）、反機器人、反詐欺，或其他安全性/存取控制
          機制，也不得將本軟體用於任何不法目的（包括詐欺、騷擾、或未經授權存取電腦系統）。
        </li>
      </ul>

      <h3>四、責任限制</h3>
      <p>
        在法律允許的最大範圍內，PixelPulse 的維護者與貢獻者對於你使用本軟體所產生的任何損害或損失，不負任何責任
        —— 包括但不限於第三方服務的帳號停權/封鎖、非預期的點擊或輸入、資料遺失，或任何其他直接或間接損害。
      </p>

      <h3>五、條款異動</h3>
      <p>
        本條款可能隨著專案演進而更新，最新版本一律隨本軟體的原始碼與文件一起放在 GitHub 上。
      </p>

      <h3>六、有問題怎麼辦</h3>
      <p>
        PixelPulse 維護於 GitHub：{' '}
        <a href="https://github.com/SpaceSquare640/PixelPulse" target="_blank" rel="noreferrer">
          github.com/SpaceSquare640/PixelPulse
        </a>
        。對本條款有任何問題，歡迎在該處開 issue 詢問。
      </p>
    </div>
  )
}

export function TermsOfServiceContent({ lang }: Props) {
  return lang === 'zh' ? <Zh /> : <En />
}
