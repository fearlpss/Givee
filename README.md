# Givee v32 — Cross-Device Persistence

Based on the previous Givee persistent-giveaways build.

## What changed
- Giveaways are stored in a real persistent Redis/Upstash backend instead of browser localStorage/serverless memory.
- A giveaway created on the owner's PC is available on the phone and other devices using the same deployed Givee site.
- Giveaway entries are shared across devices.
- Expired giveaways are finalized server-side so winners remain after a Vercel function restarts.
- Winners and the owner-managed Winners tab are persisted in the same shared store.
- The Sites/Link Hub is persisted in the shared store.
- Existing browser giveaway data is migrated once when the owner opens the new deployment, if the persistent store is empty.
- Browser storage remains as a local cache/fallback, but it is no longer the source of truth when the persistent store is configured.

## Required Vercel setup

Cross-device persistence requires a persistent backend. This build uses Upstash Redis through its REST API and does **not** use Supabase.

1. In the Vercel project, open **Storage** / **Integrations** and create or connect an **Upstash Redis** database.
2. Make sure the Vercel project receives these environment variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   
   The build also accepts the legacy Vercel KV names `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Redeploy the project after the variables are connected.
4. Sign into Givee as the owner (`threatenn@outlook.com`) on the PC where the current giveaways exist. The new build will migrate those saved giveaways into the persistent store if it is empty.
5. Open the same Vercel URL on the phone. The same giveaways should load from the shared store.

## Important
Without the Redis/Upstash environment variables, the site cannot provide real cross-device persistence. The Owner panel will show an error if a save is attempted without the persistent backend.

For uploaded giveaway photos, remote image URLs are recommended because very large base64 image data can exceed Redis request limits. The existing photo-picker is retained for small images.
