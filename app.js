/* ============================================================
   婚活自己開示QA Part1 – app.js
   ============================================================ */

const LIFF_ID   = "2010597175-JSyn68Zk";
const DRAFT_KEY = "konkatsu_qa_draft";

/* Part2への案内メッセージ（送信＆共有完了後にトーク画面へ送信） */
const NEXT_PART_MESSAGE =
  "次は自己開示QA part2を答えてみましょう！\n→ https://liff.line.me/2010312230-bBsE4hSS";

/* ------------------------------------------------------------
   URLセーフ Base64（圧縮対応）
   JSON文字列を pako（deflate）で圧縮し、バイナリをURLセーフな
   Base64に変換することで共有URLを大幅に短縮する。
   pako が読み込めない環境では非圧縮のBase64にフォールバックする。
   ------------------------------------------------------------ */
function uint8ToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64UrlToUint8(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad    = padded.length % 4;
  const fixed  = pad ? padded + "=".repeat(4 - pad) : padded;
  const binary = atob(fixed);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(str) {
  try {
    if (typeof pako !== "undefined") {
      const compressed = pako.deflate(str);
      return "z" + uint8ToBase64Url(compressed); // "z"=圧縮フォーマットの目印
    }
  } catch (e) {
    console.warn("pako compress failed, fallback to plain encode", e);
  }
  // フォールバック（非圧縮）
  return "p" + btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64UrlDecode(str) {
  const flag = str.charAt(0);
  const body = str.slice(1);

  if (flag === "z") {
    const bytes = base64UrlToUint8(body);
    return pako.inflate(bytes, { to: "string" });
  }

  // flag === "p"（非圧縮フォールバック）。旧バージョンの目印なし文字列にも対応。
  const target = flag === "p" ? body : str;
  const padded = target.replace(/-/g, "+").replace(/_/g, "/");
  const pad    = padded.length % 4;
  const fixed  = pad ? padded + "=".repeat(4 - pad) : padded;
  return decodeURIComponent(escape(atob(fixed)));
}

/* ------------------------------------------------------------
   スライダー値をビジュアル（SVG）に変換
   1〜5 の位置に応じて●を目盛り線上に配置する
   ------------------------------------------------------------ */
function sliderVisualHTML(value, leftLabel, rightLabel, max = 5) {
  const v = Math.min(Math.max(parseInt(value, 10) || 1, 1), max);

  const width   = 320;
  const padding = 12;
  const usable  = width - padding * 2;
  const step    = usable / (max - 1);
  const cx      = padding + step * (v - 1);
  const y       = 20;

  let ticks = "";
  for (let i = 0; i < max; i++) {
    const x = padding + step * i;
    ticks += `<line x1="${x}" y1="${y - 8}" x2="${x}" y2="${y + 8}" stroke="#f48ca0" stroke-width="2"/>`;
  }

  return `
    <div class="slider-visual">
      <div class="slider-visual-labels">
        <span>${leftLabel}</span>
        <span>${rightLabel}</span>
      </div>
      <svg viewBox="0 0 ${width} 40" xmlns="http://www.w3.org/2000/svg" class="slider-visual-svg">
        <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#f48ca0" stroke-width="2"/>
        ${ticks}
        <circle cx="${cx}" cy="${y}" r="9" fill="#222"/>
      </svg>
    </div>
  `;
}

/* ------------------------------------------------------------
   フォーム値の収集
   ------------------------------------------------------------ */
function collectFormData() {
  const q4Radio    = document.querySelector('input[name="q4"]:checked');
  const q7Radio    = document.querySelector('input[name="q7"]:checked');
  const q14_1Radio = document.querySelector('input[name="q14-1"]:checked');
  const q14_2Radio = document.querySelector('input[name="q14-2"]:checked');

  return {
    q1:       document.getElementById("q1").value,
    q2:       document.getElementById("q2").value,
    q3:       document.getElementById("q3").value,
    q4:       q4Radio  ? q4Radio.value  : "",
    q4Detail: document.getElementById("q4Detail").value,
    q5:       document.getElementById("q5").value,
    q6:       document.getElementById("q6").value,
    q7:       q7Radio  ? q7Radio.value  : "",
    q7Detail: document.getElementById("q7Detail").value,
    q8:       document.getElementById("q8").value,
    q9:       document.getElementById("q9").value,
    q10:      document.getElementById("q10").value,
    q11:      document.getElementById("q11").value,
    q12:      document.getElementById("q12").value,
    q13:      document.getElementById("q13").value,
    q14_1:    q14_1Radio ? q14_1Radio.value : "",
    q14_2:    q14_2Radio ? q14_2Radio.value : "",
    q15:      document.getElementById("q15").value,
  };
}

/* ------------------------------------------------------------
   フォームへの値の復元
   ------------------------------------------------------------ */
function restoreFormData(data) {
  if (!data) return;

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.value = val;
  };

  ["q1","q2","q3","q5","q6","q8","q9","q10","q11","q12","q13","q15"]
    .forEach(id => setText(id, data[id]));

  if (data.q4) {
    const r = document.querySelector(`input[name="q4"][value="${data.q4}"]`);
    if (r) { r.checked = true; toggleDetail("q4Detail", data.q4 === "yes"); setText("q4Detail", data.q4Detail); }
  }
  if (data.q7) {
    const r = document.querySelector(`input[name="q7"][value="${data.q7}"]`);
    if (r) { r.checked = true; toggleDetail("q7Detail", data.q7 === "yes"); setText("q7Detail", data.q7Detail); }
  }
  if (data.q14_1) {
    const r = document.querySelector(`input[name="q14-1"][value="${data.q14_1}"]`);
    if (r) r.checked = true;
  }
  if (data.q14_2) {
    const r = document.querySelector(`input[name="q14-2"][value="${data.q14_2}"]`);
    if (r) r.checked = true;
  }
}

/* ------------------------------------------------------------
   詳細テキストエリアの表示/非表示
   ------------------------------------------------------------ */
function toggleDetail(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = show ? "block" : "none";
  if (!show) el.value = "";
}

/* ------------------------------------------------------------
   バリデーション（本送信時のみ）
   ------------------------------------------------------------ */
function validate(data) {
  const errors = [];
  if (!data.q1)                                   errors.push("Q1: 朝起きる時間を入力してください。");
  if (!data.q2)                                   errors.push("Q2: 夜寝る時間を入力してください。");
  if (!data.q3.trim())                            errors.push("Q3: 仕事終わりの過ごし方を入力してください。");
  if (!data.q4)                                   errors.push("Q4: ニュース番組の有無を選択してください。");
  if (data.q4 === "yes" && !data.q4Detail.trim()) errors.push("Q4: 番組名を入力してください。");
  if (!data.q5.trim())                            errors.push("Q5: 子どもの頃好きだったテレビ番組を入力してください。");
  if (!data.q6.trim())                            errors.push("Q6: あだ名を入力してください。");
  if (!data.q7)                                   errors.push("Q7: MBTI診断の有無を選択してください。");
  if (data.q7 === "yes" && !data.q7Detail.trim()) errors.push("Q7: MBTIタイプを入力してください。");
  if (!data.q10.trim())                           errors.push("Q10: 部活動・サークル活動を入力してください。");
  if (!data.q11.trim())                           errors.push("Q11: バイト経験を入力してください。");
  if (!data.q12.trim())                           errors.push("Q12: 休日の友人・家族との過ごし方を入力してください。");
  if (!data.q13.trim())                           errors.push("Q13: 1人での休日の過ごし方を入力してください。");
  if (!data.q14_1)                                errors.push("Q14: デート予定の返信までの許容時間を選択してください。");
  if (!data.q14_2)                                errors.push("Q14: 雑談LINEの頻度を選択してください。");
  if (!data.q15.trim())                           errors.push("Q15: デートで行きたい場所を入力してください。");
  return errors;
}

/* ------------------------------------------------------------
   動画広告（送信ボタン押下時に表示）
   Google IMA SDK を利用。AD_TAG_URL は Google公式のテスト用
   VASTタグ（プレースホルダー）。広告配信元との契約が決まったら、
   そこで発行される本番用VASTタグURLに差し替えること。
   広告SDKの読み込み・広告の取得に失敗した場合は、広告を表示せず
   そのまま処理を続行する（送信できなくなる事態を避けるため）。
   ------------------------------------------------------------ */
const AD_TAG_URL =
  "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=";

const AD_TIMEOUT_MS = 6000; // 広告の読み込みがこの時間を超えたら諦めて先に進む

function playAdThenContinue(onDone) {
  const modal       = document.getElementById("adModal");
  const adContainer = document.getElementById("adContainer");
  const videoEl     = document.getElementById("adVideoElement");
  const skipBtn     = document.getElementById("adSkipBtn");

  // IMA SDKが読み込めていない環境（オフライン等）では広告をスキップ
  if (typeof google === "undefined" || !google.ima) {
    onDone();
    return;
  }

  let finished = false;
  let adsLoader, adsManager;
  const timeoutId = setTimeout(finish, AD_TIMEOUT_MS);

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timeoutId);
    modal.classList.remove("show");
    modal.classList.add("hidden");
    skipBtn.classList.add("hidden");
    skipBtn.onclick = null;
    try { adsLoader && adsLoader.destroy(); } catch (_) {}
    try { adsManager && adsManager.destroy(); } catch (_) {}
    onDone();
  }

  modal.classList.remove("hidden");
  modal.classList.add("show");

  try {
    const adDisplayContainer = new google.ima.AdDisplayContainer(adContainer, videoEl);
    adDisplayContainer.initialize();

    adsLoader = new google.ima.AdsLoader(adDisplayContainer);

    adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, finish, false);

    adsLoader.addEventListener(
      google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      (adsManagerLoadedEvent) => {
        clearTimeout(timeoutId);
        try {
          adsManager = adsManagerLoadedEvent.getAdsManager(videoEl);

          adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, finish);
          adsManager.addEventListener(google.ima.AdEvent.Type.COMPLETE, finish);
          adsManager.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED, finish);
          adsManager.addEventListener(google.ima.AdEvent.Type.SKIPPED, finish);
          adsManager.addEventListener(google.ima.AdEvent.Type.LOADED, () => {
            skipBtn.classList.remove("hidden");
            skipBtn.onclick = finish;
          });

          adsManager.init(320, 180, google.ima.ViewMode.NORMAL);
          adsManager.start();
        } catch (e) {
          console.warn("ad play failed", e);
          finish();
        }
      },
      false
    );

    const adsRequest = new google.ima.AdsRequest();
    adsRequest.adTagUrl               = AD_TAG_URL;
    adsRequest.linearAdSlotWidth      = 320;
    adsRequest.linearAdSlotHeight     = 180;
    adsRequest.nonLinearAdSlotWidth   = 320;
    adsRequest.nonLinearAdSlotHeight  = 90;

    adsLoader.requestAds(adsRequest);
  } catch (e) {
    console.warn("ad init failed", e);
    finish();
  }
}

