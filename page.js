"use client";
import { useEffect, useMemo, useState } from "react";

const OWNER_EMAIL = "threatenn@outlook.com";
const starter = [
  { id: "g1", title: "$100 Gift Card", description: "Win a $100 gift card.", image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80", end: Date.now() + 259200000, entries: 128, winners: [] },
  { id: "g2", title: "Gaming Bundle", description: "A gaming bundle for your setup.", image: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=80", end: Date.now() + 518400000, entries: 74, winners: [] }
];
const starterSites = [
  { id: "s1", name: "Ehood", url: "https://ehood.xyz", description: "Chatting place" }
];
const dailyMiniPrizes = [
  { prize: "400 Robux", subtitle: "Quick daily Robux drop", icon: "/rewards/robux.svg" },
  { prize: "1,000 V-Bucks", subtitle: "Daily V-Bucks drop", icon: "/rewards/vbucks.svg" }
];

function getDailyMini() {
  const today = new Date();
  const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const dayNumber = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 86400000);
  const prize = dailyMiniPrizes[Math.abs(dayNumber) % dailyMiniPrizes.length];
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
  return { key, ...prize, end: tomorrow };
}

function getDailyCode() {
  const now = new Date();
  const key = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const points = 10 + (hash % 41);
  return { code: `GIVEE-${key}-${String(hash % 1000).padStart(3, "0")}`, points, key };
}



function read(key, fallback) {
  try {
    const x = localStorage.getItem(key);
    return x ? JSON.parse(x) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, x) {
  try { localStorage.setItem(key, JSON.stringify(x)); return true; } catch { return false; }
}
function getUsers() {
  const users = read("givee_users", []);
  return Array.isArray(users) ? users.filter(u => u && typeof u.email === "string") : [];
}
function saveCurrentUser(user) {
  write("givee_current_user", user);
  if (user?.email) write("givee_last_email", user.email);
}
function remaining(end) { const n = Math.max(0, end - Date.now()), d = Math.floor(n / 86400000), h = Math.floor(n % 86400000 / 3600000), m = Math.floor(n % 3600000 / 60000), s = Math.floor(n % 60000 / 1000); return `${d}d ${h}h ${m}m ${s}s`; }
function normalizeUrl(value) { const v = String(value || "").trim(); if (!v) return "#"; return /^https?:\/\//i.test(v) ? v : `https://${v}`; }

function finalizeExpiredGiveaways(current) {
  const now = Date.now();
  let changed = false;
  const next = current.map(g => {
    if (g.end > now || g.ended) return g;
    changed = true;
    const entrants = read(`givee_entries_${g.id}`, []);
    const unique = [...new Set(entrants.map(x => String(x).trim()).filter(Boolean))];
    const count = Math.max(1, Number(g.winnerCount || 1));
    const shuffled = [...unique].sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, Math.min(count, shuffled.length));
    return { ...g, ended: true, endedAt: now, winners, entries: g.entries ?? unique.length };
  });
  if (changed) write("givee_giveaways", next);
  return next;
}

export default function Home() {
  const [items, setItems] = useState([]), [sites, setSites] = useState([]), [tick, setTick] = useState(0);
  const [dailyMini, setDailyMini] = useState(null);
  const [tab, setTab] = useState("giveaways"), [auth, setAuth] = useState(null), [authMode, setAuthMode] = useState("signin");
  const [codes, setCodes] = useState([]), [codeInput, setCodeInput] = useState("");
  const [dailyCode, setDailyCode] = useState(null);
  const [codeForm, setCodeForm] = useState({ code: "", points: "1", maxUses: "" });
  const [points, setPoints] = useState(0), [adSeconds, setAdSeconds] = useState(0), [claimedRewards, setClaimedRewards] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0), [quizAnswer, setQuizAnswer] = useState(""), [quizMessage, setQuizMessage] = useState("");
  const [authForm, setAuthForm] = useState({ email: "", password: "" }), [form, setForm] = useState({ title: "", description: "", image: "", days: "0", hours: "0", minutes: "0", winnerCount: "1" });
  const [siteForm, setSiteForm] = useState({ name: "", url: "", description: "" }), [message, setMessage] = useState("");
  const [manualWins, setManualWins] = useState([]);
  const [winForm, setWinForm] = useState({ name: "", prize: "", label: "WIN" });

  useEffect(() => {
    const loadSharedState = async () => {
      let localGiveaways = read("givee_giveaways", null);
      let localSites = read("givee_sites", starterSites);
      let localWins = read("givee_manual_wins", []);
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Shared storage unavailable");
        const server = data.state || {};
        const serverHasData = Array.isArray(server.giveaways) && server.giveaways.length > 0;
        const currentUser = read("givee_current_user", null);
        const owner = currentUser?.email?.toLowerCase() === OWNER_EMAIL;

        if (serverHasData || Array.isArray(server.sites) && server.sites.length || Array.isArray(server.manualWins) && server.manualWins.length) {
          const restored = finalizeExpiredGiveaways(server.giveaways || []);
          setItems(restored);
          setSites(Array.isArray(server.sites) && server.sites.length ? server.sites : starterSites);
          setManualWins(server.manualWins || []);
          for (const g of restored) if (Array.isArray(server.entries?.[g.id])) write(`givee_entries_${g.id}`, server.entries[g.id]);
          write("givee_giveaways", restored);
          write("givee_sites", Array.isArray(server.sites) ? server.sites : starterSites);
          write("givee_manual_wins", server.manualWins || []);
        } else {
          const restored = finalizeExpiredGiveaways(Array.isArray(localGiveaways) ? localGiveaways : starter);
          setItems(restored);
          setSites(Array.isArray(localSites) ? localSites : starterSites);
          setManualWins(Array.isArray(localWins) ? localWins : []);
          // One-time migration: the owner's existing PC data is copied to the persistent store.
          if (owner && (restored.length || localWins.length || localSites.length)) {
            await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: currentUser.email, state: { giveaways: restored, entries: Object.fromEntries(restored.map(g => [g.id, read(`givee_entries_${g.id}`, [])])), sites: localSites, manualWins: localWins } }) });
          }
        }
      } catch {
        const restored = finalizeExpiredGiveaways(Array.isArray(localGiveaways) ? localGiveaways : starter);
        setItems(restored);
        setSites(Array.isArray(localSites) ? localSites : starterSites);
        setManualWins(Array.isArray(localWins) ? localWins : []);
      }
    };
    loadSharedState();
    setDailyMini(getDailyMini());
    setDailyCode(getDailyCode());
    const savedUser = read("givee_current_user", null);
    const validUser = savedUser && typeof savedUser.email === "string" && typeof savedUser.password === "string" ? savedUser : null;
    if (validUser) setAuth(validUser);
    else { try { localStorage.removeItem("givee_current_user"); } catch {} }
    const currentUser = validUser;
    setPoints(Number(read(`givee_points_${currentUser?.email || "guest"}`, 0)));
    setClaimedRewards(read(`givee_claims_${currentUser?.email || "guest"}`, []));
    fetch("/api/codes").then(r => r.json()).then(d => { setCodes(Array.isArray(d.codes) ? d.codes : []); if (d.daily) setDailyCode(d.daily); }).catch(() => setCodes([]));
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Do not poll /api/giveaways into state. The API uses in-memory server state,
  // which is not durable on Vercel and can revert to starter giveaways after a
  // serverless instance changes. Saved browser data must not be overwritten.
  useEffect(() => {}, []);

  useEffect(() => {
    if (!items.length) return;
    const finalized = finalizeExpiredGiveaways(items);
    if (JSON.stringify(finalized) !== JSON.stringify(items)) setItems(finalized);
  }, [tick]);

  const active = useMemo(() => items.filter(x => !x.ended && x.end > Date.now()), [items, tick]);
  const ended = useMemo(() => items.filter(x => x.ended || x.end <= Date.now()), [items, tick]);
  const isOwner = auth?.email?.toLowerCase() === OWNER_EMAIL;

  function flash(x) { setMessage(x); setTimeout(() => setMessage(""), 2500); }

  function submitAuth() {
    const email = authForm.email.trim().toLowerCase(), pw = authForm.password;
    if (!email || !pw) return flash("Enter an email and password.");
    let users = getUsers();
    if (authMode === "signup") {
      if (users.some(u => u.email.toLowerCase() === email)) return flash("That email already has an account.");
      const user = { email, password: pw };
      users = [...users, user];
      if (!write("givee_users", users)) return flash("Your browser blocked local storage. Please allow site storage and try again.");
      saveCurrentUser(user);
      setAuth(user);
      setPoints(Number(read(`givee_points_${email}`, 0)));
      setClaimedRewards(read(`givee_claims_${email}`, []));
      flash("Account created and saved on this device.");
    } else {
      const user = users.find(u => u.email.toLowerCase() === email && u.password === pw);
      if (!user) return flash("Incorrect email or password.");
      saveCurrentUser(user);
      setAuth(user);
      setPoints(Number(read(`givee_points_${email}`, 0)));
      setClaimedRewards(read(`givee_claims_${email}`, []));
      flash("Signed in — your account was restored.");
    }
    setAuthForm({ email: "", password: "" });
  }
  function signout() {
    try { localStorage.removeItem("givee_current_user"); } catch {}
    setAuth(null); setPoints(0); setClaimedRewards([]); flash("Signed out.");
  }

  const rewards = [
    { id: "robux", name: "Robux", amount: "400 Robux", cost: 4000, icon: "/rewards/robux.svg", description: "Redeem points for a Robux reward." },
    { id: "vbucks", name: "V-Bucks", amount: "1,000 V-Bucks", cost: 7000, icon: "/rewards/vbucks.svg", description: "Redeem points for a V-Bucks reward." },
    { id: "tiktok", name: "TikTok Account", amount: "TikTok Account", cost: 12000, icon: "/rewards/tiktok.svg", description: "Redeem points for a TikTok account reward." },
    { id: "giftcard", name: "Gift Card", amount: "$10 Gift Card", cost: 10000, icon: "/rewards/giftcard.svg", description: "Claim a gift-card code generated for you." },
    { id: "crypto", name: "Crypto", amount: "Crypto", cost: 15000, icon: "/rewards/crypto.svg", description: "Continue to the LARPS site for crypto rewards." }
  ];

  const quizQuestions = [
    { q: "What color is the Givee logo?", options: ["Yellow", "Purple", "Blue", "Green"], answer: "Yellow" },
    { q: "How often does the Daily Mini Giveaway reset?", options: ["Every day", "Every week", "Every month", "Never"], answer: "Every day" },
    { q: "What do you earn from points codes?", options: ["Points", "Followers", "Skins", "Badges"], answer: "Points" },
    { q: "Where do active giveaways appear?", options: ["Home", "Settings", "Account", "Footer"], answer: "Home" }
  ];

  function answerQuiz() {
    if (!auth) return flash("Sign in first to earn points.");
    if (!quizAnswer) return setQuizMessage("Pick an answer first.");
    const day = new Date().toISOString().slice(0, 10);
    const key = `givee_quiz_${day}_${auth.email}`;
    if (read(key, false)) return setQuizMessage("You've already earned today's quiz points.");
    const question = quizQuestions[quizIndex];
    if (quizAnswer !== question.answer) return setQuizMessage("Not quite — try again!");
    write(key, true);
    setPoints(prev => { const next = prev + 5; write(`givee_points_${auth.email}`, next); return next; });
    setQuizMessage("Correct! +5 points 🎉");
  }

  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("").replace(/(.{4})/g, "$1-").replace(/-$/, "");
  }

  function randomDemoTikTokAccount() {
    const names = ["@nxsq", "@vexro", "@zaylo", "@nqvii"];
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$";
    const username = names[Math.floor(Math.random() * names.length)];
    const password = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return { username, password };
  }

  function claimReward(reward) {
    return flash(`${reward.name} cash out is coming soon.`);
  }

  async function redeemCode() {
    const code = codeInput.trim().toUpperCase();
    if (!auth) return flash("Sign in before redeeming a code.");
    if (!code) return flash("Enter a code.");
    const today = getDailyCode();
    const localDailyKey = `givee_daily_code_redeemed_${today.key}_${auth.email}`;
    if (code === today.code && read(localDailyKey, false)) return flash("You've already redeemed today's daily code.");
    try {
      const res = await fetch("/api/codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redeem", code, user: auth.email }) });
      const data = await res.json();
      if (!res.ok) return flash(data.error || "That code is invalid.");
      const nextPoints = points + Number(data.points || 0);
      write(`givee_points_${auth.email}`, nextPoints); setPoints(nextPoints);
      if (code === today.code) write(localDailyKey, true);
      setCodes(data.codes || []); if (data.daily) setDailyCode(data.daily); setCodeInput(""); flash(`Code redeemed — +${data.points} points!`);
    } catch { flash("Couldn't connect to the code server. Try again."); }
  }

  async function createCode() {
    const code = codeForm.code.trim().toUpperCase();
    const pts = Math.max(1, Number(codeForm.points || 1));
    const max = codeForm.maxUses === "" ? 0 : Math.max(1, Number(codeForm.maxUses));
    if (!code) return flash("Enter a code name.");
    try {
      const res = await fetch("/api/codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", email: auth?.email, code, points: pts, maxUses: max }) });
      const data = await res.json();
      if (!res.ok) return flash(data.error || "Couldn't create code.");
      setCodes(data.codes || []); setCodeForm({ code: "", points: "1", maxUses: "" }); flash("Code created and shared site-wide.");
    } catch { flash("Couldn't connect to the code server. Try again."); }
  }

  async function removeCode(id) {
    try {
      const res = await fetch("/api/codes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: auth?.email, id }) });
      const data = await res.json();
      if (!res.ok) return flash(data.error || "Couldn't delete code.");
      setCodes(data.codes || []); flash("Code deleted.");
    } catch { flash("Couldn't connect to the code server. Try again."); }
  }

  function watchAd() {
    if (adSeconds > 0) return;
    setAdSeconds(30);
    const timer = setInterval(() => {
      setAdSeconds(v => {
        if (v <= 1) {
          clearInterval(timer);
          setPoints(prev => { const next = prev + 1; write(`givee_points_${auth?.email || "guest"}`, next); return next; });
          flash("Ad complete — +1 point!");
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  async function enterDailyMini() {
    if (!auth) return flash("Sign in first to enter.");
    const mini = dailyMini || getDailyMini();
    const key = `givee_daily_mini_${mini.key}`;
    const existing = read(key, []);
    const name = prompt("Enter your ehood username:");
    if (!name?.trim()) return;
    const clean = name.trim();
    if (existing.some(x => String(x).toLowerCase() === clean.toLowerCase())) return flash("You've already entered today's mini giveaway.");
    write(key, [...existing, clean]);
    flash("You're entered in today's mini giveaway! 🎉");
  }

  async function enter(id) {
    if (!auth) return flash("Sign in first to enter.");
    const name = prompt("Enter your ehood username:");
    if (!name?.trim()) return;
    const cleanName = name.trim();
    try {
      const res = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "enter", id, user: cleanName }) });
      const data = await res.json();
      if (!res.ok) return flash(data.error || "Couldn't enter giveaway.");
      const state = data.state || {};
      setItems(state.giveaways || []);
      write("givee_giveaways", state.giveaways || []);
      if (Array.isArray(state.entries?.[id])) write(`givee_entries_${id}`, state.entries[id]);
      flash("Entry added!");
    } catch {
      flash("Couldn't connect to Givee. Try again.");
    }
  }

  function pickImage(e) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) return flash("Please use an image under 5MB.");
    const reader = new FileReader(); reader.onload = () => setForm(f => ({ ...f, image: String(reader.result) })); reader.readAsDataURL(file);
  }

  async function saveShared(nextState) {
    const email = auth?.email?.toLowerCase();
    if (email !== OWNER_EMAIL) return false;
    const res = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, state: nextState }) });
    const data = await res.json();
    if (!res.ok) { flash(data.error || "Couldn't save shared data."); return false; }
    const state = data.state || nextState;
    setItems(state.giveaways || []); setSites(state.sites || []); setManualWins(state.manualWins || []);
    write("givee_giveaways", state.giveaways || []); write("givee_sites", state.sites || []); write("givee_manual_wins", state.manualWins || []);
    return true;
  }

  async function create() {
    if (!form.title.trim()) return flash("Add a giveaway title.");
    const duration = (Number(form.days || 0) * 86400000) + (Number(form.hours || 0) * 3600000) + (Number(form.minutes || 0) * 60000);
    if (duration <= 0) return flash("Set a duration using days, hours, or minutes.");
    const nextGiveaway = { id: crypto.randomUUID(), title: form.title.trim(), description: form.description.trim(), image: form.image || "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=900&q=80", end: Date.now() + duration, entries: 0, winnerCount: Math.max(1, Number(form.winnerCount || 1)), winners: [], ended: false };
    const nextItems = [...items, nextGiveaway];
    const entries = Object.fromEntries(nextItems.map(g => [g.id, read(`givee_entries_${g.id}`, [])]));
    const ok = await saveShared({ giveaways: nextItems, entries, sites, manualWins });
    if (!ok) return;
    setForm({ title: "", description: "", image: "", days: "0", hours: "0", minutes: "0", winnerCount: "1" });
    flash("Giveaway created and published live!");
  }

  async function remove(id) {
    const nextItems = items.filter(x => x.id !== id);
    const entries = Object.fromEntries(nextItems.map(g => [g.id, read(`givee_entries_${g.id}`, [])]));
    const ok = await saveShared({ giveaways: nextItems, entries, sites, manualWins });
    if (ok) { try { localStorage.removeItem(`givee_entries_${id}`); } catch {} flash("Giveaway deleted."); }
  }
  async function addSite() {
    if (!siteForm.name || !siteForm.url) return flash("Add a site name and URL.");
    const next = [...sites, { id: crypto.randomUUID(), ...siteForm, url: normalizeUrl(siteForm.url) }];
    if (await saveShared({ giveaways: items, entries: Object.fromEntries(items.map(g => [g.id, read(`givee_entries_${g.id}`, [])])), sites: next, manualWins })) {
      setSiteForm({ name: "", url: "", description: "" }); flash("Site added.");
    }
  }
  async function removeSite(id) {
    const next = sites.filter(x => x.id !== id);
    await saveShared({ giveaways: items, entries: Object.fromEntries(items.map(g => [g.id, read(`givee_entries_${g.id}`, [])])), sites: next, manualWins });
  }
  async function addManualWin() {
    const name = winForm.name.trim(), prize = winForm.prize.trim();
    if (!name || !prize) return flash("Add a winner name and prize.");
    const next = [{ id: crypto.randomUUID(), name, prize, label: winForm.label.trim() || "WIN", createdAt: Date.now() }, ...manualWins].slice(0, 50);
    if (await saveShared({ giveaways: items, entries: Object.fromEntries(items.map(g => [g.id, read(`givee_entries_${g.id}`, [])])), sites, manualWins: next })) {
      setWinForm({ name: "", prize: "", label: "WIN" }); flash("Winner added to the Winners tab.");
    }
  }
  async function removeManualWin(id) {
    const next = manualWins.filter(x => x.id !== id);
    if (await saveShared({ giveaways: items, entries: Object.fromEntries(items.map(g => [g.id, read(`givee_entries_${g.id}`, [])])), sites, manualWins: next })) flash("Winner removed.");
  }

  return <main>
    <header><div className="brand"><img src="/givee-logo.png" alt="Givee" /></div>
      <nav><button className={tab === "giveaways" ? "active" : ""} onClick={() => setTab("giveaways")}>HOME</button><button className={tab === "earn" ? "active" : ""} onClick={() => setTab("earn")}>EARN</button><button className={tab === "codes" ? "active" : ""} onClick={() => setTab("codes")}>CODES</button><button className={tab === "cashout" ? "active" : ""} onClick={() => setTab("cashout")}>CASH OUT</button><button className={tab === "sites" ? "active" : ""} onClick={() => setTab("sites")}>WINNERS</button>{isOwner && <button onClick={() => setTab("owner")}>OWNER</button>}<button className="pointsBtn" onClick={() => setTab("earn")}>{points} POINTS</button><button className="authBtn" onClick={() => setTab("account")}>{auth ? auth.email : "SIGN IN"}</button></nav>
    </header>
    {message && <div className="toast">{message}</div>}

    {tab === "giveaways" && <><section className="hero"><div><p className="eyebrow">THE HOME OF ONLINE GIVEAWAYS</p><h1>Claim it.<br /><em>Win it. Flex it.</em></h1><p className="sub">Enter giveaways in seconds. No complicated setup. Pick a prize and enter.</p></div><div className="heroCard"><div className="spark">🎁</div><b>Fresh drops</b><span>New prizes are waiting.</span><strong>ENTER →</strong></div></section>
      {dailyMini && <section className="section dailySection">
        <div className="dailyMini">
          <div className="dailyTop"><div><p className="eyebrow">🎁 DAILY MINI GIVEAWAY</p><h2>Win something every day.</h2><p>One quick giveaway resets every day at midnight.</p></div><div className="dailyBadge">TODAY'S DROP</div></div>
          <div className="dailyContent">
            <div className="dailyPrize"><div className="dailyIcon"><img src={dailyMini.icon} alt="" /></div><div><span>{dailyMini.subtitle}</span><h3>{dailyMini.prize}</h3><small>Free entry • One entry per username</small></div></div>
            <div className="dailyActions"><div className="dailyCountdown">⏱ Resets in <b>{remaining(dailyMini.end)}</b></div><button className="primary dailyEnter" onClick={enterDailyMini}>Enter Daily Giveaway →</button></div>
          </div>
        </div>
      </section>}
      <section className="section"><div className="sectionHead"><div><p className="eyebrow">LIVE NOW</p><h2>Active giveaways</h2></div><span>{active.length} live</span></div><div className="grid">{active.map(x => <article className="card" key={x.id}><img src={x.image} /><div className="cardBody"><div className="pill">● LIVE</div><h3>{x.title}</h3><p>{x.description}</p><div className="stats"><span>🎟 {x.entries || 0} entries</span><span>⏱ {remaining(x.end)}</span></div><button className="enter" onClick={() => enter(x.id)}>Enter Giveaway <b>→</b></button></div></article>)}</div>{!active.length && <div className="empty">No active giveaways right now.</div>}</section></>}

    {tab === "earn" && <section className="section earnSection"><div className="sectionHead"><div><p className="eyebrow">EARN POINTS</p><h2>Earn more points</h2></div><span className="pointsLabel">{points} points</span></div>
      <div className="earnCard"><div className="adBox"><span>ADVERTISEMENT</span><strong>{adSeconds ? `Your ad is playing… ${adSeconds}s` : "Watch a 30-second ad"}</strong><p>{adSeconds ? "Please keep this page open until the timer finishes." : "Complete the 30-second ad to earn 1 point."}</p></div><button className="primary" onClick={watchAd} disabled={adSeconds > 0}>{adSeconds ? `Watching… ${adSeconds}s` : "Watch Ad +1 Point"}</button></div>
      <div className="earnCard quizCard"><p className="eyebrow">🧠 QUICK QUIZ</p><h2>Answer a question</h2><p className="muted">Get 5 points for answering today's question correctly. One reward per day.</p><div className="quizQuestion"><b>{quizQuestions[quizIndex].q}</b>{quizQuestions[quizIndex].options.map(option => <label key={option}><input type="radio" name="giveeQuiz" value={option} checked={quizAnswer === option} onChange={() => { setQuizAnswer(option); setQuizMessage(""); }} /> {option}</label>)}</div><button className="primary" onClick={answerQuiz}>Submit Answer +5 Points</button>{quizMessage && <p className="muted">{quizMessage}</p>}</div></section>}

    {tab === "codes" && <section className="section"><div className="codeCard"><p className="eyebrow">🎁 DAILY CODE</p><h2>Today's points code</h2><p className="muted">A new code is generated every day. Today's code gives <b>{dailyCode?.points || 10} points</b> and can be redeemed once per account.</p><div className="dailyCodeDisplay"><code>{dailyCode?.code || "LOADING..."}</code><button className="primary" onClick={() => { if (dailyCode) { setCodeInput(dailyCode.code); flash("Daily code copied into the box."); } }}>Use Code</button></div><p className="muted">The daily code refreshes automatically each day.</p></div><div className="codeCard"><p className="eyebrow">REDEEM POINTS</p><h2>Have a code?</h2><p className="muted">Enter a code you were given to add points to your account.</p><div className="codeRow"><input placeholder="ENTER CODE" value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && redeemCode()} /><button className="primary" onClick={redeemCode}>Redeem Code</button></div><p className="muted">Codes can only be redeemed once per account.</p></div></section>}

    {tab === "cashout" && <section className="section"><div className="sectionHead"><div><p className="eyebrow">REWARDS SHOP</p><h2>Spend your points</h2><p className="muted">Rewards are being prepared. Cash out is coming soon.</p></div><span className="pointsLabel">{points.toLocaleString()} points</span></div><div className="rewardGrid">{rewards.map(reward => <div className="rewardCard" key={reward.id}><div className="rewardIcon"><img src={reward.icon} alt="" /></div><div className="rewardInfo"><p className="eyebrow">{reward.id === "crypto" ? "EXTERNAL" : "REWARD"}</p><h3>{reward.name}</h3><b>{reward.amount}</b><p>{reward.description}</p><span className="rewardCost">{reward.cost.toLocaleString()} points</span><button className="primary" onClick={() => claimReward(reward)} disabled={true}>Coming Soon</button></div></div>)}</div>{auth && claimedRewards.length > 0 && <div className="claims"><p className="eyebrow">YOUR CLAIMS</p><h3>Reward codes</h3>{claimedRewards.slice(0, 8).map(c => <div className="claimRow" key={c.id}><div><b>{c.reward}</b><span>{c.amount}</span>{c.tiktok && <span className="demoCreds"><strong></strong><br />Username: {c.tiktok.username}<br />Password: {c.tiktok.password}</span>}</div><code>{c.tiktok ? "DEMO" : c.code}</code></div>)}</div>}</section>}

    {tab === "sites" && <section className="section"><div className="sectionHead"><div><p className="eyebrow">🏆 WINNERS</p><h2>Live wins</h2><p className="muted">Recent wins from Givee.</p></div></div><div className="siteGrid">{manualWins.map(w => <div className="siteCard" key={w.id}><div className="siteIcon">🏆</div><div><h3>{w.name}</h3><p>Winner of {w.prize}</p><small>{w.label}</small></div></div>)}{items.filter(x => x.ended && Array.isArray(x.winners) && x.winners.length).flatMap(x => x.winners.map((winner, i) => ({ key: `${x.id}-${i}`, winner, prize: x.title }))).slice(0, 12).map(w => <div className="siteCard" key={w.key}><div className="siteIcon">🏆</div><div><h3>{w.winner}</h3><p>Winner of {w.prize}</p><small>CONFIRMED WIN</small></div></div>)}{!manualWins.length && !items.some(x => x.ended && Array.isArray(x.winners) && x.winners.length) && <div className="empty">No wins have been posted yet.</div>}</div></section>}


    {tab === "account" && <section className="authWrap"><div className="authCard"><div className="authLogo"><img src="/givee-logo.png" alt="Givee" /></div><p className="eyebrow">{authMode === "signin" ? "WELCOME BACK" : "JOIN GIVEE"}</p><h2>{authMode === "signin" ? "Sign in" : "Create your account"}</h2>{auth ? <><p className="muted">Signed in as <b>{auth.email}</b></p><button className="primary" onClick={signout}>Sign Out</button></> : <><input placeholder="Email" type="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} /><input placeholder="Password" type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} /><button className="primary" onClick={submitAuth}>{authMode === "signin" ? "Sign In" : "Sign Up"}</button><button className="switch" onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>{authMode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}</button></>}</div></section>}

    {tab === "owner" && isOwner && <section className="section"><div className="admin"><p className="eyebrow">OWNER ONLY</p><h2>Create a giveaway</h2><p className="muted">Only the account signed in with the owner email can see this panel.</p><div className="form"><input placeholder="Prize / giveaway title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /><input placeholder="Short description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /><label className="upload">📷 Choose prize photo<input type="file" accept="image/*" onChange={pickImage} /></label><div className="durationRow"><input type="number" min="0" placeholder="Days" value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} /><input type="number" min="0" max="23" placeholder="Hours" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} /><input type="number" min="0" max="59" placeholder="Minutes" value={form.minutes} onChange={e => setForm({ ...form, minutes: e.target.value })} /></div><input type="number" min="1" placeholder="Winners" value={form.winnerCount} onChange={e => setForm({ ...form, winnerCount: e.target.value })} /><button className="primary" onClick={create}>Create Giveaway</button></div>{form.image && <img className="preview" src={form.image} />}</div>
      <div className="admin"><p className="eyebrow">CODES</p><h2>Create points codes</h2><p className="muted">Make codes that users can enter from the CODES tab.</p><div className="codeAdmin"><input placeholder="Code e.g. WELCOME10" value={codeForm.code} onChange={e => setCodeForm({ ...codeForm, code: e.target.value })} /><input type="number" min="1" placeholder="Points" value={codeForm.points} onChange={e => setCodeForm({ ...codeForm, points: e.target.value })} /><input type="number" min="1" placeholder="Max uses (optional)" value={codeForm.maxUses} onChange={e => setCodeForm({ ...codeForm, maxUses: e.target.value })} /><button className="primary" onClick={createCode}>Create Code</button></div><div className="manage">{codes.map(c => <div key={c.id}><span><b>{c.code}</b> • +{c.points} points • {c.uses}{c.maxUses ? `/${c.maxUses}` : ""} uses</span><button onClick={() => removeCode(c.id)}>Delete</button></div>)}{!codes.length && <p className="muted">No codes created yet.</p>}</div></div>
      <div className="admin"><p className="eyebrow">🏆 WINNERS</p><h2>Add a winner</h2><p className="muted">Post a winner to the Winners tab from the owner panel.</p><div className="siteForm"><input placeholder="Winner username" value={winForm.name} onChange={e => setWinForm({ ...winForm, name: e.target.value })} /><input placeholder="Prize won" value={winForm.prize} onChange={e => setWinForm({ ...winForm, prize: e.target.value })} /><input placeholder="Label (optional)" value={winForm.label} onChange={e => setWinForm({ ...winForm, label: e.target.value })} /><button className="primary" onClick={addManualWin}>Add Winner</button></div><div className="manage">{manualWins.map(w => <div key={w.id}><span>{w.name} • {w.prize}</span><button onClick={() => removeManualWin(w.id)}>Delete</button></div>)}{!manualWins.length && <p className="muted">No manually posted wins yet.</p>}</div></div>
      <div className="admin"><p className="eyebrow">MANAGE</p><h2>Giveaways</h2><div className="manage">{items.map(x => <div key={x.id}><span>{x.title} {x.ended || x.end <= Date.now() ? "• ended" : "• live"}</span><button onClick={() => remove(x.id)}>Delete</button></div>)}</div></div>
      <div className="admin"><p className="eyebrow">LINK HUB</p><h2>Add another site</h2><div className="siteForm"><input placeholder="Site name" value={siteForm.name} onChange={e => setSiteForm({ ...siteForm, name: e.target.value })} /><input placeholder="https://..." value={siteForm.url} onChange={e => setSiteForm({ ...siteForm, url: e.target.value })} /><input placeholder="Description" value={siteForm.description} onChange={e => setSiteForm({ ...siteForm, description: e.target.value })} /><button className="primary" onClick={addSite}>Add Site</button></div><div className="manage">{sites.map(x => <div key={x.id}><span>{x.name}</span><button onClick={() => removeSite(x.id)}>Delete</button></div>)}</div></div>
    </section>}
    <footer><b>Givee</b><span>Giveaways made simple.</span></footer>
  </main>;
}
