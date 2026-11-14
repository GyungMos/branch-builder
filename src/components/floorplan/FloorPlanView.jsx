import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useSubcollection } from '../../hooks/useSubcollection';
import ModalPortal from '../common/ModalPortal';
import FloorPlanner from './FloorPlanner';
import './FloorPlan.css';

const pickKey = (branchId) => `bb_fp_last_${branchId}`;
const PLAN_FIELDS = ['levels', 'items', 'walls', 'dims', 'bg', 'ceiling', 'vehicleH', 'wallT'];
/** 층이 있으면 모든 층을, 없으면 예전 칸을 합쳐 셈 */
const allOf = (l, k) => (Array.isArray(l.levels) && l.levels.length ? l.levels.flatMap(x => x[k] || []) : (l[k] || []));
const copyFields = (src) => Object.fromEntries(PLAN_FIELDS.filter(k => src[k] !== undefined).map(k => [k, JSON.parse(JSON.stringify(src[k]))]));

/**
 * 지점 '배치도' 화면: 배치안(1안·2안…) 고르기 + 배치 편집기
 * - 배치안: branches/{지점}/layouts
 * - 내 비품(직접 만든 비품): 모든 지점이 같이 쓰도록 branches/_shared/layoutLibrary
 */
export default function FloorPlanView({ branch, branchId, demoMode, equipments, branches = [], canDelete }) {
  const { items: layouts, loading, add, update, remove } = useSubcollection(branchId, 'layouts');
  const { items: myLibrary, add: addTpl, remove: removeTpl } = useSubcollection('_shared', 'layoutLibrary');
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(pickKey(branchId)) || ''; } catch { return ''; }
  });
  const [importOpen, setImportOpen] = useState(false);

  const active = layouts.find(l => l.id === activeId) || layouts[0] || null;

  useEffect(() => {
    if (active) { try { localStorage.setItem(pickKey(branchId), active.id); } catch { /* 저장 안 돼도 괜찮음 */ } }
  }, [active?.id, branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const createLayout = async (data = {}) => {
    const n = layouts.length + 1;
    const created = await add({ name: `${n}안`, items: [], walls: [], dims: [], bg: null, ...data, order: Date.now() });
    setActiveId(created.id);
  };

  const rename = () => {
    const name = window.prompt('배치안 이름', active.name || '');
    if (name && name.trim()) update(active.id, { name: name.trim() });
  };

  const duplicate = () => createLayout({ ...copyFields(active), name: `${active.name || '배치안'} 복사` });

  const del = async () => {
    if (!canDelete) { alert('지우기는 관리자만 할 수 있어요. 지워야 하면 관리자에게 부탁해 주세요.'); return; }
    if (!window.confirm(`'${active.name}' 배치안을 지울까요? 휴지통에서 30일 동안 되살릴 수 있어요.`)) return;
    await remove(active.id);
    setActiveId('');
  };

  if (loading) return <div className="fp-loading">배치도를 불러오는 중…</div>;

  return (
    <div className="fp-view">
      <div className="fp-layouts">
        <div className="fp-layout-pills">
          {layouts.map(l => (
            <button key={l.id} type="button" className={`filter-pill${active?.id === l.id ? ' on' : ''}`} onClick={() => setActiveId(l.id)}>{l.name || '배치안'}</button>
          ))}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => createLayout()}>+ 새 배치안</button>
        </div>
        {active && (
          <div className="fp-layout-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={rename}>이름 바꾸기</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={duplicate}>복사해서 새 안</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>다른 지점에서 가져오기</button>
            <button type="button" className="btn btn-ghost btn-sm fp-danger-text" onClick={del}>지우기</button>
          </div>
        )}
      </div>

      {active ? (
        <FloorPlanner
          key={active.id}
          layout={active}
          branch={branch}
          branchId={branchId}
          demoMode={demoMode}
          equipments={equipments}
          myLibrary={myLibrary}
          onSave={(data) => update(active.id, data)}
          onSaveTemplate={(tpl) => addTpl(JSON.parse(JSON.stringify(tpl)))}
          onRemoveTemplate={(id) => removeTpl(id).catch(() => alert('내 비품에서 빼는 것은 관리자만 할 수 있어요.'))}
        />
      ) : (
        <div className="fp-start card-static">
          <h3>배치도</h3>
          <p>도면 위에 리프트·장비·화장실 비품·책상 같은 것을 실제 크기로 놓아 보고, 겹치거나 작업 공간이 모자란 곳을 미리 찾아요.</p>
          <ul>
            <li>도면(그림·PDF)을 올리고 길이를 아는 곳 두 점만 찍으면 축척이 맞아요.</li>
            <li>도면이 없으면 건물 크기만 넣어서 벽을 만들 수 있어요.</li>
            <li>1안·2안처럼 여러 배치를 만들어 비교해요.</li>
          </ul>
          <div className="fp-btn-row">
            <button type="button" className="btn btn-primary" onClick={() => createLayout()}>배치도 시작하기</button>
            {branches.length > 1 && <button type="button" className="btn btn-secondary" onClick={() => setImportOpen(true)}>다른 지점 배치도 가져오기</button>}
          </div>
        </div>
      )}

      {importOpen && (
        <ImportLayoutModal
          branches={branches.filter(b => b.id !== branchId)}
          demoMode={demoMode}
          onClose={() => setImportOpen(false)}
          onImport={async (src, srcBranch) => {
            setImportOpen(false);
            await createLayout({ ...copyFields(src), name: `${srcBranch.name} ${src.name || ''}`.trim() });
          }}
        />
      )}
    </div>
  );
}

function ImportLayoutModal({ branches, demoMode, onClose, onImport }) {
  const [branchSel, setBranchSel] = useState(null);
  const [list, setList] = useState(null);

  useEffect(() => {
    if (!branchSel) return undefined;
    let alive = true;
    setList(null);
    (async () => {
      let rows = [];
      if (demoMode || !db) {
        try { rows = JSON.parse(localStorage.getItem(`bb_layouts_${branchSel.id}`) || '[]'); } catch { rows = []; }
      } else {
        const snap = await getDocs(collection(db, 'branches', branchSel.id, 'layouts'));
        rows = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      }
      if (alive) setList(rows);
    })().catch(() => alive && setList([]));
    return () => { alive = false; };
  }, [branchSel, demoMode]);

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">다른 지점 배치도 가져오기</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="fp-muted">가져온 배치는 이 지점의 새 배치안으로 복사돼요. 원래 지점 배치는 바뀌지 않아요.</p>
          <div className="fp-btn-row">
            {branches.map(b => (
              <button key={b.id} type="button" className={`filter-pill${branchSel?.id === b.id ? ' on' : ''}`} onClick={() => setBranchSel(b)}>{b.name}</button>
            ))}
          </div>
          {branchSel && (
            list === null ? <p className="fp-muted">불러오는 중…</p>
              : list.length === 0 ? <p className="fp-muted">이 지점에는 배치도가 없어요.</p>
                : (
                  <div className="fp-import-list">
                    {list.map(l => (
                      <button key={l.id} type="button" className="fp-import-item" onClick={() => onImport(l, branchSel)}>
                        <strong>{l.name || '배치안'}</strong>
                        <span>{l.levels?.length > 1 ? `${l.levels.length}개 층 · ` : ''}비품 {allOf(l, 'items').filter(i => !['zone', 'text', 'void'].includes(i.kind)).length}개 · 벽 {allOf(l, 'walls').length}개{l.bg || l.levels?.some(x => x.bg) ? ' · 도면 있음' : ''}</span>
                      </button>
                    ))}
                  </div>
                )
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
