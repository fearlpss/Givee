export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getState, setState, hasPersistentStore, finalizeState } from '../../../lib/store';

const OWNER_EMAIL = 'threatenn@outlook.com';
const clean = (state = {}) => ({
  giveaways: Array.isArray(state.giveaways) ? state.giveaways : [],
  entries: state.entries && typeof state.entries === 'object' ? state.entries : {},
  sites: Array.isArray(state.sites) ? state.sites : [],
  manualWins: Array.isArray(state.manualWins) ? state.manualWins : [],
  codes: Array.isArray(state.codes) ? state.codes : [],
  dailyRedeemed: state.dailyRedeemed && typeof state.dailyRedeemed === 'object' ? state.dailyRedeemed : {}
});

export async function GET() {
  try {
    let state = getState();
    state = finalizeState(await state);
    if (hasPersistentStore()) state = await setState(state);
    return Response.json({ ok: true, configured: hasPersistentStore(), state: clean(state) });
  } catch (error) {
    return Response.json({ ok: false, configured: hasPersistentStore(), error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = String(body?.action || '');
    const current = await getState();
    if (action === 'enter') {
      const id = String(body?.id || '');
      const user = String(body?.user || '').trim();
      const idx = current.giveaways.findIndex(g => g.id === id);
      if (idx < 0) return Response.json({ error: 'Giveaway not found.' }, { status: 404 });
      if (!user) return Response.json({ error: 'Enter a username.' }, { status: 400 });
      const existing = Array.isArray(current.entries[id]) ? current.entries[id] : [];
      if (existing.some(x => String(x).toLowerCase() === user.toLowerCase())) return Response.json({ error: "You've already entered this giveaway." }, { status: 409 });
      const entries = { ...current.entries, [id]: [...existing, user] };
      const giveaways = current.giveaways.map((g, i) => i === idx ? { ...g, entries: entries[id].length } : g);
      const saved = await setState({ ...current, giveaways, entries });
      return Response.json({ ok: true, state: clean(saved) });
    }
    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not update state.' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    if (String(body?.email || '').trim().toLowerCase() !== OWNER_EMAIL) return Response.json({ error: 'Unauthorized' }, { status: 403 });
    if (!hasPersistentStore()) return Response.json({ error: 'Persistent storage is not configured. Add the Upstash/Vercel Redis environment variables.' }, { status: 503 });
    const current = await getState();
    const incoming = clean(body.state || {});
    const saved = await setState({
      ...current,
      giveaways: Array.isArray(body.state?.giveaways) ? incoming.giveaways : current.giveaways,
      entries: body.state?.entries && typeof body.state.entries === 'object' ? incoming.entries : current.entries,
      sites: Array.isArray(body.state?.sites) ? incoming.sites : current.sites,
      manualWins: Array.isArray(body.state?.manualWins) ? incoming.manualWins : current.manualWins,
      codes: Array.isArray(body.state?.codes) ? incoming.codes : current.codes,
      dailyRedeemed: body.state?.dailyRedeemed && typeof body.state.dailyRedeemed === 'object' ? incoming.dailyRedeemed : current.dailyRedeemed
    });
    return Response.json({ ok: true, state: clean(saved) });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not save state.' }, { status: 500 });
  }
}
