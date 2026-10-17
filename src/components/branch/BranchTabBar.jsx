import { useEffect, useRef, useState } from 'react';
import NeonIcon from '../common/NeonIcon';
import { PRIMARY_TABS, MORE_TABS } from '../../constants/branchTabs';

/**
 * 지점 상세 탭 바 (PC): 자주 쓰는 탭 4개 + '더보기' 메뉴
 */
export default function BranchTabBar({ activeTab, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const activeMore = MORE_TABS.find(t => t.id === activeTab);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const select = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="segmented-tab-track branch-tabs" id="branch-tabs" role="tablist">
      {PRIMARY_TABS.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`segmented-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => select(tab.id)}
          id={`tab-${tab.id}`}
        >
          <NeonIcon name={tab.iconName} color={tab.color} size="sm" badge={false} />
          <span>{tab.label}</span>
        </button>
      ))}

      <div className="branch-tabs-more" ref={wrapRef}>
        <button
          type="button"
          className={`segmented-tab-btn ${activeMore ? 'active' : ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          id="tab-more"
        >
          {activeMore && <NeonIcon name={activeMore.iconName} color={activeMore.color} size="sm" badge={false} />}
          <span>{activeMore ? activeMore.label : '더보기'}</span>
          <span aria-hidden="true" className="branch-tabs-caret">▾</span>
        </button>
        {open && (
          <div className="branch-tabs-menu" role="menu">
            {MORE_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="menuitem"
                className={activeTab === tab.id ? 'active' : ''}
                onClick={() => select(tab.id)}
                id={`tab-${tab.id}`}
              >
                <NeonIcon name={tab.iconName} color={tab.color} size="sm" badge={false} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
