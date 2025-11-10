// Currency Exchange v2 — Master Pack (XE-grade consumer converter)
// Includes: shareable URLs, copy link, copy embed, embed mode, provider comparison,
// local prefill, dynamic corridor SEO, alerts placeholder, 60s refresh.

document.addEventListener("DOMContentLoaded", () => {
  // --- Elements
  const amountEl = document.getElementById("amount");
  const fromEl = document.getElementById("from");
  const toEl   = document.getElementById("to");
  const swapBtn = document.getElementById("swap");
  const convertBtn = document.getElementById("convert");
  const headlineEl = document.getElementById("headline");
  const lineA = document.getElementById("lineA");
  const lineB = document.getElementById("lineB");
  const interbankEl = document.getElementById("interbank");
  const brokerEl = document.getElementById("broker");
  const spreadEl = document.getElementById("spread");
  const timeEl = document.getElementById("time");
  const rateTypeEl = document.getElementById("rateType");
  const copyLinkBtn = document.getElementById("copyLink");
  const copyEmbedBtn = document.getElementById("copyEmbed");
  const providersCard = document.getElementById("providersCard");

  // Alerts
  const alertEmail = document.getElementById("alertEmail");
  const alertThreshold = document.getElementById("alertThreshold");
  const saveAlert = document.getElementById("saveAlert");
  const alertNote = document.getElementById("alertNote");

  // Provider rows
  const providerIds = ["wise","revolut","western","moneygram","remitly","xoom","ofx","worldremit"];
  const rows = Object.fromEntries(providerIds.map(id => [id, document.getElementById(id)]));

  // --- Mock mid rates (symmetric-ish). Replace with live API later.
  const MID = {
    EUR: { USD: 1.0725, GBP: 0.8550, JPY: 162.50, CAD: 1.4600 },
    USD: { EUR: 0.9324, GBP: 0.7970, JPY: 151.70, CAD: 1.3600 },
    GBP: { EUR: 1.1696, USD: 1.2550, JPY: 191.30, CAD: 1.7200 },
    JPY: { EUR: 0.00615, USD: 0.00659, GBP: 0.00523, CAD: 0.01100 },
    CAD: { EUR: 0.6849, USD: 0.7350, GBP: 0.5814, JPY: 90.91 }
  };

  // Provider model (margin vs mid + flat fee in base)
  const PROVIDERS = [
    { id:"wise",       name:"Wise",          marginPct:0.10, fee:0.99, eta:"Same-day" },
    { id:"revolut",    name:"Revolut",       marginPct:0.20, fee:0.00, eta:"Instant"  },
    { id:"western",    name:"Western Union", marginPct:1.80, fee:2.90, eta:"Min–Hours" },
    { id:"moneygram",  name:"MoneyGram",     marginPct:1.50, fee:1.99, eta:"Min–Hours" },
    { id:"remitly",    name:"Remitly",       marginPct:1.20, fee:1.99, eta:"Hours–1d" },
    { id:"xoom",       name:"Xoom (PayPal)", marginPct:1.60, fee:2.99, eta:"Hours–1d" },
    { id:"ofx",        name:"OFX",           marginPct:0.35, fee:0.00, eta:"1–2d"     },
    { id:"worldremit", name:"WorldRemit",    marginPct:1.10, fee:2.49, eta:"Hours–1d" }
  ];

  // -------- Helpers
  const nowGMT = () => new Date().toUTCString().split(" ")[4];
  const fmt = (n, d=4) => Number(n).toFixed(d);

  function getMid(base, quote) {
    const m = MID?.[base]?.[quote];
    if (!m) return null;
    // tiny jitter to feel live
    const jitter = 1 + (Math.random() - 0.5) * 0.001; // ±0.05%
    return +(m * jitter).toFixed(6);
  }

  function updateURL(amt, base, quote, embed=false) {
    const url = new URL(window.location.href);
    url.searchParams.set("amount", String(amt));
    url.searchParams.set("from", base);
    url.searchParams.set("to", quote);
    if (embed) url.searchParams.set("embed","1"); else url.searchParams.delete("embed");
    window.history.replaceState({}, "", url.toString());
    return url.toString();
  }

  function readURL() {
    const url = new URL(window.location.href);
    const qAmt = parseFloat(url.searchParams.get("amount") || "100");
    const qFrom = (url.searchParams.get("from") || "").toUpperCase();
    const qTo   = (url.searchParams.get("to")   || "").toUpperCase();
    const embed = url.searchParams.get("embed")==="1";
    if (!isNaN(qAmt)) amountEl.value = String(qAmt);
    if (["EUR","USD","GBP","JPY","CAD"].includes(qFrom)) fromEl.value = qFrom;
    if (["EUR","USD","GBP","JPY","CAD"].includes(qTo))   toEl.value   = qTo;
    if (embed) document.body.classList.add("embed");
  }

  function softLocalDefault() {
    // Only applied if URL didn't specify currencies
    const url = new URL(location.href);
    if (url.searchParams.get("from") && url.searchParams.get("to")) return;
    try {
      const lang = (navigator.language || "").toLowerCase();
      if (lang.startsWith("en-gb")) { fromEl.value="GBP"; toEl.value="USD"; }
      else if (lang.startsWith("en-ca") || lang.startsWith("fr-ca")) { fromEl.value="CAD"; toEl.value="USD"; }
      else if (lang.startsWith("ja")) { fromEl.value="JPY"; toEl.value="USD"; }
      else { fromEl.value="EUR"; toEl.value="USD"; }
    } catch { /* keep defaults */ }
  }

  // Corridor SEO: dynamic title/meta/JSON-LD and canonical
  function updateSEO(base, quote) {
    const title = `${base} to ${quote} — Convert ${codeToName(base)} to ${codeToName(quote)} | Prime Exchange`;
    const desc  = `Convert ${base} to ${quote} with interbank and provider rates. See the true all-in amount and compare providers. Share or embed any result.`;
    document.title = title;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", desc);

    // Canonical (friendly corridor path simulated)
    const canon = document.getElementById("canonical");
    const url = new URL(location.href);
    const pairSlug = `${base.toLowerCase()}-to-${quote.toLowerCase()}`;
    canon.href = `${url.origin}/${pairSlug}`;

    // JSON-LD
    const ld = {
      "@context":"https://schema.org",
      "@type":"FinancialService",
      "name":"Prime Exchange",
      "url": url.origin,
      "description": desc,
      "areaServed":"Worldwide",
      "serviceType":"Currency conversion",
      "offers":{
        "@type":"Offer",
        "name": `${base} to ${quote} conversion`,
        "url": url.toString()
      }
    };
    document.getElementById("ldjson").textContent = JSON.stringify(ld);
  }

  function codeToName(c){
    switch(c){
      case "EUR": return "Euros";
      case "USD": return "US Dollars";
      case "GBP": return "British Pounds";
      case "JPY": return "Japanese Yen";
      case "CAD": return "Canadian Dollars";
      default: return c;
    }
  }

  // Provider comparison: all-in (amount * rate − fee)
  function updateProviders(midRate, amount, base, quote) {
    let best = null; let bestVal = -Infinity;
    PROVIDERS.forEach(p => {
      const rate = midRate * (1 - p.marginPct/100);
      const received = amount * rate - p.fee;
      if (received > bestVal) { bestVal = received; best = p.id; }

      const row = rows[p.id];
      if (!row) return;
      row.children[0].textContent = p.name;
      row.children[1].textContent = fmt(rate);
      row.children[2].textContent = `${fmt(p.fee,2)} ${base}`;
      row.children[3].textContent = `${fmt(received,2)} ${quote}`;
      row.children[4].textContent = p.eta;
      row.classList.remove("highlight");
    });
    if (best) rows[best].classList.add("highlight");
  }

  // --- Core compute
  function compute() {
    const amt = Math.max(0, parseFloat(amountEl.value || "0"));
    const base = fromEl.value;
    const quote = toEl.value;

    // SEO + corridor heading
    document.getElementById("title").textContent = `${base} to ${quote} — Convert ${codeToName(base)} to ${codeToName(quote)}`;

    const m = getMid(base, quote);
    if (!m) { alert("Pair not available in demo."); return; }

    // Generic broker reference
    const brokerRate = m * (1 - 0.004); // 0.40% off mid (illustrative)
    const spreadPct = ((m - brokerRate)/m)*100;

    // Headline + reciprocals
    headlineEl.textContent = `${fmt(amt,2)} ${base} = ${fmt(amt*m,2)} ${quote}`;
    lineA.textContent = `1 ${base} = ${fmt(m)} ${quote}`;
    lineB.textContent = `1 ${quote} = ${fmt(1/m)} ${base}`;
    interbankEl.textContent = fmt(m);
    brokerEl.textContent = fmt(brokerRate);
    spreadEl.textContent = fmt(spreadPct,2) + "%";
    timeEl.textContent = new Date().toUTCString().split(" ")[4];
    rateTypeEl.textContent = "Rate type: Interbank (mid)";

    updateProviders(m, amt, base, quote);

    // Update URL + SEO
    const embed = document.body.classList.contains("embed");
    const currentURL = updateURL(amt, base, quote, embed);
    updateSEO(base, quote);

    // Copy buttons
    copyLinkBtn.onclick = async () => {
      try { await navigator.clipboard.writeText(currentURL); notify("Link copied"); }
      catch { fallbackCopy(currentURL); }
    };
    copyEmbedBtn.onclick = async () => {
      const iframe = `<iframe src="${currentURL.includes("?")?currentURL+"&embed=1":currentURL+"?embed=1"}" width="420" height="520" style="border:1px solid #e6ecf5;border-radius:12px" loading="lazy"></iframe>`;
      try { await navigator.clipboard.writeText(iframe); notify("Embed code copied"); }
      catch { fallbackCopy(iframe); }
    };
  }

  function notify(msg){
    alert(msg); // simple; replace with toast later
  }
  function fallbackCopy(text){
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch(e){}
    document.body.removeChild(ta);
    notify("Copied");
  }

  // Alerts placeholder (local only for now)
  if (saveAlert){
    saveAlert.addEventListener("click", () => {
      const email = (alertEmail.value || "").trim();
      const thr = parseFloat(alertThreshold.value || "0");
      const base = fromEl.value, quote = toEl.value;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alertNote.textContent = "Enter a valid email.";
        return;
      }
      if (!(thr>0)) {
        alertNote.textContent = "Enter a valid threshold (e.g., 1.10).";
        return;
      }
      const key = "prime-exchange-alerts";
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      arr.push({ email, base, quote, thr, at: Date.now() });
      localStorage.setItem(key, JSON.stringify(arr));
      alertNote.textContent = "Saved locally. Backend hook can process this later.";
    });
  }

  // Wire up
  convertBtn.addEventListener("click", compute);
  swapBtn.addEventListener("click", () => {
    const t = fromEl.value; fromEl.value = toEl.value; toEl.value = t; compute();
  });

  // Init: read URL → embed mode → local defaults → compute → refresh 60s
  readURL();
  softLocalDefault();
  compute();
  setInterval(compute, 60000);
});