const KEY = 'givee:state:v1';

const DEFAULT_STATE = {
  giveaways: [],
  entries: {},
  sites: [],
  manualWins: [],
  codes: [],
  dailyRedeemed: {}
};

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return { url, token };
}

export function hasPersistentStore() {
  const { url, token } = redisConfig();
  return Boolean(url && token);
}

async function redis(command, ...args) {
  const { url, token } = redisConfig();
  if (!url || !token) throw new Error('Givee persistent storage is not configured.');
  const endpoint = `${url.replace(/\/$/, '')}/${encodeURIComponent(command)}${args.length ? '/' + args.map(v => encodeURIComponent(typeof v === 'string' ? v : JSON.stringify(v))).join('/') : ''}`;
  const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Redis request failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

export function finalizeState(state) {
  const now = Date.now();
  let changed = false;
  const giveaways = (state.giveaways || []).map(g => {
    if (g.ended || Number(g.end) > now) return g;
    const entrants = Array.isArray(state.entries?.[g.id]) ? [...new Set(state.entries[g.id].map(x => String(x).trim()).filter(Boolean))] : [];
    const count = Math.max(1, Number(g.winnerCount || 1));
    const winners = entrants.length ? [...entrants].sort(() => Math.random() - 0.5).slice(0, Math.min(count, entrants.length)) : [];
    changed = true;
    return { ...g, ended: true, endedAt: now, winners, entries: entrants.length };
  });
  return changed ? { ...state, giveaways } : state;
}

export async function getState() {
  if (!hasPersistentStore()) return { ...DEFAULT_STATE };
  const raw = await redis('get', KEY);
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      giveaways: Array.isArray(parsed.giveaways) ? parsed.giveaways : [],
      entries: parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {},
      sites: Array.isArray(parsed.sites) ? parsed.sites : [],
      manualWins: Array.isArray(parsed.manualWins) ? parsed.manualWins : [],
      codes: Array.isArray(parsed.codes) ? parsed.codes : [],
      dailyRedeemed: parsed.dailyRedeemed && typeof parsed.dailyRedeemed === 'object' ? parsed.dailyRedeemed : {}
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function setState(state) {
  if (!hasPersistentStore()) throw new Error('Givee persistent storage is not configured.');
  const clean = {
    ...DEFAULT_STATE,
    ...state,
    updatedAt: Date.now()
  };
  await redis('set', KEY, JSON.stringify(clean));
  return clean;
}
