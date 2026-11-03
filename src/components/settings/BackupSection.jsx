import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { listBackups, backupUrl, saveBackupToStorage, downloadCloudBackup } from '../../utils/cloudBackup';

const label = (name) => {
  const m = /backup_(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/.exec(name);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일 ${m[4]}:${m[5]}` : name;
};

/**
 * 설정 → 백업 (관리자): 매주 자동 백업 목록, 지금 백업 만들기, 내 컴퓨터로 내려받기
 */
export default function BackupSection() {
  const { demoMode } = useAuth();
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      setList(await listBackups());
    } catch (err) {
      setList([]);
      setMsg(err.message);
    }
  };

  useEffect(() => { if (!demoMode) load(); }, [demoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (what, fn) => {
    setBusy(what);
    setMsg('');
    try {
      await fn();
    } catch (err) {
      setMsg(`실패했어요: ${err.message}`);
    } finally {
      setBusy('');
    }
  };

  if (demoMode) {
    return (
      <section className="settings-card">
        <header className="settings-card-head"><div><h2>백업</h2>
          <p className="settings-help">데모 화면은 이 기기(브라우저)에만 저장돼요. 위쪽의 '백업' 버튼으로 파일을 내려받을 수 있어요.</p>
        </div></header>
      </section>
    );
  }

  return (
    <section className="settings-card">
      <header className="settings-card-head">
        <div>
          <h2>백업</h2>
          <p className="settings-help">
            관리자가 사이트를 열면 <strong>일주일에 한 번</strong> 전체 기록(지점·모든 기록·휴지통·설정)을 자동으로 백업해 둬요. 최근 12개까지 보관해요.
            사진·서류 파일은 저장소에 그대로 있고, 백업에는 그 주소가 담겨요.
          </p>
        </div>
      </header>

      <div className="trash-actions" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy)}
          onClick={() => run('save', async () => { await saveBackupToStorage((p) => setMsg(`백업 중… ${p}`)); setMsg('백업을 만들었어요.'); await load(); })}>
          {busy === 'save' ? '백업 중…' : '지금 백업 만들기'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)}
          onClick={() => run('download', async () => { await downloadCloudBackup((p) => setMsg(`모으는 중… ${p}`)); setMsg('내 컴퓨터로 내려받았어요.'); })}>
          {busy === 'download' ? '모으는 중…' : '내 컴퓨터로 내려받기'}
        </button>
      </div>
      {msg && <p className="settings-help" role="status"><strong>{msg}</strong></p>}

      {list === null ? (
        <p className="settings-help">불러오는 중…</p>
      ) : list.length === 0 ? (
        <p className="settings-help">아직 만든 백업이 없어요.</p>
      ) : (
        <ul className="trash-list">
          {list.map(b => (
            <li key={b.path}>
              <span className="trash-kind">백업</span>
              <span className="trash-main"><strong>{label(b.name)}</strong></span>
              <span className="trash-actions">
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={() => run('', async () => { window.open(await backupUrl(b), '_blank', 'noopener'); })}>내려받기</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="settings-help" style={{ marginTop: 12 }}>백업으로 되돌려야 할 일이 생기면 백업 파일을 저(Claude)에게 주시면 복원해 드릴게요.</p>
    </section>
  );
}
