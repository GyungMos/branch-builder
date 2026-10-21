import { useEffect, useRef, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { useBranches } from '../hooks/useFirestore';
import { useMembers, usePeople } from '../hooks/useSettings';
import { PEOPLE_PALETTE, DEFAULT_STATUS_COLORS, colorForPerson } from '../contexts/PeopleContext';
import { PersonTag } from '../components/common/PeoplePicker';
import { createStaffAccount } from '../utils/staffAccounts';
import { displayLoginId, toLoginEmail, validateLoginId } from '../utils/loginId';
import { callNotion } from '../utils/notionSync';
import { loadBranchData } from '../utils/branchData';
import { syncBranchAll } from '../utils/notionBranchSync';
import './SettingsPage.css';

function Message({ msg }) {
  if (!msg) return null;
  return <p className={`settings-msg ${msg.type}`}>{msg.text}</p>;
}

/** 색 고르기 (담당자마다) */
function ColorSwatch({ color, onPick, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <span className="swatch-wrap" ref={ref}>
      <button type="button" className="swatch" style={{ '--sw': color }} onClick={() => setOpen(o => !o)} disabled={disabled}
        aria-label="색 바꾸기" title={disabled ? '' : '색 바꾸기'} />
      {open && (
        <span className="swatch-popover" role="listbox" aria-label="색 고르기">
          {PEOPLE_PALETTE.map(c => (
            <button key={c} type="button" role="option" aria-selected={c === color}
              className={`swatch ${c === color ? 'on' : ''}`} style={{ '--sw': c }}
              onClick={() => { onPick(c); setOpen(false); }} />
          ))}
        </span>
      )}
    </span>
  );
}

/** 담당자 명단: 오픈 계획·스케줄에서 고르는 이름과 색 (계정과 별개) */
function PeopleSection({ canEdit }) {
  const { names, colors, saveNames, saveColor } = usePeople();
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
      <header className="settings-card-head">
        <div>
          <h2>담당자 명단</h2>
          <p className="settings-help">오픈 계획·오픈 준비에서 담당자1·담당자2로 고를 이름이에요. 사람마다 색이 정해져서 <strong>색만 봐도 누구인지</strong> 알 수 있어요. 이름 왼쪽 색 점을 눌러 색을 바꿀 수 있어요.</p>
        </div>
      </header>

      {canEdit && (
        <form className="settings-inline-form" onSubmit={add}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="이름 추가 (여러 명은 쉼표로: 김홍우, 진경태)" aria-label="추가할 이름" />
          <button type="submit" className="btn btn-primary btn-sm" disabled={!input.trim()}>추가</button>
        </form>
      )}

      {names.length === 0 ? (
        <p className="settings-empty">아직 명단이 비어 있어요.</p>
      ) : (
        <ul className="people-grid">
          {names.map((n, i) => {
            const color = colorForPerson(n, names, colors);
            return (
              <li key={n} className="people-card" style={{ '--av': color }}>
                <ColorSwatch color={color} onPick={(c) => saveColor(n, c)} disabled={!canEdit} />
                <span className="people-card-name"><PersonTag name={n} color={color} /></span>
                {canEdit && (
                  <span className="people-card-actions">
                    <button type="button" className="icon-btn" onClick={() => move(i, -1)} aria-label={`${n} 위로`} disabled={i === 0}>↑</button>
                    <button type="button" className="icon-btn" onClick={() => move(i, 1)} aria-label={`${n} 아래로`} disabled={i === names.length - 1}>↓</button>
                    <button type="button" className="icon-btn danger" aria-label={`${n} 빼기`}
                      onClick={() => { if (window.confirm(`'${n}'을(를) 명단에서 뺄까요? 이미 지정된 항목에는 이름이 그대로 남아요.`)) saveNames(names.filter(x => x !== n)); }}>
                      ×
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!canEdit && <p className="settings-help">명단은 관리자만 고칠 수 있어요.</p>}
    </section>
  );
}

/** 오픈 계획 상태(시작 전·진행 중·완료) 색 */
const STATUS_ROWS = [
  { id: 'todo', label: '시작 전' },
  { id: 'doing', label: '진행 중' },
  { id: 'done', label: '완료' },
];

function StatusColorSection({ canEdit }) {
  const { statusColors, saveStatusColor } = usePeople();
  return (
    <section className="settings-card">
      <header className="settings-card-head">
        <div>
          <h2>오픈 계획 상태 색</h2>
          <p className="settings-help">보드의 칸 머리와 카드 상태에 쓰는 색이에요. 왼쪽 색 점을 눌러 바꿀 수 있어요.</p>
        </div>
      </header>
      <ul className="people-grid">
        {STATUS_ROWS.map(st => {
          const color = statusColors[st.id] || DEFAULT_STATUS_COLORS[st.id];
          return (
            <li key={st.id} className="people-card" style={{ '--av': color }}>
              <ColorSwatch color={color} onPick={(c) => saveStatusColor(st.id, c)} disabled={!canEdit} />
              <span className="people-card-name"><PersonTag name={st.label} color={color} /></span>
            </li>
          );
        })}
      </ul>
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

  const accounts = members.emails.map(email => {
    const s = members.staff.find(x => x.email === email);
    return { email, name: s?.name || (email === myEmail ? (user?.displayName || '나') : ''), loginId: displayLoginId(email) };
  });

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
      setMessage({ type: 'ok', text: `'${form.name}' 계정을 만들었어요. 아이디 ${form.loginId.trim().toLowerCase()} 와 임시 비밀번호를 직원에게 알려주세요.` });
      setForm({ name: '', loginId: '', password: '', addToPeople: true });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setWorking(false);
    }
  };

  const allowExisting = async (e) => {
    e.preventDefault();
    const email = existingEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMessage({ type: 'error', text: '이메일 주소를 정확히 입력해 주세요.' }); return; }
    if (members.emails.includes(email)) { setMessage({ type: 'error', text: '이미 허용된 계정이에요.' }); return; }
    await members.save({ emails: [...members.emails, email] });
    setMessage({ type: 'ok', text: `${email} 계정을 허용했어요.` });
    setExistingEmail('');
  };

  const toggleAdmin = (email) => {
    const isAdm = members.admins.includes(email);
    if (isAdm && members.admins.length === 1) { window.alert('관리자는 최소 한 명 있어야 해요.'); return; }
    if (isAdm && email === myEmail && !window.confirm('내 계정의 관리자 권한을 해제할까요? 다른 관리자가 다시 지정해 줘야 돌아와요.')) return;
    members.save({ admins: isAdm ? members.admins.filter(a => a !== email) : [...members.admins, email] });
  };

  const disable = (email) => {
    if (email === myEmail) return;
    if (!window.confirm('이 계정의 사이트 사용을 막을까요? 로그인해도 기록을 볼 수 없게 돼요.')) return;
    members.save({ emails: members.emails.filter(x => x !== email), admins: members.admins.filter(x => x !== email) });
  };

  return (
    <>
      <section className="settings-card">
        <header className="settings-card-head">
          <div>
            <h2>사용 중인 계정 <span className="settings-count">{accounts.length}</span></h2>
            <p className="settings-help">권한 표시를 눌러 <strong>관리자/직원</strong>을 바꿀 수 있어요. 관리자는 여러 명 둘 수 있어요.</p>
          </div>
        </header>
        <ul className="account-list">
          {accounts.map(a => {
            const admin = members.admins.includes(a.email);
            return (
              <li key={a.email} className="account-row">
                <span className="account-main">
                  <span className="account-name">{a.name || '이름 없음'}{a.email === myEmail && <span className="account-me">나</span>}</span>
                  <span className="account-id">{a.loginId}</span>
                </span>
                <button type="button" className={`role-chip ${admin ? 'admin' : ''}`} onClick={() => toggleAdmin(a.email)} title="눌러서 관리자 지정/해제">
                  {admin ? '관리자' : '직원'}
                </button>
                {a.email !== myEmail
                  ? <button type="button" className="icon-btn danger" onClick={() => disable(a.email)} title="사용 중지" aria-label={`${a.name} 사용 중지`}>⊘</button>
                  : <span className="icon-btn-space" />}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="settings-card">
        <header className="settings-card-head">
          <div>
            <h2>새 직원 계정 만들기</h2>
            <p className="settings-help">직원은 <strong>아이디 + 비밀번호</strong>로 로그인해요. 비밀번호를 잊으면 메일로 찾을 수 없으니, 관리자가 새 아이디로 다시 만들어 주세요.</p>
          </div>
        </header>
        <form className="settings-form-grid" onSubmit={create}>
          <div className="form-group">
            <label htmlFor="staff-name">이름</label>
            <input id="staff-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 진경태" required />
          </div>
          <div className="form-group">
            <label htmlFor="staff-id">아이디</label>
            <input id="staff-id" value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} placeholder="영문 소문자·숫자 (예: jin)" autoCapitalize="none" required />
          </div>
          <div className="form-group">
            <label htmlFor="staff-pw">임시 비밀번호</label>
            <input id="staff-pw" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="6자리 이상" autoComplete="new-password" required />
          </div>
          <label className="settings-check full">
            <input type="checkbox" checked={form.addToPeople} onChange={(e) => setForm({ ...form, addToPeople: e.target.checked })} />
            <span>담당자 명단에도 이름 추가</span>
          </label>
          <div className="full">
            <Message msg={message} />
            <button type="submit" className="btn btn-primary" disabled={working}>{working ? '만드는 중…' : '계정 만들기'}</button>
          </div>
        </form>
      </section>

      <section className="settings-card">
        <header className="settings-card-head">
          <div>
            <h2>이미 이메일로 쓰던 계정 허용하기</h2>
            <p className="settings-help">예전에 이메일로 가입해서 쓰던 분이 있으면 여기서 허용해 주세요. 허용 목록에 없는 계정은 기록을 볼 수 없어요.</p>
          </div>
        </header>
        <form className="settings-inline-form" onSubmit={allowExisting}>
          <input type="email" value={existingEmail} onChange={(e) => setExistingEmail(e.target.value)} placeholder="name@example.com" aria-label="허용할 이메일" />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={!existingEmail.trim()}>허용</button>
        </form>
      </section>
    </>
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
      <header className="settings-card-head">
        <div>
          <h2>{user?.displayName || '내 계정'}</h2>
          <p className="settings-help">로그인 아이디 <strong className="mono">{displayLoginId(user?.email)}</strong></p>
        </div>
      </header>
      <form className="settings-form-grid" onSubmit={change}>
        <div className="form-group">
          <label htmlFor="pw-current">지금 비밀번호</label>
          <input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </div>
        <div className="form-group">
          <label htmlFor="pw-next">새 비밀번호</label>
          <input id="pw-next" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" placeholder="6자리 이상" required />
        </div>
        <div className="full">
          <Message msg={message} />
          <button type="submit" className="btn btn-secondary">비밀번호 바꾸기</button>
        </div>
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
    setProgress({ text: `끝났어요. ${total}건 중 ${total - failed}건 보냄${failed ? `, ${failed}건 실패 (각 기록의 'N!' 표시를 눌러 다시 보낼 수 있어요)` : ''}.`, done: true });
  };

  return (
    <section className="settings-card">
      <header className="settings-card-head">
        <span className="notion-mark" aria-hidden="true">N</span>
        <div>
          <h2>노션 연결</h2>
          <p className="settings-help">사이트 → 노션 한 방향이에요. 오픈 계획·오픈 준비·일정·비용·현장 일지·서류/사진을 저장하면 노션에 자동으로 반영돼요. 노션에서 고친 내용은 사이트로 돌아오지 않아요.</p>
        </div>
      </header>
      <div className="notion-steps">
        <div className="notion-step">
          <span className="notion-step-num">1</span>
          <div>
            <strong>연결 확인</strong>
            <p className="settings-help">Netlify에 넣은 노션 키와 페이지가 맞는지 확인해요.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={check}>노션 연결 확인</button>
            <Message msg={status} />
          </div>
        </div>
        <div className="notion-step">
          <span className="notion-step-num">2</span>
          <div>
            <strong>기존 기록 보내기</strong>
            <p className="settings-help">처음 연결했을 때, 또는 실패한 기록을 한 번에 다시 보낼 때 써요.</p>
            <label className="settings-check">
              <input type="checkbox" checked={onlyUnsynced} onChange={(e) => setOnlyUnsynced(e.target.checked)} />
              <span>아직 안 보낸 것·실패한 것만</span>
            </label>
            <button type="button" className="btn btn-primary btn-sm" onClick={sendAll} disabled={progress && !progress.done}>기존 기록 노션으로 보내기</button>
            {progress && <Message msg={{ type: progress.done ? 'ok' : 'info', text: progress.text }} />}
          </div>
        </div>
      </div>
    </section>
  );
}

const TABS = [
  { id: 'people', label: '담당자·색' },
  { id: 'staff', label: '직원 계정', admin: true },
  { id: 'notion', label: '노션 연결', admin: true },
  { id: 'me', label: '내 계정' },
];

export default function SettingsPage() {
  const members = useMembers();
  const [tab, setTab] = useState('people');

  if (members.loading) {
    return <div className="loading-overlay"><div className="spinner spinner-lg" /></div>;
  }

  const tabs = TABS.filter(t => !t.admin || members.isAdmin);
  const active = tabs.some(t => t.id === tab) ? tab : 'people';

  return (
    <div className="page settings-page">
      <div className="settings-head">
        <h1 className="page-title">설정</h1>
        <p className="settings-help">담당자 명단과 직원 계정, 노션 연결을 관리해요.</p>
      </div>

      {members.needsBootstrap && (
        <section className="settings-card settings-bootstrap">
          <header className="settings-card-head">
            <div>
              <h2>관리자 정하기</h2>
              <p className="settings-help">
                아직 관리자가 없어요. <strong>지금 로그인한 계정</strong>을 관리자로 지정하면 담당자 명단·직원 계정·노션 연결을 관리할 수 있어요. 관리자는 나중에 여러 명으로 늘릴 수 있어요.
              </p>
            </div>
          </header>
          <button type="button" className="btn btn-primary" onClick={members.bootstrap}>이 계정을 관리자로 시작</button>
        </section>
      )}

      <nav className="settings-tabs" role="tablist" aria-label="설정 메뉴">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={active === t.id} className={active === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {active === 'people' && <PeopleSection canEdit={members.isAdmin} />}
      {active === 'people' && <StatusColorSection canEdit={members.isAdmin} />}
      {active === 'staff' && <StaffSection />}
      {active === 'notion' && <NotionSection />}
      {active === 'me' && <MyAccountSection />}
    </div>
  );
}
