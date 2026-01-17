// server/adminDeleteUser.js  (CommonJS)
const express = require('express');
const router = express.Router();

router.post('/delete-user', async (req, res) => {
  const supabaseAdmin = req.supabaseAdmin;
  try {
    // Accept either { id: 'uuid' } or { user_id: 'uuid' }
    const uid = (req.body && (req.body.user_id || req.body.id || req.body.uid));
    if (!uid) {
      return res.status(400).json({ error: 'Missing user id (send { user_id: "<uuid>" } or { id: "<uuid>" })' });
    }

    console.log('[delete-user] requested for uid=', uid);

    // 1) Try RPC admin_delete_user (if you created it in SQL)
    try {
      const { error: rpcError } = await supabaseAdmin.rpc('admin_delete_user', { target_uid: uid });
      if (!rpcError) {
        console.log('[delete-user] deleted via rpc admin_delete_user');
        return res.json({ ok: true, method: 'rpc' });
      } else {
        console.warn('[delete-user] admin_delete_user RPC returned error, falling back:', rpcError.message || rpcError);
      }
    } catch (rpcEx) {
      console.warn('[delete-user] RPC call threw, falling back:', rpcEx?.message || rpcEx);
    }

    // 2) Fallback manual cascade delete (best-effort)
    // Delete rows in dependent tables first to satisfy FK constraints
    const cascadeTables = [
      { table: 'withdrawals', col: 'user_id' },
      { table: 'deposits', col: 'user_id' },
      { table: 'user_plans', col: 'user_id' },
      { table: 'activity_logs', col: 'user_id' },
      // add more dependent tables here if you have them
    ];

    for (const t of cascadeTables) {
      console.log(`[delete-user] deleting from ${t.table} where ${t.col}=${uid}`);
      const { error: delErr } = await supabaseAdmin
        .from(t.table)
        .delete()
        .eq(t.col, uid);
      if (delErr) {
        console.warn(`[delete-user] delete from ${t.table} returned error (continuing):`, delErr.message || delErr);
      }
    }

    // 3) Remove row from public.users (your app table)
    console.log('[delete-user] deleting from public.users id=', uid);
    const { error: delUserErr } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', uid);

    if (delUserErr) {
      console.warn('[delete-user] deleting from public.users returned error (continuing):', delUserErr.message || delUserErr);
    }

    // 4) Try admin auth delete (remove user from auth.users)
    try {
      if (supabaseAdmin.auth && supabaseAdmin.auth.admin && typeof supabaseAdmin.auth.admin.deleteUser === 'function') {
        console.log('[delete-user] calling supabaseAdmin.auth.admin.deleteUser');
        const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
        if (authDelErr) {
          console.warn('[delete-user] auth.admin.deleteUser returned error (non-fatal):', authDelErr.message || authDelErr);
        } else {
          console.log('[delete-user] removed from auth.users');
        }
      } else {
        console.warn('[delete-user] supabaseAdmin.auth.admin.deleteUser not available in SDK - skip');
      }
    } catch (authEx) {
      console.warn('[delete-user] error deleting auth user (non-fatal):', authEx?.message || authEx);
    }

    console.log('[delete-user] finished fallback deletions for', uid);
    return res.json({ ok: true, method: 'fallback' });
  } catch (err) {
    console.error('[delete-user] unexpected error:', err?.stack || err);
    return res.status(500).json({ error: 'Server error', detail: err?.message || String(err) });
  }
});

module.exports = router;
