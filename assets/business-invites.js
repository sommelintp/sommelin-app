/**
 * assets/business-invites.js — 業務店の招待UI（発行／一覧／承認）2026-07-27
 *
 * 設計: 引き継ぎ_2026-07-27_招待制.md §6-A / memory: sommelin-business-invite-design
 * API : POST /api/business/invites（発行・生トークンはこの1回だけ）
 *       GET  /api/business/invites（一覧＋残枠）
 *       POST /api/business/invites/:id/revoke（取り消し・未使用のみ）
 *       POST /api/business/invites/:id/decide（承認／否認＝本許可）
 *
 * 【この画面が守ること】
 *  1. 信用を上げられるのは人だけ。承認ボタンを押せるのは招待者本人で、AIの出力は
 *     「疑い」としてしか表示しない。AIが推奨・自動承認する導線は作らない。
 *  2. 招待時の申告(hint)と実際の登録内容(invitee)を必ず並べる。これが招待制でしか
 *     作れない検証軸で、この画面の存在理由。片方だけを見せる表示は作らない。
 *  3. ここのゲートは親切であって鍵ではない。資格・枠・期限の判定は全てサーバー側。
 *     このJSは「押しても無駄」を先に伝えるだけで、押せてしまっても事故にならない。
 *     （※オーナー=adminは未approvedでも発行できる免除があるため、状態で発行ボタンを
 *       塞ぐと本人の運用が止まる。塞がずにサーバーの答えを正直に出す）
 *
 * restaurant_admin.html / importer_admin.html のアカウントシートから mount() する。
 * 承認画面を2ページに書き写すと必ず片方が古くなるので、実体はこの1ファイルに置く。
 *
 * グローバル:
 *   SommInvites.mount(el, opts)   … 招待セクションを描画（opts: {verificationStatus, roles}）
 *   SommInvites.pendingCount()    … 承認待ち件数（バッジ用・失敗時は0）
 */