/* ------------------------------------------------------------
   共有URL短縮用：キー名を1文字に変換するマッピング
   ------------------------------------------------------------ */
const SHARE_KEY_MAP = {
  q1: "a", q2: "b", q3: "c", q4: "d", q4Detail: "e",
  q5: "f", q6: "g", q7: "h", q7Detail: "i", q8: "j",
  q9: "k", q10: "l", q11: "m", q12: "n", q13: "o",
  q14_1: "p", q15: "q", q14_2: "r", _shareName: "ZZ",
};
const SHARE_KEY_MAP_REVERSE = Object.fromEntries(
  Object.entries(SHARE_KEY_MAP).map(([k, v]) => [v, k])
);

/* ------------------------------------------------------------
   回答データ → 共有URL（URLセーフBase64・キー短縮）
   ------------------------------------------------------------ */
function encodeDataToURL(data) {
  const shortData = {};
  Object.keys(data).forEach((key) => {
    const shortKey = SHARE_KEY_MAP[key] || key;
    shortData[shortKey] = data[key];
  });

  const encoded = base64UrlEncode(JSON.stringify(shortData));
  const base    = location.href.split("?")[0].split("#")[0];
  return `${base}?share=${encoded}`;
}

/* ------------------------------------------------------------
   URL → 回答データ（ビューモード・キー復元）
   ------------------------------------------------------------ */
