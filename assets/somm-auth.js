/**
 * assets/somm-auth.js — 匿名/ログイン共通の認証ヘルパー（2026-07-27 セキュリティ監査対応）
 *
 * prototype.html・sommelier-chat.html に重複していた getAnonAccessToken() と、
 * prototype.html にあった「ログイン中の端末を自動リンク」処理を単一ソース化。
 * cellar.html・taste.html 等、個人データAPIを叩く全ページから読み込んで使う。
 *
 * 設計_認可の統一_2026-07-24.md §3: 「userIdは名乗り、JWTは証明」。
 * 個人データAPIには userId だけでなくこのトークンも必ず添えること。
 *
 * グローバル関数:
 *   getAnonAccessToken() → Promise<string|null>  … ログイン中ならそのJWT、無ければ匿名JWT
 *   linkDeviceIfLoggedIn(uid) → void             … ログイン中の端末をsomm_uidに紐付け（冪等・fire-and-forget）
 *   authFetch(url, opts) → Promise<Response>     … fetchのAuthorizationヘッダ付きラッパー
 */
(function () {
  const SB_URL = 'https://gkhdpzfmqraliwaiubwl.supabase.co';
  const SB_KEY = 'sb_publishable_p-8MZjT4azg59TAtQgChhA___PLMlDV';
  const API_BASE = 'https://sommelin-trade-platform-1076605563046.asia-northeast1.run.app';

  async function getAnonAccessToken() {
    try {
      // ログイン済みなら、そのアカウントのJWTを優先する（本人確認の強度が高い）。
      const account = JSON.parse(localStorage.getItem('sommelin_session') || 'null');
      if (account && account.access_token && (!account.expires_at || account.expires_at * 1000 > Date.now() + 60000)) {
        return account.access_token;
      }
      const raw = localStorage.getItem('somm_anon_session');
      let sess = raw ? JSON.parse(raw) : null;
      if (sess && sess.expires_at && sess.expires_at * 1000 > Date.now() + 60000) return sess.access_token;
      if (sess && sess.refresh_token) {
        const r = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
          body: JSON.stringify({ refresh_token: sess.refresh_token }),
        });
        if (r.ok) { sess = await r.json(); localStorage.setItem('somm_anon_session', JSON.stringify(sess)); return sess.access_token; }
      }
      const r2 = await fetch(SB_URL + '/auth/v1/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify({}),
      });
      if (!r2.ok) return null;
      sess = await r2.json();
      localStorage.setItem('somm_anon_session', JSON.stringify(sess));
      return sess.access_token;
    } catch (e) { return null; }
  }

  // ログイン中の端末をsomm_uidに紐付ける（prototype.htmlの既存処理と同一・冪等）。
  // 匿名ユーザーには紐付ける「本人の別アカウント」自体が無いため、ログイン時のみ実行する。
  function linkDeviceIfLoggedIn(uid) {
    try {
      const sess = JSON.parse(localStorage.getItem('sommelin_session') || 'null');
      if (sess && sess.access_token && uid && uid !== 'na') {
        fetch(API_BASE + '/api/link-device', {
          method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: sess.access_token, sommUid: uid }),
        }).catch(function () {});
      }
    } catch (e) {}
  }

  // 個人データAPI呼び出し用の薄いfetchラッパー。既存のfetch(url, opts)呼び出しを
  // authFetch(url, opts) に置き換えるだけでAuthorizationヘッダが付く。
  async function authFetch(url, opts) {
    opts = opts || {};
    const token = await getAnonAccessToken();
    const headers = Object.assign({}, opts.headers || {}, token ? { Authorization: 'Bearer ' + token } : {});
    return fetch(url, Object.assign({}, opts, { headers }));
  }

  window.getAnonAccessToken = getAnonAccessToken;
  window.linkDeviceIfLoggedIn = linkDeviceIfLoggedIn;
  window.authFetch = authFetch;
})();