(function () {
  'use strict';

  var API = 'https://sommelin-trade-platform-1076605563046.asia-northeast1.run.app';

  // ── 多言語（somm_lang を全ページで共有。業務店ページは日英対応済み） ──
  function lang() {
    try { return localStorage.getItem('somm_lang') === 'en' ? 'en' : 'ja'; } catch (e) { return 'ja'; }
  }
  var DICT = {
    ja: {
      section: '招待',
      section_sub: '業務店になれるのは、あなたが招待して承認した人だけです',
      quota: '今月の招待枠',
      quota_used: '{used} / {max} 枚',
      quota_note: '取り消しても枠は戻りません',
      frozen: '発行を停止中',
      frozen_note: '事務局までご連絡ください',
      not_approved_note: '業務店確認が完了すると招待を発行できます',
      issue_btn: '＋ 招待を発行',
      issue_title: '招待を発行',
      issue_lead: '先に「誰を招待するか」を書きます。この内容は相手には見えません。相手が自分で登録した内容と後で並べて、本人かどうかを確かめるための材料です。',
      f_company: '会社名・屋号',
      f_contact: '担当者名',
      f_role: '業態',
      f_email: 'メールアドレス',
      f_note: 'メモ（どこで会ったか・誰の紹介か）',
      f_note_ph: '例: 秋の試飲会で名刺交換。田中さんの紹介',
      f_ttl: '有効期限',
      ttl_days: '{n}日',
      optional: '任意',
      issue_submit: 'この内容で招待を発行',
      issue_warn_autofill: '書いた内容は相手の登録フォームには自動入力されません（照合の材料を残すため）',
      issuing: '発行中…',
      // 発行直後のリンク表示
      token_title: '招待リンクを発行しました',
      token_once: 'このリンクを表示できるのは今だけです',
      token_once_body: '閉じると二度と表示できません。サーバーには照合用のハッシュしか残していないため、あとから取り出すことはできません。必ずコピーしてから閉じてください。',
      token_for: '宛先',
      token_expires: '有効期限',
      copy: 'リンクをコピー',
      copied: 'コピーしました',
      copy_fail: 'コピーできませんでした。長押しで選択してコピーしてください',
      share: '共有',
      token_close: '控えました。閉じる',
      token_close_confirm: 'まだリンクをコピーしていません。閉じると二度と表示できません。閉じますか？',
      // 一覧
      list_title: '発行した招待',
      list_empty: 'まだ招待を発行していません',
      st_awaiting_decision: '承認待ち',
      st_active: '有効',
      st_approved: '承認済み',
      st_rejected: '否認',
      st_expired: '期限切れ',
      st_revoked: '取り消し済み',
      issued_at: '発行',
      expires_in: 'あと{n}日',
      expires_today: '今日まで',
      used_at: '登録',
      decided_at: '判断',
      revoke: '取り消す',
      revoke_confirm: 'この招待リンクを取り消します。相手はこのリンクで登録できなくなります。よろしいですか？',
      revoke_done: '招待を取り消しました',
      link_gone: 'リンクは発行時の1回だけ表示されます',
      // 承認画面
      pending_title: 'あなたの承認を待っています',
      pending_lead: 'この人を業務店として認めるかどうかを決めます。決めるのはあなたです。',
      memo_label: 'あなたが招待時に書いたメモ',
      memo_none: '（メモなし）',
      cmp_left: '招待時のあなたの申告',
      cmp_right: '本人が登録した内容',
      v_match: '一致',
      v_match_loose: '一致（表記ゆれ）',
      v_diff: '相違',
      v_no_hint: '申告なし',
      v_no_value: '未登録',
      blank: '—',
      why: '招待時のメモは相手の登録フォームに自動入力されません。だから左右がどれだけ独立に一致するかが、本人かどうかの材料になります。',
      why_diff: '相違があっても、それだけで否認する必要はありません。「聞いてみる理由」として使ってください。',
      no_app: 'この人はまだ業務情報の申請を出していません。会社名・担当者名を照合できないため、承認は保留にすることをおすすめします。',
      ref_title: '申告に相手が無い登録内容（参考）',
      f_displayname: 'ソムリン上の表示名',
      f_displayname_note: '担当者名とは別物です（ニックネーム。照合には使えません）',
      f_jobtitle: '役職',
      f_phone: '電話',
      f_urls: 'URL',
      from_card: '名刺の読み取りから入力',
      ai_title: 'AIの指摘（参考）',
      ai_note: 'AIは疑わしい点を挙げることしかできません。承認できるのは人だけです。',
      ai_none: '気になる点は挙がりませんでした。ただし、これは「承認してよい」という意味ではありません。判断はご自身で。',
      ai_failed: 'AIの確認が最後まで実行できませんでした（指摘が無かったわけではありません）。',
      decide_note_ph: '判断のメモ（任意・記録に残ります）',
      approve: '承認する',
      reject: '否認する',
      consequence: '承認すると、この人は正式な業務店になり、自分でも招待を発行できるようになります。責任はあなたが持ちます。',
      approve_confirm: '{who} を業務店として承認します。\n\n・この人は正式な業務店になります\n・この人自身も招待を発行できるようになります\n・責任はあなたが持ちます\n\n承認しますか？',
      reject_confirm: '{who} を否認します。\n\n・この人は業務店として利用できなくなります\n・調査対象として記録されます\n\n否認しますか？',
      approved_done: '承認しました',
      rejected_done: '否認しました',
      deciding: '送信中…',
      err_generic: '通信に失敗しました。時間をおいてお試しください',
      loading: '読み込み中…',
      role_store: '飲食店・ホテル',
      role_retailer: '酒販店・卸',
      role_importer: 'インポーター',
      role_admin: '管理者',
      role_individual: '個人',
    },
    en: {
      section: 'Invitations',
      section_sub: 'Only people you invite and approve can become trade accounts',
      quota: 'This month',
      quota_used: '{used} / {max} issued',
      quota_note: 'Revoking does not return a slot',
      frozen: 'Issuing suspended',
      frozen_note: 'Please contact the Sommelin team',
      not_approved_note: 'You can issue invitations once your trade account is verified',
      issue_btn: '＋ Issue an invitation',
      issue_title: 'Issue an invitation',
      issue_lead: 'Write down who you are inviting. The invitee never sees this. It is what you will later compare against what they register themselves.',
      f_company: 'Company / venue',
      f_contact: 'Contact name',
      f_role: 'Business type',
      f_email: 'Email',
      f_note: 'Note (where you met, who referred them)',
      f_note_ph: 'e.g. Exchanged cards at the autumn tasting. Referred by Tanaka.',
      f_ttl: 'Valid for',
      ttl_days: '{n} days',
      optional: 'optional',
      issue_submit: 'Issue this invitation',
      issue_warn_autofill: 'None of this is pre-filled into their registration form (that is what keeps the comparison meaningful)',
      issuing: 'Issuing…',
      token_title: 'Invitation link created',
      token_once: 'This is the only time this link is shown',
      token_once_body: 'Once you close this, it cannot be shown again. Only a hash is stored on the server, so it cannot be recovered. Copy it before closing.',
      token_for: 'For',
      token_expires: 'Expires',
      copy: 'Copy link',
      copied: 'Copied',
      copy_fail: 'Could not copy. Please long-press to select and copy.',
      share: 'Share',
      token_close: 'I have saved it — close',
      token_close_confirm: 'You have not copied the link yet. It cannot be shown again. Close anyway?',
      list_title: 'Invitations you issued',
      list_empty: 'No invitations issued yet',
      st_awaiting_decision: 'Awaiting your decision',
      st_active: 'Active',
      st_approved: 'Approved',
      st_rejected: 'Rejected',
      st_expired: 'Expired',
      st_revoked: 'Revoked',
      issued_at: 'Issued',
      expires_in: '{n} days left',
      expires_today: 'Expires today',
      used_at: 'Registered',
      decided_at: 'Decided',
      revoke: 'Revoke',
      revoke_confirm: 'Revoke this invitation link? The recipient will no longer be able to register with it.',
      revoke_done: 'Invitation revoked',
      link_gone: 'The link is shown only once, at the moment it is issued',
      pending_title: 'Waiting for your decision',
      pending_lead: 'You decide whether to recognise this person as a trade account.',
      memo_label: 'The note you wrote when inviting',
      memo_none: '(no note)',
      cmp_left: 'What you declared',
      cmp_right: 'What they registered',
      v_match: 'match',
      v_match_loose: 'match (formatting differs)',
      v_diff: 'differs',
      v_no_hint: 'not declared',
      v_no_value: 'not registered',
      blank: '—',
      why: 'Your note is never pre-filled into their form. That is why the two sides matching independently tells you something.',
      why_diff: 'A difference is not by itself a reason to reject — treat it as a reason to ask.',
      no_app: 'This person has not submitted their business details yet. Company and contact name cannot be compared, so holding off on approval is advised.',
      ref_title: 'Registered details with nothing to compare against',
      f_displayname: 'Sommelin display name',
      f_displayname_note: 'Not the same as the contact name (a nickname — not usable for comparison)',
      f_jobtitle: 'Job title',
      f_phone: 'Phone',
      f_urls: 'URLs',
      from_card: 'Entered from a scanned business card',
      ai_title: 'AI observations (for reference)',
      ai_note: 'The AI can only raise doubts. Only a person can approve.',
      ai_none: 'Nothing was flagged. That is not the same as "safe to approve" — the judgement is yours.',
      ai_failed: 'The AI check did not complete (this does not mean there was nothing to flag).',
      decide_note_ph: 'Note on your decision (optional, kept on record)',
      approve: 'Approve',
      reject: 'Reject',
      consequence: 'Approving makes this person a verified trade account, able to issue invitations of their own. You carry the responsibility.',
      approve_confirm: 'Approve {who} as a trade account.\n\n• They become a verified trade account\n• They will be able to issue invitations of their own\n• You carry the responsibility\n\nApprove?',
      reject_confirm: 'Reject {who}.\n\n• They will not be able to use the trade features\n• The case is recorded for review\n\nReject?',
      approved_done: 'Approved',
      rejected_done: 'Rejected',
      deciding: 'Sending…',
      err_generic: 'Connection failed. Please try again later.',
      loading: 'Loading…',
      role_store: 'Restaurant / hotel',
      role_retailer: 'Retailer / wholesaler',
      role_importer: 'Importer',
      role_admin: 'Admin',
      role_individual: 'Personal',
    },
  };
  // サーバーのエラーメッセージは日本語のみ。英語表示のときだけこちらで言い換える
  // （握り潰さない。未知のコードはサーバーの文言をそのまま出す）。
  var ERR_EN = {
    inviter_not_business: 'Only trade accounts can issue invitations.',
    inviter_not_approved: 'You can issue invitations once your trade account is verified.',
    invites_frozen: 'Issuing from this account is currently suspended. Please contact the Sommelin team.',
    monthly_quota_exceeded: 'You have used all of this month\'s invitations.',
    invite_not_revocable: 'This invitation cannot be revoked (already used or revoked).',
    invite_not_used_yet: 'Nobody has registered with this invitation yet, so there is nothing to decide.',
    already_decided: 'This invitation has already been decided.',
    rate_limited: 'Too many attempts. Please wait a moment.',
  };
  function T(k, vars) {
    var s = (DICT[lang()] && DICT[lang()][k]) || DICT.ja[k] || k;
    if (vars) for (var v in vars) s = s.split('{' + v + '}').join(vars[v]);
    return s;
  }
  function roleLabel(r) {
    var m = { store: 'role_store', retailer: 'role_retailer', importer: 'role_importer', admin: 'role_admin', individual: 'role_individual' };
    return m[r] ? T(m[r]) : r;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function token() {
    try { var s = JSON.parse(localStorage.getItem('sommelin_session') || 'null'); return (s && s.access_token) || ''; } catch (e) { return ''; }
  }
  function toast(msg) {
    if (typeof window.showToast === 'function') { window.showToast(msg); return; }
    alert(msg);
  }
  function fmtDate(iso, withTime) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var s = d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
    if (withTime) s += ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return s;
  }
  function daysLeft(iso) {
    if (!iso) return null;
    var ms = new Date(iso).getTime() - Date.now();
    if (isNaN(ms)) return null;
    return Math.max(0, Math.ceil(ms / 86400000));
  }

  // ── APIの失敗を黙って飲み込まない。理由が分かるものは理由を出す ──
  async function call(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Authorization': 'Bearer ' + token() }, opts.headers || {});
    if (opts.body) opts.headers['Content-Type'] = 'application/json';
    var r = await fetch(API + path, opts);
    var d = null;
    try { d = await r.json(); } catch (e) {}
    if (!r.ok) {
      var code = (d && d.error) || '';
      var msg = (lang() === 'en' && ERR_EN[code]) || (d && d.message) || T('err_generic');
      var err = new Error(msg); err.code = code; err.status = r.status;
      throw err;
    }
    return d || {};
  }

  // ════════════════════════════════════════════════════════════
  // 照合（この画面の核）
  // ════════════════════════════════════════════════════════════
  // 表記ゆれ（全角/半角・空白・大小文字）だけを吸収する。ここで「株式会社」を
  // 落とすような意味の正規化までやると、本当の違いが一致に見えてしまう。
  // 判定は目安で、最終的に読むのは人。だから左右の生の値は必ずそのまま出す。
  function normalize(s) {
    return String(s == null ? '' : s)
      .replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[　\s・·]/g, '')
      .toLowerCase();
  }
  // 戻り値: 'match' | 'loose' | 'diff' | 'no_hint' | 'no_value'
  function verdictOf(hintVal, actualVal) {
    var h = String(hintVal == null ? '' : hintVal).trim();
    var a = String(actualVal == null ? '' : actualVal).trim();
    if (!h) return 'no_hint';       // 申告していない＝相違ではない
    if (!a) return 'no_value';      // 相手が書いていない
    if (h === a) return 'match';
    if (normalize(h) === normalize(a)) return 'loose';
    return 'diff';
  }
  function verdictChip(v) {
    if (v === 'match') return '<span class="si-v si-v-ok">✓ ' + T('v_match') + '</span>';
    if (v === 'loose') return '<span class="si-v si-v-ok">✓ ' + T('v_match_loose') + '</span>';
    if (v === 'diff') return '<span class="si-v si-v-diff">⚠ ' + T('v_diff') + '</span>';
    if (v === 'no_value') return '<span class="si-v si-v-none">' + T('v_no_value') + '</span>';
    return '<span class="si-v si-v-none">' + T('v_no_hint') + '</span>';
  }
  function cmpRow(label, hintVal, actualVal, verdict) {
    var diff = (verdict === 'diff');
    return '<div class="si-cmp-row">' +
      '<div class="si-cmp-label"><span>' + esc(label) + '</span>' + verdictChip(verdict) + '</div>' +
      '<div class="si-cmp-cells">' +
        '<div class="si-cell' + (diff ? ' si-cell-diff' : '') + (hintVal ? '' : ' si-cell-empty') + '">' + (hintVal ? esc(hintVal) : T('blank')) + '</div>' +
        '<div class="si-cell' + (diff ? ' si-cell-diff' : '') + (actualVal ? '' : ' si-cell-empty') + '">' + (actualVal ? esc(actualVal) : T('blank')) + '</div>' +
      '</div></div>';
  }

  // 招待時の申告 vs 実際の登録内容。並べるのが目的なので、
  // 片方が空でも行そのものは消さない（「書かなかった」も情報）。
  function compareBlock(inv) {
    var hint = inv.hint || {};
    var who = inv.invitee || {};
    // 業態は配列 vs 単一。申告した業態が実際のロールに含まれるかで見る
    var roles = (who.roles || []).filter(function (r) { return r !== 'individual'; });
    var roleActual = roles.map(roleLabel).join(' / ');
    var roleVerdict = !hint.role ? 'no_hint'
      : !roles.length ? 'no_value'
      : (roles.indexOf(hint.role) !== -1 ? 'match' : 'diff');
    // メールは招待レコードの email 列（宛先指定）を申告の控えとして使う場合がある
    var hintEmail = hint.email || inv.email || null;

    var rows =
      cmpRow(T('f_company'), hint.company, who.company, verdictOf(hint.company, who.company)) +
      cmpRow(T('f_contact'), hint.contactName, who.contactName, verdictOf(hint.contactName, who.contactName)) +
      cmpRow(T('f_role'), hint.role ? roleLabel(hint.role) : null, roleActual, roleVerdict) +
      cmpRow(T('f_email'), hintEmail, who.email, verdictOf(hintEmail, who.email));

    var anyDiff = [
      verdictOf(hint.company, who.company),
      verdictOf(hint.contactName, who.contactName),
      roleVerdict,
      verdictOf(hintEmail, who.email),
    ].indexOf('diff') !== -1;

    return '<div class="si-cmp">' +
      '<div class="si-cmp-head"><div>' + T('cmp_left') + '</div><div>' + T('cmp_right') + '</div></div>' +
      rows +
    '</div>' +
    '<div class="si-why">' + T('why') + (anyDiff ? '<br>' + T('why_diff') : '') + '</div>';
  }

  // 申告に相手が無い登録内容。照合はできないが「話が合うか」を人が見る材料になる。
  // 表示名(display_name)をここに置くのは意図的 — 担当者名の代わりに使わせないため。
  function referenceBlock(inv) {
    var who = inv.invitee || {};
    var urls = who.urls || {};
    var items = [];
    if (who.displayName) items.push([T('f_displayname'), esc(who.displayName) + '<div class="si-ref-note">' + T('f_displayname_note') + '</div>']);
    if (who.jobTitle) items.push([T('f_jobtitle'), esc(who.jobTitle)]);
    if (who.phone) items.push([T('f_phone'), esc(who.phone)]);
    var us = ['website', 'gmap', 'tabelog', 'instagram'].filter(function (k) { return urls[k]; });
    if (us.length) {
      items.push([T('f_urls'), us.map(function (k) {
        return '<a href="' + esc(urls[k]) + '" target="_blank" rel="noopener noreferrer">' + esc(urls[k]) + '</a>';
      }).join('<br>')]);
    }
    if (!items.length) return '';
    return '<details class="si-more"><summary>' + T('ref_title') + '</summary>' +
      items.map(function (it) {
        return '<div class="si-ref-row"><div class="si-ref-label">' + it[0] + '</div><div class="si-ref-val">' + it[1] + '</div></div>';
      }).join('') +
      (who.fromCard ? '<div class="si-ref-note">📇 ' + T('from_card') + '</div>' : '') +
    '</details>';
  }

  // AIの指摘。並べるのは「疑い」だけ。承認を勧める文言はここに絶対に出さない。
  // サーバー側(business.js §6-B)が返す形: {concerns:[{level,field,text}], aiFailed, urlsChecked}
  // 旧い形（配列 / {flags} / {reasons}）も一応読む。
  function aiConcerns(f) {
    if (!f) return [];
    var src = Array.isArray(f) ? f
      : Array.isArray(f.concerns) ? f.concerns
      : Array.isArray(f.flags) ? f.flags
      : Array.isArray(f.reasons) ? f.reasons
      : (typeof f === 'string' ? [f] : []);
    return src.map(function (x) {
      if (typeof x === 'string') return { level: 'note', text: x };
      return { level: (x && x.level === 'high') ? 'high' : 'note', text: (x && (x.text || x.message || x.reason)) || '' };
    }).filter(function (c) { return c.text; });
  }
  function aiBlock(inv) {
    var f = inv.aiFlags;
    if (!f) return '';                       // まだAIが走っていない＝何も言わない
    var list = aiConcerns(f);
    var failed = !!(f && f.aiFailed);
    var body;
    if (failed) {
      // 動かなかったことを「指摘なし」に見せない。承認者にはその区別が要る。
      body = '<div class="si-ai-failed">' + T('ai_failed') + '</div>';
    } else if (!list.length) {
      // ここが一番危ない表示。「指摘なし」は承認の推薦ではない、と必ず添える。
      body = '<div class="si-ai-none">' + T('ai_none') + '</div>';
    } else {
      body = '<ul class="si-ai-list">' + list.map(function (c) {
        return '<li class="' + (c.level === 'high' ? 'si-ai-high' : 'si-ai-note') + '">' +
          (c.level === 'high' ? '⚠ ' : '') + esc(c.text) + '</li>';
      }).join('') + '</ul>';
    }
    return '<div class="si-ai"><div class="si-ai-title">🤖 ' + T('ai_title') + '</div>' +
      body + '<div class="si-ai-note">' + T('ai_note') + '</div></div>';
  }

  // ════════════════════════════════════════════════════════════
  // 描画
  // ════════════════════════════════════════════════════════════
  var STATE_CLASS = {
    awaiting_decision: 'wait', active: 'ok', approved: 'ok',
    rejected: 'bad', expired: 'dim', revoked: 'dim',
  };
  function stateChip(st) {
    return '<span class="si-chip si-chip-' + (STATE_CLASS[st] || 'dim') + '">' + T('st_' + st) + '</span>';
  }
  function whoLabel(inv) {
    var who = inv.invitee || {}, hint = inv.hint || {};
    return who.company || who.contactName || hint.company || hint.contactName || who.displayName || '—';
  }

  // 承認待ちカード（この画面の主役。一覧の上に単独で出す）
  function pendingCard(inv) {
    var who = inv.invitee || {};
    return '<div class="si-card si-card-wait" id="si-inv-' + esc(inv.id) + '">' +
      '<div class="si-card-head">' + stateChip('awaiting_decision') +
        '<span class="si-when">' + T('used_at') + ' ' + fmtDate(inv.usedAt, true) + '</span></div>' +
      '<div class="si-pending-title">' + T('pending_title') + '</div>' +
      '<div class="si-pending-lead">' + T('pending_lead') + '</div>' +

      '<div class="si-memo"><div class="si-memo-label">' + T('memo_label') + '</div>' +
        '<div class="si-memo-body' + (inv.note ? '' : ' si-memo-empty') + '">' +
          (inv.note ? esc(inv.note) : T('memo_none')) + '</div></div>' +

      (who.hasApplication === false ? '<div class="si-warn">' + T('no_app') + '</div>' : '') +

      compareBlock(inv) +
      referenceBlock(inv) +
      aiBlock(inv) +

      '<textarea class="si-note-input" id="si-note-' + esc(inv.id) + '" rows="2" placeholder="' + T('decide_note_ph') + '"></textarea>' +
      // 承認と否認は同じ重み。承認を大きい主ボタンにすると「そちらが正解」に見えるが、
      // ここは信用を上げる操作＝人が引き受ける判断で、勧めていい選択肢ではない。
      // 申請未提出のときだけ承認側の塗りを外す（保留を勧める文言と画面が矛盾しないように）。
      // ※押せなくはしない。塞ぐのはサーバーの仕事で、ここは見た目の正直さの問題。
      '<div class="si-actions">' +
        '<button class="si-btn si-btn-approve' + (who.hasApplication === false ? ' si-btn-approve-weak' : '') + '"' +
          ' onclick="SommInvites.decide(\'' + esc(inv.id) + '\',true)">' + T('approve') + '</button>' +
        '<button class="si-btn si-btn-reject" onclick="SommInvites.decide(\'' + esc(inv.id) + '\',false)">' + T('reject') + '</button>' +
      '</div>' +
      // 何が起きるかは押す前に見えていること。confirmは反射で閉じられる。
      '<div class="si-consequence">' + T('consequence') + '</div>' +
    '</div>';
  }

  // 一覧の1行（承認待ち以外）
  function listRow(inv) {
    var st = inv.state || 'active';
    var hint = inv.hint || {};
    var sub = [];
    sub.push(T('issued_at') + ' ' + fmtDate(inv.createdAt));
    if (st === 'active') {
      var d = daysLeft(inv.expiresAt);
      if (d != null) sub.push(d <= 0 ? T('expires_today') : T('expires_in', { n: d }));
    }
    if (inv.usedAt) sub.push(T('used_at') + ' ' + fmtDate(inv.usedAt));
    if (inv.decidedAt) sub.push(T('decided_at') + ' ' + fmtDate(inv.decidedAt));

    var title = hint.company || hint.contactName || whoLabel(inv);
    var meta = [];
    if (hint.contactName && hint.company) meta.push(hint.contactName);
    if (hint.role) meta.push(roleLabel(hint.role));

    return '<div class="si-row">' +
      '<div class="si-row-main">' +
        '<div class="si-row-title">' + esc(title) + '</div>' +
        (meta.length ? '<div class="si-row-meta">' + esc(meta.join(' ・ ')) + '</div>' : '') +
        '<div class="si-row-sub">' + esc(sub.join(' ・ ')) + '</div>' +
        (inv.decisionNote ? '<div class="si-row-note">📝 ' + esc(inv.decisionNote) + '</div>' : '') +
      '</div>' +
      '<div class="si-row-side">' + stateChip(st) +
        (st === 'active' ? '<button class="si-link-btn" onclick="SommInvites.revoke(\'' + esc(inv.id) + '\')">' + T('revoke') + '</button>' : '') +
      '</div>' +
    '</div>';
  }

  function render() {
    if (!mountEl) return;
    var invites = data.invites || [];
    var q = data.quota || {};
    var pending = invites.filter(function (i) { return i.state === 'awaiting_decision'; });
    var rest = invites.filter(function (i) { return i.state !== 'awaiting_decision'; });
    var isAdmin = (opts.roles || []).indexOf('admin') !== -1;
    var showNotApproved = !isAdmin && opts.verificationStatus && opts.verificationStatus !== 'approved' && opts.verificationStatus !== 'verified';

    mountEl.innerHTML =
      '<div class="si-h">' + T('section') + '</div>' +
      '<div class="si-h-sub">' + T('section_sub') + '</div>' +

      (pending.length ? pending.map(pendingCard).join('') : '') +

      '<div class="si-quota">' +
        '<div><div class="si-quota-label">' + T('quota') + '</div>' +
        '<div class="si-quota-val">' + T('quota_used', { used: (q.issuedThisMonth || 0), max: (q.monthly != null ? q.monthly : '—') }) + '</div></div>' +
        (q.frozen
          ? '<div class="si-frozen">' + T('frozen') + '</div>'
          : '<button class="si-btn si-btn-issue" onclick="SommInvites.openIssue()">' + T('issue_btn') + '</button>') +
      '</div>' +
      '<div class="si-quota-note">' + (q.frozen ? esc(q.frozenReason || '') + ' ' + T('frozen_note') : T('quota_note')) + '</div>' +
      (showNotApproved ? '<div class="si-soft-note">' + T('not_approved_note') + '</div>' : '') +

      '<div class="si-list-title">' + T('list_title') + '</div>' +
      (rest.length ? rest.map(listRow).join('')
                   : (pending.length ? '' : '<div class="si-empty">' + T('list_empty') + '</div>')) +
      '<div class="si-foot">' + T('link_gone') + '</div>';
  }

  // ── 発行フォーム（モーダル） ──
  function openIssue() {
    var el = modal('si-issue');
    el.innerHTML =
      '<div class="si-modal-head"><div class="si-modal-title">' + T('issue_title') + '</div>' +
        '<button class="si-x" onclick="SommInvites.closeModal()">✕</button></div>' +
      '<div class="si-modal-body">' +
        '<div class="si-lead">' + T('issue_lead') + '</div>' +
        '<label class="si-label">' + T('f_company') + '</label>' +
        '<input class="si-input" id="si-f-company" type="text" autocomplete="off">' +
        '<label class="si-label">' + T('f_contact') + '</label>' +
        '<input class="si-input" id="si-f-contact" type="text" autocomplete="off">' +
        '<label class="si-label">' + T('f_role') + '</label>' +
        '<select class="si-input" id="si-f-role">' +
          '<option value="">' + T('blank') + '</option>' +
          '<option value="store">' + T('role_store') + '</option>' +
          '<option value="retailer">' + T('role_retailer') + '</option>' +
          '<option value="importer">' + T('role_importer') + '</option>' +
        '</select>' +
        '<label class="si-label">' + T('f_email') + ' <span class="si-opt">' + T('optional') + '</span></label>' +
        '<input class="si-input" id="si-f-email" type="email" autocomplete="off">' +
        '<label class="si-label">' + T('f_note') + '</label>' +
        '<textarea class="si-input" id="si-f-note" rows="3" placeholder="' + T('f_note_ph') + '"></textarea>' +
        '<label class="si-label">' + T('f_ttl') + '</label>' +
        '<select class="si-input" id="si-f-ttl">' +
          '<option value="7">' + T('ttl_days', { n: 7 }) + '</option>' +
          '<option value="14" selected>' + T('ttl_days', { n: 14 }) + '</option>' +
          '<option value="30">' + T('ttl_days', { n: 30 }) + '</option>' +
        '</select>' +
        '<div class="si-warn si-warn-soft">' + T('issue_warn_autofill') + '</div>' +
        '<button class="si-btn si-btn-primary" id="si-issue-btn" onclick="SommInvites.submitIssue()">' + T('issue_submit') + '</button>' +
      '</div>';
  }

  async function submitIssue() {
    var btn = document.getElementById('si-issue-btn');
    if (btn) { btn.disabled = true; btn.textContent = T('issuing'); }
    var val = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
    try {
      var res = await call('/api/business/invites', {
        method: 'POST',
        body: JSON.stringify({
          hint: {
            company: val('si-f-company') || null,
            contactName: val('si-f-contact') || null,
            role: val('si-f-role') || null,
            email: val('si-f-email') || null,
          },
          note: val('si-f-note') || null,
          ttlDays: parseInt(val('si-f-ttl'), 10) || 14,
        }),
      });
      showToken(res);
      load();   // 一覧と残枠を更新（背後で）
    } catch (e) {
      toast(e.message);
      if (btn) { btn.disabled = false; btn.textContent = T('issue_submit'); }
    }
  }

  // ── 生トークンの表示（1回きり） ──
  var tokenCopied = false;
  function showToken(res) {
    tokenCopied = false;
    var url = res.url || '';
    var inv = res.invite || {};
    var hint = inv.hint || {};
    var forWho = [hint.company, hint.contactName].filter(Boolean).join(' / ');
    var el = modal('si-token');
    el.innerHTML =
      '<div class="si-modal-head"><div class="si-modal-title">' + T('token_title') + '</div></div>' +
      '<div class="si-modal-body">' +
        '<div class="si-once"><div class="si-once-title">⚠ ' + T('token_once') + '</div>' +
          '<div class="si-once-body">' + T('token_once_body') + '</div></div>' +
        // 1行inputだと末尾が切れて「本当に正しいリンクか」を目で確かめられない。
        // 折り返して全文を出す（コピーが失敗したときに手で写す最後の退路でもある）。
        '<textarea class="si-token" id="si-token-url" rows="3" readonly onclick="this.select()">' + esc(url) + '</textarea>' +
        '<button class="si-btn si-btn-primary" onclick="SommInvites.copyToken()">📋 ' + T('copy') + '</button>' +
        (navigator.share ? '<button class="si-btn si-btn-ghost" onclick="SommInvites.shareToken()">' + T('share') + '</button>' : '') +
        '<div class="si-token-meta">' +
          (forWho ? '<div>' + T('token_for') + ': ' + esc(forWho) + '</div>' : '') +
          (inv.expiresAt ? '<div>' + T('token_expires') + ': ' + fmtDate(inv.expiresAt) + '</div>' : '') +
        '</div>' +
        '<button class="si-btn si-btn-ghost" onclick="SommInvites.closeToken()">' + T('token_close') + '</button>' +
      '</div>';
  }
  async function copyToken() {
    var el = document.getElementById('si-token-url');
    if (!el) return;
    var ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(el.value); ok = true; }
    } catch (e) {}
    if (!ok) {   // 古いSafari・非セキュアコンテキスト向けの退路
      try { el.select(); el.setSelectionRange(0, 99999); ok = document.execCommand('copy'); } catch (e) {}
    }
    tokenCopied = tokenCopied || ok;
    toast(ok ? T('copied') : T('copy_fail'));
  }
  async function shareToken() {
    var el = document.getElementById('si-token-url');
    if (!el || !navigator.share) return;
    try { await navigator.share({ text: el.value }); tokenCopied = true; } catch (e) {}
  }
  function closeToken() {
    // 控えないまま閉じると、その招待は誰にも渡せないまま枠だけ消える
    if (!tokenCopied && !confirm(T('token_close_confirm'))) return;
    closeModal();
  }

  // ── 取り消し ──
  async function revoke(id) {
    if (!confirm(T('revoke_confirm'))) return;
    try { await call('/api/business/invites/' + encodeURIComponent(id) + '/revoke', { method: 'POST', body: '{}' }); toast(T('revoke_done')); load(); }
    catch (e) { toast(e.message); }
  }

  // ── 承認／否認（本許可。取り消せないので、何が起きるかを先に見せる） ──
  async function decide(id, approve) {
    var inv = (data.invites || []).filter(function (i) { return i.id === id; })[0] || {};
    var who = whoLabel(inv);
    if (!confirm(T(approve ? 'approve_confirm' : 'reject_confirm', { who: who }))) return;
    var noteEl = document.getElementById('si-note-' + id);
    var card = document.getElementById('si-inv-' + id);
    var btns = card ? card.querySelectorAll('button') : [];
    for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; }
    try {
      await call('/api/business/invites/' + encodeURIComponent(id) + '/decide', {
        method: 'POST',
        body: JSON.stringify({ approve: !!approve, note: (noteEl && noteEl.value.trim()) || null }),
      });
      toast(T(approve ? 'approved_done' : 'rejected_done'));
      load();
    } catch (e) {
      toast(e.message);
      for (var j = 0; j < btns.length; j++) { btns[j].disabled = false; }
      load();   // already_decided 等はサーバーが正。表示を実際の状態に合わせ直す
    }
  }

  // ── モーダルの器 ──
  function modal(id) {
    closeModal();
    var back = document.createElement('div');
    back.className = 'si-backdrop'; back.id = 'si-backdrop';
    back.onclick = function (e) { if (e.target === back && id !== 'si-token') closeModal(); };
    var sheet = document.createElement('div');
    sheet.className = 'si-sheet'; sheet.id = id;
    back.appendChild(sheet);
    document.body.appendChild(back);
    return sheet;
  }
  function closeModal() {
    var b = document.getElementById('si-backdrop');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  // ── 読み込み ──
  var mountEl = null, opts = {}, data = { invites: [], quota: {} };
  async function load() {
    try {
      data = await call('/api/business/invites', {});
    } catch (e) {
      if (mountEl) mountEl.innerHTML = '<div class="si-h">' + T('section') + '</div><div class="si-empty">' + esc(e.message) + '</div>';
      return;
    }
    render();
  }

  function mount(el, options) {
    mountEl = el; opts = options || {};
    if (!mountEl) return;
    injectStyle();
    mountEl.innerHTML = '<div class="si-h">' + T('section') + '</div><div class="si-empty">' + T('loading') + '</div>';
    load();
  }

  // 承認待ちの件数（👤ボタンのバッジ用）。画面を開かないと承認に気づけない状態を避ける。
  async function pendingCount() {
    try {
      var d = await call('/api/business/invites', {});
      return (d.invites || []).filter(function (i) { return i.state === 'awaiting_decision'; }).length;
    } catch (e) { return 0; }
  }

  // ── スタイル（ページ側と衝突しないよう si- 接頭辞で閉じる） ──
  function injectStyle() {
    if (document.getElementById('si-style')) return;
    var s = document.createElement('style');
    s.id = 'si-style';
    s.textContent = [
      '.si-h{font-size:11px;font-weight:800;color:#888;letter-spacing:.06em;margin:18px 0 2px;}',
      '.si-h-sub{font-size:11px;color:#999;line-height:1.5;margin-bottom:10px;}',
      '.si-empty{font-size:12.5px;color:#888;padding:10px 2px;line-height:1.6;}',
      '.si-foot{font-size:10.5px;color:#aaa;margin-top:10px;line-height:1.5;}',
      '.si-soft-note{font-size:11.5px;color:#8a6d3b;background:#fff8e6;border-radius:8px;padding:8px 10px;margin-top:8px;line-height:1.5;}',
      /* 枠 */
      '.si-quota{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#faf7f8;border:1px solid #eee;border-radius:12px;padding:11px 13px;}',
      '.si-quota-label{font-size:10.5px;color:#888;font-weight:700;}',
      '.si-quota-val{font-size:15px;font-weight:800;color:#2C1810;margin-top:1px;}',
      '.si-quota-note{font-size:10.5px;color:#aaa;margin:5px 2px 0;}',
      '.si-frozen{font-size:12px;font-weight:800;color:#c0392b;}',
      /* ボタン */
      '.si-btn{border:none;border-radius:11px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit;padding:11px 14px;}',
      '.si-btn:disabled{opacity:.55;cursor:default;}',
      '.si-btn-issue{background:#9B1B4B;color:#fff;flex-shrink:0;}',
      '.si-btn-primary{background:#9B1B4B;color:#fff;width:100%;margin-top:10px;padding:13px;font-size:14.5px;}',
      '.si-btn-ghost{background:#fff;color:#2C1810;border:1px solid #ddd;width:100%;margin-top:8px;}',
      '.si-link-btn{background:none;border:none;color:#c0392b;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;padding:4px 0 0;}',
      /* 一覧 */
      '.si-list-title{font-size:11px;font-weight:800;color:#888;letter-spacing:.06em;margin:16px 0 6px;}',
      '.si-row{display:flex;gap:10px;justify-content:space-between;background:#fff;border:1px solid #eee;border-radius:11px;padding:10px 12px;margin-bottom:7px;}',
      '.si-row-main{min-width:0;flex:1;}',
      '.si-row-title{font-size:13.5px;font-weight:800;color:#2C1810;word-break:break-word;}',
      '.si-row-meta{font-size:11.5px;color:#666;margin-top:1px;}',
      '.si-row-sub{font-size:10.5px;color:#aaa;margin-top:3px;line-height:1.5;}',
      '.si-row-note{font-size:11px;color:#666;margin-top:4px;background:#f7f7f7;border-radius:6px;padding:4px 7px;word-break:break-word;}',
      '.si-row-side{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;}',
      /* 状態チップ */
      '.si-chip{font-size:10px;font-weight:800;border-radius:20px;padding:3px 9px;white-space:nowrap;}',
      '.si-chip-wait{background:#fdecc8;color:#8a5a00;}',
      '.si-chip-ok{background:#e6f4ea;color:#1b7a3d;}',
      '.si-chip-bad{background:#fde8e8;color:#b02525;}',
      '.si-chip-dim{background:#f0f0f0;color:#888;}',
      /* 承認カード */
      '.si-card{border-radius:14px;padding:14px;margin-bottom:12px;}',
      '.si-card-wait{background:#fffdf7;border:1.5px solid #f0c26a;}',
      '.si-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;}',
      '.si-when{font-size:10.5px;color:#999;}',
      '.si-pending-title{font-size:15px;font-weight:800;color:#2C1810;}',
      '.si-pending-lead{font-size:11.5px;color:#777;line-height:1.55;margin:2px 0 10px;}',
      '.si-memo{background:#fff;border:1px solid #eee;border-radius:10px;padding:9px 11px;margin-bottom:10px;}',
      '.si-memo-label{font-size:10px;font-weight:800;color:#999;letter-spacing:.04em;margin-bottom:3px;}',
      '.si-memo-body{font-size:13px;color:#2C1810;line-height:1.6;word-break:break-word;white-space:pre-wrap;}',
      '.si-memo-empty{color:#bbb;}',
      '.si-warn{font-size:11.5px;color:#8a5a00;background:#fdf3dd;border-radius:9px;padding:9px 11px;margin-bottom:10px;line-height:1.55;}',
      '.si-warn-soft{color:#777;background:#f6f6f6;margin:10px 0 0;}',
      /* 照合表 */
      '.si-cmp{border:1px solid #e8dde1;border-radius:10px;overflow:hidden;background:#fff;}',
      '.si-cmp-head{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#e8dde1;}',
      '.si-cmp-head>div{background:#f6eef1;font-size:10px;font-weight:800;color:#9B1B4B;padding:6px 8px;text-align:center;line-height:1.3;}',
      '.si-cmp-row{border-top:1px solid #f0eaec;}',
      '.si-cmp-label{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10.5px;font-weight:800;color:#888;padding:7px 8px 4px;}',
      '.si-cmp-cells{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#f0eaec;}',
      '.si-cell{background:#fff;font-size:12.5px;color:#2C1810;padding:7px 8px 9px;line-height:1.45;word-break:break-word;min-height:32px;}',
      '.si-cell-diff{background:#fff7ed;}',
      '.si-cell-empty{color:#ccc;}',
      '.si-v{font-size:9.5px;font-weight:800;border-radius:20px;padding:2px 7px;white-space:nowrap;flex-shrink:0;}',
      '.si-v-ok{background:#e6f4ea;color:#1b7a3d;}',
      '.si-v-diff{background:#fde8d8;color:#a54b00;}',
      '.si-v-none{background:#f0f0f0;color:#999;}',
      '.si-why{font-size:10.5px;color:#8a7a7f;line-height:1.6;margin:7px 2px 0;}',
      /* 参考情報 */
      '.si-more{margin-top:9px;background:#fff;border:1px solid #eee;border-radius:10px;padding:8px 11px;}',
      '.si-more>summary{font-size:11.5px;font-weight:700;color:#777;cursor:pointer;}',
      '.si-ref-row{display:flex;gap:10px;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f4f4f4;font-size:12px;}',
      '.si-ref-label{color:#999;flex-shrink:0;}',
      '.si-ref-val{color:#2C1810;text-align:right;word-break:break-all;}',
      '.si-ref-val a{color:#9B1B4B;}',
      '.si-ref-note{font-size:10px;color:#aaa;margin-top:3px;line-height:1.4;}',
      /* AI */
      '.si-ai{margin-top:9px;background:#f7f7fa;border:1px solid #e6e6ee;border-radius:10px;padding:9px 11px;}',
      '.si-ai-title{font-size:11px;font-weight:800;color:#5a5a7a;margin-bottom:4px;}',
      '.si-ai-list{margin:0;padding-left:16px;font-size:11.5px;color:#444;line-height:1.6;}',
      '.si-ai-high{color:#a54b00;font-weight:700;}',
      '.si-ai-note{font-size:10px;color:#8a8aa0;margin-top:5px;line-height:1.5;}',
      '.si-ai-none{font-size:11.5px;color:#666;line-height:1.6;}',
      '.si-ai-failed{font-size:11.5px;color:#8a5a00;line-height:1.6;}',
      /* 決定 */
      '.si-note-input{width:100%;margin-top:10px;border:1px solid #e2d7db;border-radius:10px;padding:9px 11px;font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box;color:#2C1810;background:#fff;}',
      '.si-actions{display:flex;gap:8px;margin-top:9px;}',
      '.si-btn-approve{flex:1;background:#16803c;color:#fff;}',
      '.si-btn-approve-weak{background:#fff;color:#16803c;border:1.5px solid #b7d9c2;}',
      '.si-btn-reject{flex:1;background:#fff;color:#b02525;border:1.5px solid #e8bcbc;}',
      '.si-consequence{font-size:10.5px;color:#8a7a7f;line-height:1.6;margin:7px 2px 0;}',
      /* モーダル */
      '.si-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:400;display:flex;align-items:flex-end;justify-content:center;}',
      '.si-sheet{background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;max-height:92vh;overflow-y:auto;}',
      '.si-modal-head{position:sticky;top:0;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid #eee;z-index:1;}',
      '.si-modal-title{font-size:15px;font-weight:800;color:#2C1810;}',
      '.si-x{background:none;border:none;font-size:20px;color:#bbb;cursor:pointer;}',
      '.si-modal-body{padding:14px 18px 28px;}',
      '.si-lead{font-size:11.5px;color:#777;line-height:1.65;margin-bottom:14px;}',
      '.si-label{display:block;font-size:11px;font-weight:800;color:#888;margin:10px 0 4px;}',
      '.si-opt{font-weight:600;color:#bbb;}',
      '.si-input{width:100%;border:1px solid #e2d7db;border-radius:10px;padding:11px;font-size:14px;font-family:inherit;box-sizing:border-box;background:#fff;color:#2C1810;}',
      'textarea.si-input{resize:vertical;}',
      /* 生トークン */
      '.si-once{background:#fff4f4;border:1.5px solid #e8bcbc;border-radius:12px;padding:11px 13px;margin-bottom:12px;}',
      '.si-once-title{font-size:13px;font-weight:800;color:#b02525;margin-bottom:4px;}',
      '.si-once-body{font-size:11.5px;color:#7a4a4a;line-height:1.65;}',
      '.si-token{width:100%;display:block;border:1px solid #e2d7db;border-radius:10px;padding:11px;font-size:12px;line-height:1.55;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;box-sizing:border-box;background:#faf7f8;color:#2C1810;word-break:break-all;resize:vertical;}',
      '.si-token-meta{font-size:11.5px;color:#777;margin-top:12px;line-height:1.7;}',
    ].join('');
    document.head.appendChild(s);
  }

  window.SommInvites = {
    mount: mount, pendingCount: pendingCount,
    openIssue: openIssue, submitIssue: submitIssue,
    copyToken: copyToken, shareToken: shareToken, closeToken: closeToken,
    revoke: revoke, decide: decide, closeModal: closeModal,
  };
})();