function decodeDataFromURL() {
  const params = new URLSearchParams(location.search);
  const raw    = params.get("share");
  if (!raw) return null;
  try {
    const shortData = JSON.parse(base64UrlDecode(raw));
    const data = {};
    Object.keys(shortData).forEach((key) => {
      const longKey = SHARE_KEY_MAP_REVERSE[key] || key;
      data[longKey] = shortData[key];
    });
    // 復元後のデータが空オブジェクトの場合もリンク破損とみなす
    if (Object.keys(data).length === 0) throw new Error("empty share data");
    return data;
  } catch (e) {
    console.error("URL decode error", e);
    return null;
  }
}

/* ------------------------------------------------------------
   ビューモード：回答をカード表示
   ------------------------------------------------------------ */
function renderViewMode(data, options = {}) {
  const { selfPreview = false, onShare = null } = options;
  const q14_1Labels = {
    "a14-1-1": "返信まで6時間以内（朝LINEしたら昼までには返してほしい）",
    "a14-1-2": "返信まで12時間以内（朝LINEしたら夜までには返してほしい）",
    "a14-1-3": "返信まで24時間以内（朝LINEしたら翌朝までには返してほしい）",
    "a14-1-4": "返信まで3日以内",
    "a14-1-5": "3日以上でも日程に余裕があれば待てる",
  };
  const q14_2Labels = {
    "a14-2-1": "返信まで6時間以内（朝LINEしたら昼までには返してほしい）",
    "a14-2-2": "返信まで12時間以内（朝LINEしたら夜までには返してほしい）",
    "a14-2-3": "返信まで24時間以内（朝LINEしたら翌朝までには返してほしい）",
    "a14-2-4": "返信まで3日以内",
    "a14-2-5": "雑談LINEには返信はあってもなくてもよい",
    "a14-2-6": "雑談LINEは自分は送らないが相手から送られる分には気にしない",
    "a14-2-7": "雑談LINEは送りたくないし送られるのも好きじゃない",
  };

  const rows = [
    { q: "Q1 朝起きる時間は何時ですか？",                          a: data.q1  || "未回答" },
    { q: "Q2 夜寝る時間は何時ですか？",                            a: data.q2  || "未回答" },
    { q: "Q3 仕事終わり、どんな過ごし方をしていますか？",              a: data.q3  || "未回答" },
    { q: "Q4 平日の朝いつもつけているニュース/ワイドショー番組はありますか？",
       a: data.q4 === "yes" ? `あり（${data.q4Detail}）` : data.q4 === "no" ? "なし" : "未回答" },
    { q: "Q5 子どもの頃好きだったテレビ番組は何ですか？",              a: data.q5  || "未回答" },
    { q: "Q6 これまでに呼ばれたことのあるあだ名は何ですか？",           a: data.q6  || "未回答" },
    { q: "Q7 MBTI診断したことはありますか？",
       a: data.q7 === "yes" ? `あり（${data.q7Detail}）` : data.q7 === "no" ? "なし" : "未回答" },
    { q: "Q8 ポジティブですか？ネガティブですか？",
       slider: sliderVisualHTML(data.q8 || 3, "ネガティブ", "ポジティブ") },
    { q: "Q9 周囲の感情などを察する方ですか？",
       slider: sliderVisualHTML(data.q9 || 3, "察さない", "察する") },
    { q: "Q10 部活動、サークル活動は何をしていましたか？",             a: data.q10 || "未回答" },
    { q: "Q11 どんなバイトをしたことがありますか？",                  a: data.q11 || "未回答" },
    { q: "Q12 休みの日に友人や家族と会うことはありますか？",            a: data.q12 || "未回答" },
    { q: "Q13 1人で過ごす時の休みの日の過ごし方を教えてください。",      a: data.q13 || "未回答" },
    { q: "Q14-1 デートなど相談事項の予定調整、返信までどれくらいなら待てますか？（日程に余裕がある場合）",
       a: q14_1Labels[data.q14_1] || "未回答" },
    { q: "Q14-2 雑談LINEはどれくらいの頻度でしたいですか？",
       a: q14_2Labels[data.q14_2] || "未回答" },
    { q: "Q15 今後デートで行きたいところはありますか？",              a: data.q15 || "未回答" },
  ];

  // フォーム要素を非表示
  document.querySelectorAll(
    ".container > label, .container > input, .container > textarea, " +
    ".container > div.slider-labels, .container > div.button-group, " +
    ".container > div#shareModal"
  ).forEach(el => (el.style.display = "none"));

  // 自分自身（このLIFFアプリ）の回答フォームURL
  const formURL = location.href.split("?")[0].split("#")[0];

  // 共有画面（ビューモード）の上部注意書きを差し替える
  const descEl = document.querySelector(".form-header .form-description");
  if (descEl) {
    descEl.innerHTML =
      "回答を共有してお互いのことを知りましょう。<br>" +
      "回答内容だけじゃなく、なぜそう思ってるのか、この場合はどう変わるかなども質問し合ってみましょう。";
  }

  const container = document.getElementById("viewMode");
  container.style.display = "block";
  container.innerHTML = `
    ${selfPreview ? `
    <div class="cta-card share-confirm-card">
      <div class="cta-content" style="text-align:center;">
        <h3 class="cta-title">この内容を共有します</h3>
        <p class="cta-text">
          内容を確認したら、共有先を選んでください。
        </p>
        <button type="button" id="goShareBtn" class="cta-button">
          共有先を選ぶ <span class="cta-arrow">›</span>
        </button>
      </div>
    </div>
    ` : `
    <div class="view-header">
      <p class="view-label">回答内容</p>
      ${data._shareName ? `<p class="view-name">${escapeHTML(data._shareName)} さんの回答</p>` : ""}
    </div>
    `}

    ${rows.map(({ q, a, slider }) => `
      <div class="view-item">
        <p class="view-question">${escapeHTML(q)}</p>
        ${slider ? slider : `<p class="view-answer">${escapeHTML(a).replace(/\n/g, "<br>")}</p>`}
      </div>
    `).join("")}

    ${!selfPreview ? `
    <div class="cta-card">
      <img src="image1.PNG" class="cta-image-left" alt="">
      <div class="cta-content">
        <h3 class="cta-title">あなたの価値観も共有してみませんか？</h3>
        <p class="cta-text">
          婚活・交際前の自己開示は、<br>
          お互いを知る大切なきっかけになります。<br>
          あなたの考えや価値観をアンケートで伝えてみましょう。
        </p>
        <button type="button" id="ctaButton" class="cta-button" data-href="${formURL}">
          私も回答する <span class="cta-arrow">›</span>
        </button>
      </div>
    </div>
    ` : ""}
  `;

  if (selfPreview) {
    const goShareBtn = document.getElementById("goShareBtn");
    if (goShareBtn && typeof onShare === "function") {
      goShareBtn.addEventListener("click", onShare);
    }
    return;
  }

  const ctaButton = document.getElementById("ctaButton");
  if (ctaButton) {
    ctaButton.addEventListener("click", () => {
      if (confirm("自己開示QA part1を開く")) {
        window.location.href = ctaButton.dataset.href;
      }
    });
  }
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------
   共有：シェアターゲットピッカー用 Flexメッセージ
   長い共有URLはボタン(uriアクション)の中に格納するため、
   相手に見える本文には長いリンクが表示されない。
   ※ uriアクションのURLは1000文字以内という制限があるため、
     超える場合は liff.shareTargetPicker 側でエラーになり、
     呼び出し元で従来のURLスキーム方式にフォールバックする。
   ------------------------------------------------------------ */
function buildShareFlexMessage(shareName, shareURL) {
  const nameLine = shareName ? `${shareName}さんの回答が届きました` : "回答が届きました";

  return {
    type: "flex",
    altText: `婚活 自己開示QA Part1 - ${nameLine}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        contents: [
          { type: "text", text: "婚活 自己開示QA Part1", size: "xs", weight: "bold", color: "#d96c7d" },
          { type: "text", text: nameLine, size: "lg", weight: "bold", wrap: true, margin: "sm" },
          { type: "text", text: "ボタンから回答内容を確認できます。", size: "sm", color: "#888888", wrap: true, margin: "md" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "20px",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#f48ca0",
            action: { type: "uri", label: "回答をみる", uri: shareURL }
          }
        ]
      }
    }
  };
}

/* ------------------------------------------------------------
   共有先を選んで送信する
   1. シェアターゲットピッカーが使える場合はそちらを優先
      （Flexメッセージとして直接送信、送信後にトーク画面へ遷移しない）
   2. 使えない・失敗した場合は、従来のURLスキーム方式（送信先を
      選択画面を開いてテキストメッセージを送る）にフォールバック
   ------------------------------------------------------------ */
async function shareToOthers(flexMessage, fallbackLineSchemeURL) {
  if (liff.isApiAvailable("shareTargetPicker")) {
    try {
      await liff.shareTargetPicker([flexMessage], { isMultiple: true });
      return;
    } catch (e) {
      console.warn("shareTargetPicker failed, falling back to URL scheme:", e);
    }
  }

  if (liff.isInClient()) {
    window.location.href = fallbackLineSchemeURL;
  } else {
    window.open(fallbackLineSchemeURL, "_blank");
  }
}

/* ------------------------------------------------------------
   共有メッセージを本人のトーク画面にも送信する
   （共有相手に送るのと同じ文言）
   liff.sendMessages は、LIFFアプリが公式アカウントとのトーク画面
   から開かれている場合のみ利用可能（サーバー処理不要）。
   利用できない場合は何もしない。
   ------------------------------------------------------------ */
async function sendShareMessageToSelf(previewMsg) {
  try {
    if (liff.isInClient() && liff.isApiAvailable("sendMessages")) {
      await liff.sendMessages([
        { type: "text", text: previewMsg }
      ]);
    }
  } catch (e) {
    console.warn("sendMessages (self) skipped:", e);
  }
}

/* ------------------------------------------------------------
   Part2への案内メッセージをトーク画面に送信
   liff.sendMessages は、LIFFアプリが公式アカウントとのトーク画面
   から開かれている場合のみ利用可能（サーバー処理不要）。
   利用できない場合は何もしない。
   ------------------------------------------------------------ */
async function sendNextPartMessage() {
  try {
    if (liff.isInClient() && liff.isApiAvailable("sendMessages")) {
      await liff.sendMessages([
        { type: "text", text: NEXT_PART_MESSAGE }
      ]);
    }
  } catch (e) {
    // トーク画面から開かれていない場合などは送信できないため無視する
    console.warn("sendMessages skipped:", e);
  }
}

/* ------------------------------------------------------------
   友だち追加チェック
   LINE公式アカウントを友だち追加済みかを確認し、未追加であれば
   友だち追加ダイアログを表示する。
   ※ LIFF初期化・ログイン済みの状態で呼び出すこと（liff.init は呼ばない）
   ------------------------------------------------------------ */
async function checkFriendship() {
  try {
    const friendship = await liff.getFriendship();
    if (!friendship.friendFlag) {
      try {
        await liff.requestFriendship();
      } catch (error) {
        console.warn("友だち追加リクエスト失敗（ユーザーがキャンセルした可能性があります）:", error);
      }
    }
  } catch (error) {
    console.warn("友だち確認をスキップ:", error);
  }
}

/* ------------------------------------------------------------
   メイン処理
   ------------------------------------------------------------ */
(async () => {

  /* ----- ビューモード判定（LIFFログイン不要） ----- */
  const rawShareParam = new URLSearchParams(location.search).get("share");
  const sharedData     = decodeDataFromURL();
  if (sharedData) {
    renderViewMode(sharedData);
    return;
  }
  // share パラメータ自体は付いているのに復元できなかった場合＝リンク切れ・破損。
  // 何も表示されないまま通常の入力フォームへ進んでしまうと混乱を招くため通知する。
  if (rawShareParam) {
    alert(
      "共有されたリンクを正しく読み込めませんでした。\n" +
      "リンクが途中で切れているか、壊れている可能性があります。\n" +
      "お手数ですが、共有してくれた方にもう一度リンクを送ってもらってください。"
    );
  }

  /* ----- LIFF 初期化 ----- */
  try {
    await liff.init({ liffId: LIFF_ID });
  } catch (e) {
    console.error("LIFF init failed", e);
    alert("LIFFの初期化に失敗しました。");
    return;
  }

  if (!liff.isLoggedIn()) {
    liff.login();
    return;
  }

  /* ----- 友だち追加チェック（未追加なら追加ダイアログを表示） ----- */
  await checkFriendship();

  /* ----- localStorage から下書き復元 ----- */
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) restoreFormData(JSON.parse(saved));
  } catch (_) {}

  /* ----- Q4 / Q7 ラジオ：詳細テキストエリアの表示制御 ----- */
  document.querySelectorAll('input[name="q4"]').forEach(r =>
    r.addEventListener("change", () => toggleDetail("q4Detail", r.value === "yes"))
  );
  document.querySelectorAll('input[name="q7"]').forEach(r =>
    r.addEventListener("change", () => toggleDetail("q7Detail", r.value === "yes"))
  );

  const q4c = document.querySelector('input[name="q4"]:checked');
  toggleDetail("q4Detail", q4c ? q4c.value === "yes" : false);
  const q7c = document.querySelector('input[name="q7"]:checked');
  toggleDetail("q7Detail", q7c ? q7c.value === "yes" : false);

  /* ----- 下書き保存 ----- */
  document.getElementById("draftBtn").addEventListener("click", () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(collectFormData()));
      alert("下書きを保存しました。");
    } catch (_) {
      alert("下書きの保存に失敗しました。");
    }
  });

  /* ----- フォームクリア ----- */
  document.getElementById("clearBtn").addEventListener("click", () => {
    if (!confirm("入力内容をすべてクリアしますか？")) return;
    ["q1","q2","q3","q4Detail","q5","q6","q7Detail","q10","q11","q12","q13","q15"]
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    document.querySelectorAll('input[type="radio"]').forEach(r => (r.checked = false));
    document.getElementById("q8").value = 3;
    document.getElementById("q9").value = 3;
    toggleDetail("q4Detail", false);
    toggleDetail("q7Detail", false);
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
  });

  /* ----- 送信ボタン ----- */
  document.getElementById("submitBtn").addEventListener("click", () => {
    const data   = collectFormData();
    const errors = validate(data);
    if (errors.length > 0) {
      alert("以下の項目を入力してください。\n\n" + errors.join("\n"));
      return;
    }
    // 前回の回答として保存（次回編集時に復元できるようにする）
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (_) {}

    document.getElementById("submitBtn").disabled = true;

    // 広告を表示 → 終了後に共有モーダルを表示
    playAdThenContinue(() => {
      const modal = document.getElementById("shareModal");
      modal.classList.remove("hidden");
      modal.classList.add("show");
    });
  });

  /* ----- 共有ボタン ----- */
  document.getElementById("shareBtn").addEventListener("click", async () => {
    const shareName = document.getElementById("shareName").value.trim();
    const data      = collectFormData();
    data._shareName = shareName;

    const shareURL   = encodeDataToURL(data);

    // シェアターゲットピッカーで送るFlexメッセージのボタン(uriアクション)は
    // 1000文字以内という制限があるため、超えている場合はあらかじめ警告する。
    // （超えていてもURLスキーム方式へ自動フォールバックするため送信自体は可能）
    const SHARE_URL_WARN_LENGTH = 1000;
    if (shareURL.length > SHARE_URL_WARN_LENGTH) {
      alert(
        "回答内容が多いため、共有リンクがとても長くなっています。\n" +
        "環境によってはリッチメッセージでの共有ができず、通常のリンク共有になる場合があります。\n" +
        "気になる場合は、自由記述欄の回答を少し短くしてから再度お試しください。"
      );
    }

    const previewMsg = shareName
      ? `${shareName}さんの婚活　自己開示QA part1の回答が届きました。\n回答をみる→${shareURL}`
      : `婚活　自己開示QA part1の回答が届きました。\n回答をみる→${shareURL}`;

    const flexMessage = buildShareFlexMessage(shareName, shareURL);

    // モーダルを閉じる
    const modal = document.getElementById("shareModal");
    modal.classList.remove("show");
    modal.classList.add("hidden");

    // 送信＆共有完了 → 本人にも共有URLを送信し、続けてPart2への案内も送信
    // （liff.sendMessages はページ遷移前に呼び出す必要があるため先に実行）
    await sendShareMessageToSelf(previewMsg);
    await sendNextPartMessage();

    // まず本人の画面を「回答内容」プレビューに切り替える
    renderViewMode(data, {
      selfPreview: true,
      onShare: () => {
        // LINEの「送信先を選択」画面を開くURLスキーム（フォールバック用）
        const lineShareURL = `https://line.me/R/msg/text/?${encodeURIComponent(previewMsg)}`;
        shareToOthers(flexMessage, lineShareURL);
      },
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ----- モーダル外クリックで閉じる ----- */
  document.getElementById("shareModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove("show");
      e.currentTarget.classList.add("hidden");
    }
  });

})();
