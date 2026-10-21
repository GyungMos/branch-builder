import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { useBranches } from '../hooks/useFirestore';
import { useMembers, usePeople } from '../hooks/useSettings';
import { createStaffAccount } from '../utils/staffAccounts';
import { displayLoginId, toLoginEmail, validateLoginId } from '../utils/loginId';
import { callNotion } from '../utils/notionSync';
import { loadBranchData } from '../utils/branchData';
import { syncBranchAll } from '../utils/notionBranchSync';
import './SettingsPage.css';

/** 담당자 명단: 오픈 계획·스케줄에서 고르는 이름 (계정과 별개) */
function PeopleSection({ canEdit }) {
  const { names, saveNames } = usePeople();
  const [input, setInput] = useState('');

  const add = async (e) => {
    e.preventDefault();
    const list = input.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    const next = [...names];
    list.forEach(n => { if (!next.includes(n)) next.push(n); });
    if (next.length !== names.length) await saveNames(next);
    setInput('');
  };

  const move = (i, dir) => {
    const next = [...names];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    saveNames(next);
  };

  return (
    <section className="settings-card">
      <h2>담당자 명단</h2>
      <p className="settings-help">오픈 계획·오픈 준비 스케줄에서 담당자1·담당자2로 고를 이름이에요. 로그인 계정이 없는 외부 협력자도 넣을 수 있어요.</p>
      {names.length === 0 ? (
        <p className="settings-empty">아직 명단이 비어 있어요.</p>
      ) : (
        <ul className="people-list">
          {names.map((n, i) => (
            <li key={n}>
              <span>{n}</span>
              {canEdit && (
                <span className="people-list-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} aria-label={`${n} 위로`} disabled={i === 0}>▲</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} aria-label={`${n} 아래로`} disabled={i === names.length - 1}>▼</button>
                  <button type="button" className="btn btn-ghost btn-sm settings-danger"
                    onClick={() => { if (window.confirm(`'${n}'을(를) 명단에서 뺄까요? 이미 지정된 항목에는 이름이 그대로 남아요.`)) saveNames(names.filter(x => x !== n)); }}>
                    빼기
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <form className="settings-inline-form" onSubmit={add}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="이름 (여러 명은 쉼표로: 김홍우, 진경태)" aria-label="추가할 이름" />
          <button type="submit" className="btn btn-primary btn-sm" disabled={!input.trim()}>추가</button>
        </form>
      ) : (
        <p className="settings-help">명단은 관리자만 고칠 수 있어요.</p>
      )}
    </section>
  );
}

/** 직원 계정 만들기 · 관리자 지정 (관리자만) */
function StaffSection() {
  const { demoMode, user } = useAuth();
  const members = useMembers();
  const { names, saveNames } = usePeople();
  const [form, setForm] = useState({ name: '', loginId: '', password: '', addToPeople: true });
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(null);
  const [existingEmail, setExistingEmail] = useState('');
  const myEmail = (user?.email || '').toLowerCase();

  const allowExisting = async (e) => {
    e.preventDefault();
    const email = existingEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMessage({ type: 'error', text: '이메일 주소를 정확히 입력해 주세요.' }); return; }
    if (members.emails.includes(email)) { setMessage({ type: 'error', text: '이미 허용된 계정이에요.' }); return; }
    await members.save({ emails: [...members.emails, email] });
    setMessage({ type: 'ok', text: `${email} 계정을 허용했어요.` });
    setExistingEmail('');
  };

  const accounts = [
    ...members.emails.map(email => {
      const s = members.staff.find(x => x.email === email);
      return { email, name: s?.name || (email === myEmail ? (user?.displayName || '나') : ''), loginId: displayLoginId(email) };
    }),
  ];

  const create = async (e) => {
    e.preventDefault();
    const idError = validateLoginId(form.loginId);
    if (idError) { setMessage({ type: 'error', text: idError }); return; }
    if (form.password.length < 6) { setMessage({ type: 'error', text: '임시 비밀번호는 6자리 이상으로 정해 주세요.' }); return; }
    const email = toLoginEmail(form.loginId);
    if (members.emails.includes(email)) { setMessage({ type: 'error', text: '이미 등록된 아이디예요.' }); return; }
    setWorking(true);
    setMessage(null);
    try {
      if (!demoMode) await createStaffAccount({ name: form.name.trim(), loginId: form.loginId, password: form.password });
      await members.save({
        emails: [...members.emails, email],
        staff: [...members.staff, { name: form.name.trim(), email, createdAt: new Date().toISOString() }],
      });
      if (form.addToPeople && form.name.trim() && !names.includes(form.name.trim())) {
        await saveNames([...names, form.name.trim()]);
      }
      setMessage({ type: 'ok', text: `'${form.name}' 계정을 만들었어요. 아이디 ${form.loginId.trim().toLowerCase()} / 임시 비밀번호를 직원에게 알려주세요.` });
      setForm({ name: '', loginId: '', password: '', addToPeople: true });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setWorking(false);
    }
  };

  const toggleAdmin = (email) => {
    const isAdm = members.admins.includes(email);
    if (isAdm && members.admins.length === 1) { window.alert('관리자는 최소 한 명 있어야 해요.'); return; }
    if (isAdm && email === myEmail && !window.confirm('내 계정의 관리자 권한을 해제할까요? 다른 관리자가 다시 지정해 줘야 돌아와요.')) return;
    members.save({ admins: isAdm ? members.admins.filter(a => a !== email) : [...members.admins, email] });
  };

  const disable = (email) => {
    if (email === myEmail) return;
    if (!window.confirm('이 계정의 사이트 사용을 막을까요? (보안 규칙을 게시한 뒤부터 로그인해도 기록을 볼 수 없어요)')) return;
    members.save({
      emails: members.emails.filter(x => x !== email),
      admins: members.admins.filter(x => x !== email),
    });
  };

  return (
    <section className="settings-card">
      <h2>직원 계정</h2>
      <p className="settings-help">직원은 <strong>아이디 + 비밀번호</strong>로 로그인해요. 비밀번호를 잊으면 '비밀번호 찾기' 메일이 가지 않으니, 관리자가 새 아이디로 다시 만들어 주세요.</p>

      <table className="settings-table">
        <thead><tr><th>이름</th><th>아이디</th><th>권한</th><th /></tr></thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.email}>
              <td>{a.name || '-'}</td>
              <td className="mono">{a.loginId}</td>
              <td>
                <button type="button" className={`role-chip ${members.admins.includes(a.email) ? 'admin' : ''}`} onClick={() => toggleAdmin(a.email)}
                  title="눌러서 관리자 지정/해제">
                  {members.admins.includes(a.email) ? '관리자' : '직원'}
                </button>
              </td>
              <td className="right">
                {a.email !== myEmail && (
                  <button type="button" className="btn btn-ghost btn-sm settings-danger" onClick={() => disable(a.email)}>사용 중지</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="settings-form" onSubmit={create}>
        <h3>새 직원 계정 만들기</h3>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="staff-name">이름</label>
            <input id="staff-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 진경태" required />
          </div>
          <div className="form-group">
            <label htmlFor="staff-id">아이디</label>
            <input id="staff-id" value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} placeholder="영문 소문자·숫자 (예: jin)" autoCapitalize="none" required />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="staff-pw">임시 비밀번호 (6자리 이상)</label>
          <input id="staff-pw" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" required />
        </div>
        <label className="settings-check">
          <input type="checkbox" checked={form.addToPeople} onChange={(e) => setForm({ ...form, addToPeople: e.target.checked })} />
          <span>담당자 명단에도 이름 추가</span>
        </label>
        {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}
        <button type="submit" className="btn btn-primary" disabled={working}>{working ? '만드는 중…' : '계정 만들기'}</button>
      </form>

      <form className="settings-form" onSubmit={allowExisting}>
        <h3>이미 이메일로 쓰던 계정 허용하기</h3>
        <p className="settings-help">예전에 이메일로 가입해서 쓰던 분이 있으면 여기서 허용해 주세요. 허용 목록에 없는 계정은 노션으로 보낼 수 없고, 보안 규칙을 게시한 뒤에는 기록도 볼 수 없어요.</p>
        <div className="settings-inline-form">
          <input type="email" value={existingEmail} onChange={(e) => setExistingEmail(e.target.value)} placeholder="name@example.com" aria-label="허용할 이메일" />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={!existingEmail.trim()}>허용</button>
        </div>
      </form>
    </section>
  );
}

/** 내 비밀번호 바꾸기 */
function MyAccountSection() {
  const { user, demoMode } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState(null);

  const change = async (e) => {
    e.preventDefault();
    if (next.length < 6) { setMessage({ type: 'error', text: '새 비밀번호는 6자리 이상으로 정해 주세요.' }); return; }
    try {
      if (!demoMode) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
        await updatePassword(user, next);
      }
      setMessage({ type: 'ok', text: '비밀번호를 바꿨어요.' });
      setCurrent('');
      setNext('');
    } catch (err) {
      setMessage({ type: 'error', text: err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' ? '지금 비밀번호가 맞지 않아요.' : err.message });
    }
  };

  return (
    <section className="settings-card">
      <h2>내 계정</h2>
      <p className="settings-help">로그인 아이디: <strong className="mono">{displayLoginId(user?.email)}</strong></p>
      <form className="settings-form" onSubmit={change}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="pw-current">지금 비밀번호</label>
            <input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="form-group">
            <label htmlFor="pw-next">새 비밀번호</label>
            <input id="pw-next" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          </div>
        </div>
        {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}
        <button type="submit" className="btn btn-secondary">비밀번호 바꾸기</button>
      </form>
    </section>
  );
}

/** 노션 연결 확인 · 전체 보내기 (관리자만) */
function NotionSection() {
  const { demoMode } = useAuth();
  const { branches, updateBranch } = useBranches();
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(null);
  const [onlyUnsynced, setOnlyUnsynced] = useState(true);

  const check = async () => {
    setStatus({ type: 'info', text: '확인하는 중…' });
    try {
      const res = await callNotion('ping');
      if (res.skipped) setStatus({ type: 'info', text: '데모 모드에서는 노션으로 보내지 않아요.' });
      else setStatus({ type: 'ok', text: `연결됐어요. 노션 페이지: "${res.parentTitle}"` });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    }
  };

  const sendAll = async () => {
    if (!window.confirm(`지점 ${branches.length}곳의 기록을 노션으로 보낼까요? 기록이 많으면 몇 분 걸려요. 이 화면을 닫지 말고 기다려 주세요.`)) return;
    let total = 0;
    let failed = 0;
    for (const [i, b] of branches.entries()) {
      setProgress({ text: `${b.name} 준비 중… (${i + 1}/${branches.length})` });
      const data = await loadBranchData(b.id, demoMode);
      const res = await syncBranchAll(b, data, {
        updateBranch,
        onlyUnsynced,
        onProgress: (p) => setProgress({ text: `${b.name}: ${p.done}/${p.total} 보냄${p.failed ? ` (실패 ${p.failed})` : ''} — 지점 ${i + 1}/${branches.length}` }),
      });
      total += res.total;
      failed += res.failed;
    }
    setProgress({ text: `끝났어요. ${total}건 중 ${total - failed}건 보냄${failed ? `, ${failed}건 실패 (각 기록의 '노션 !' 표시를 눌러 다시 보낼 수 있어요)` : ''}.`, done: true });
  };

  return (
    <section className="settings-card">
      <h2>노션 연결</h2>
      <p className="settings-help">사이트 → 노션 한 방향이에요. 오픈 계획 · 오픈 준비 스케줄 · 일정 · 비용 · 현장 일지를 저장하면 노션에 자동으로 반영돼요. 노션에서 고친 내용은 사이트로 돌아오지 않아요.</p>
      <div className="settings-actions">
        <button type="button" className="btn btn-secondary" onClick={check}>노션 연결 확인</button>
        <button type="button" className="btn btn-primary" onClick={sendAll} disabled={progress && !progress.done}>기존 기록 노션으로 보내기</button>
        <label className="settings-check">
          <input type="checkbox" checked={onlyUnsynced} onChange={(e) => setOnlyUnsynced(e.target.checked)} />
          <span>아직 안 보낸 것·실패한 것만</span>
        </label>
      </div>
      {status && <p className={`settings-msg ${status.type}`}>{status.text}</p>}
      {progress && <p className={`settings-msg ${progress.done ? 'ok' : 'info'}`}>{progress.text}</p>}
    </section>
  );
}

export default function SettingsPage() {
  const members = useMembers();

  if (members.loading) {
    return <div className="loading-overlay"><div className="spinner spinner-lg" /></div>;
  }

  return (
    <div className="page settings-page">
      <h1 className="page-title">설정</h1>

      {members.needsBootstrap && (
        <section className="settings-card settings-bootstrap">
          <h2>관리자 정하기</h2>
          <p className="settings-help">
            아직 관리자가 없어요. <strong>지금 로그인한 계정</strong>을 관리자로 지정하면 담당자 명단·직원 계정·노션 연결을 관리할 수 있어요.
            관리자는 나중에 여러 명으로 늘릴 수 있어요.
          </p>
          <button type="button" className="btn btn-primary" onClick={members.bootstrap}>이 계정을 관리자로 시작</button>
        </section>
      )}

      <PeopleSection canEdit={members.isAdmin} />
      {members.isAdmin && <StaffSection />}
      {members.isAdmin && <NotionSection />}
      <MyAccountSection />
    </div>
  );
}
