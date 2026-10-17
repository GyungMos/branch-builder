import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBranches } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { loadBranchData } from '../utils/branchData';
import { formatCurrency, formatDateShort } from '../utils/formatters';
import './SearchPage.css';

const TYPES = {
  branch: { label: '지점', tab: null },
  stage: { label: '단계·체크리스트', tab: 'stages' },
  lesson: { label: '다음 지점 메모', tab: 'stages' },
  schedule: { label: '일정', tab: 'schedule' },
  cost: { label: '비용', tab: 'cost' },
  document: { label: '서류·사진', tab: 'documents' },
  dailyLog: { label: '현장 일지', tab: 'schedule' },
  partner: { label: '협력업체', tab: 'partner' },
  equipment: { label: '장비', tab: 'equipment' },
};

const fmtDate = (v) => {
  if (!v) return '';
  const d = v.toDate ? v.toDate() : new Date(v);
  return isNaN(d.getTime()) ? '' : formatDateShort(d);
};

/** 지점 하나의 데이터를 검색용 항목 목록으로 펼침 */
function buildEntries(branch, data) {
  const out = [];
  const push = (type, title, text, meta = '') => out.push({ type, branch, title: title || '', text: text || '', meta });

  push('branch', branch.name, [branch.address, branch.description].filter(Boolean).join(' · '));
  (data.stages || []).forEach(s => {
    push('stage', s.name, (s.checklist || []).map(c => c.text).join(' · '));
    const l = s.lessons;
    if (l && (l.good || l.bad || l.next)) {
      push('lesson', s.name, [l.good && `잘된 점: ${l.good}`, l.bad && `아쉬운 점: ${l.bad}`, l.next && `다음 지점: ${l.next}`].filter(Boolean).join(' / '));
    }
  });
  (data.schedules || []).forEach(s => push('schedule', s.title, [s.memo, s.assignee, s.milestoneText].filter(Boolean).join(' · '), fmtDate(s.startDate)));
  (data.costs || []).forEach(c => push('cost', c.title, [c.vendor, c.assignee, c.memo, c.accountHolder].filter(Boolean).join(' · '), `${fmtDate(c.date)} ${formatCurrency(Number(c.amount) || 0)}`));
  (data.documents || []).forEach(d => push('document', d.name || d.fileName, [d.fileName, d.memo, d.requiredDoc].filter(Boolean).join(' · '), fmtDate(d.createdAt)));
  (data.dailyLogs || []).forEach(l => push('dailyLog', l.summary,
    [l.issues, l.equipmentUsed, l.author, ...(l.entries || []).map(e => [e.summary, e.issues].filter(Boolean).join(' '))].filter(Boolean).join(' · '),
    fmtDate(l.date)));
  (data.partners || []).forEach(p => push('partner', p.companyName, [p.contactName, p.phone, p.category, p.memo].filter(Boolean).join(' · ')));
  (data.equipments || []).forEach(e => push('equipment', e.name, [e.modelNumber, e.modelName, e.manufacturer, e.vendor, e.memo].filter(Boolean).join(' · ')));
  return out;
}

function Highlight({ text, words }) {
  if (!text || !words.length) return text || null;
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'));
  // split에 괄호 그룹을 쓰면 홀수 번째 조각이 일치한 부분
  return parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

/**
 * 통합 검색: 모든 지점의 일정·비용·서류·현장 일지·단계·메모·협력업체·장비를 한 번에 찾기
 */
export default function SearchPage() {
  const { demoMode } = useAuth();
  const { branches, loading: branchesLoading } = useBranches();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') || '');
  const [entries, setEntries] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const query = (params.get('q') || '').trim();

  useEffect(() => {
    if (branchesLoading) return;
    let cancelled = false;
    (async () => {
      const all = [];
      await Promise.all(branches.map(async b => {
        const data = await loadBranchData(b.id, demoMode);
        all.push(...buildEntries(b, data));
      }));
      if (!cancelled) setEntries(all);
    })();
    return () => { cancelled = true; };
  }, [branches, branchesLoading, demoMode]);

  const words = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);

  const results = useMemo(() => {
    if (!entries || !words.length) return [];
    return entries.filter(e => {
      const hay = `${e.title} ${e.text} ${e.meta} ${e.branch.name}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }, [entries, words]);

  const counts = results.reduce((m, r) => ({ ...m, [r.type]: (m[r.type] || 0) + 1 }), {});
  const shown = typeFilter === 'all' ? results : results.filter(r => r.type === typeFilter);

  const submit = (e) => {
    e.preventDefault();
    setTypeFilter('all');
    setParams(input.trim() ? { q: input.trim() } : {});
  };

  return (
    <div className="page search-page">
      <h1 className="page-title">통합 검색</h1>
      <form className="search-form" onSubmit={submit} role="search">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 리프트, 도로점용, 잔금, 업체 이름…"
          aria-label="검색어"
          autoFocus
        />
        <button type="submit" className="btn btn-primary">검색</button>
      </form>
      <p className="search-help">모든 지점의 일정·비용·서류·현장 일지·체크리스트·메모·협력업체·장비에서 찾아요. 여러 단어를 띄어 쓰면 모두 들어간 것만 보여줘요.</p>

      {!entries ? (
        <div className="search-loading"><div className="spinner" /> 자료를 불러오는 중…</div>
      ) : !query ? null : results.length === 0 ? (
        <div className="card-static">'{query}'에 맞는 자료가 없어요.</div>
      ) : (
        <>
          <div className="search-filters" aria-label="종류별 보기">
            <button type="button" className={`search-chip ${typeFilter === 'all' ? 'on' : ''}`} onClick={() => setTypeFilter('all')}>
              전체 {results.length}
            </button>
            {Object.entries(TYPES).filter(([k]) => counts[k]).map(([k, t]) => (
              <button key={k} type="button" className={`search-chip ${typeFilter === k ? 'on' : ''}`} onClick={() => setTypeFilter(k)}>
                {t.label} {counts[k]}
              </button>
            ))}
          </div>

          <ul className="search-results">
            {shown.slice(0, 200).map((r, i) => {
              const t = TYPES[r.type];
              const to = t.tab ? `/branch/${r.branch.id}?tab=${t.tab}` : `/branch/${r.branch.id}`;
              return (
                <li key={i}>
                  <Link to={to} className="search-result">
                    <div className="search-result-top">
                      <span className="search-type">{t.label}</span>
                      <span className="search-branch">{r.branch.name}</span>
                      {r.meta && <span className="search-meta">{r.meta}</span>}
                    </div>
                    <div className="search-title"><Highlight text={r.title} words={words} /></div>
                    {r.text && <div className="search-text"><Highlight text={r.text} words={words} /></div>}
                  </Link>
                </li>
              );
            })}
          </ul>
          {shown.length > 200 && <p className="search-help">결과가 많아 앞의 200개만 보여줘요. 단어를 더 넣어 좁혀 보세요.</p>}
        </>
      )}
    </div>
  );
}
