import { useState } from 'react';
import NeonIcon from '../common/NeonIcon';
import { COMPLIANCE_TEMPLATES } from '../../utils/complianceTemplates';
import './ComplianceManager.css';

const STATUS_CONFIG = {
  fit: { label: '✅ 적합 완료', class: 'active-fit' },
  in_progress: { label: '🔄 보완/진행중', class: 'active-in_progress' },
  waiting: { label: '⏳ 점검 대기', class: 'active-waiting' },
  na: { label: '➖ 해당 없음', class: 'active-na' },
};

const CATEGORY_NAMES = {
  area: '📐 작업장 면적',
  equipment: '⚙️ 법정 장비',
  facility: '⚡ 전기/설비',
  environment: '🌿 환경/폐기물',
  safety: '🧯 소방/안전',
  admin: '🏛️ 인허가 행정',
};

export default function ComplianceManager({
  complianceItems,
  onUpdateStatus,
  onLoadTemplate,
  onAddItem,
  onDeleteItem,
  fitCount,
  progressPercent,
}) {
  const [selectedTemplate, setSelectedTemplate] = useState('specialized');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newReq, setNewReq] = useState('');
  const [newCat, setNewCat] = useState('facility');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredItems = complianceItems.filter(item => {
    if (filterStatus === 'all') return true;
    return item.status === filterStatus;
  });

  const handleTemplateChange = (e) => {
    const key = e.target.value;
    setSelectedTemplate(key);
    if (window.confirm(`선택한 '${COMPLIANCE_TEMPLATES[key]?.title}' 템플릿 항목으로 기준을 재설정하시겠습니까?`)) {
      onLoadTemplate(key);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await onAddItem({
      title: newTitle.trim(),
      requirement: newReq.trim(),
      category: newCat,
      status: 'waiting',
      memo: '',
    });
    setNewTitle('');
    setNewReq('');
    setShowAddForm(false);
  };

  return (
    <div className="compliance-section animate-fade-in">
      {/* 상단 현황 카드 */}
      <div className="compliance-hero-card">
        <div className="compliance-hero-main">
          <NeonIcon name="compliance" color="emerald" size="lg" />
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800 }}>정비업 법정 시설기준 & 인허가 점검</h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              자동차관리법 및 지자체 조례에 따른 정비업 등록 필수 면적, 장비, 환경, 소방 시설을 사전 점검합니다.
            </p>
          </div>
        </div>

        <div className="compliance-progress-box">
          <div className="compliance-progress-top">
            <span>법정 기준 충족률</span>
            <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>{progressPercent}%</span>
          </div>
          <div className="compliance-progress-bar-bg">
            <div className="compliance-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, textAlign: 'right' }}>
            적합 {fitCount} / 총 {complianceItems.length} 항목
          </div>
        </div>
      </div>

      {/* 템플릿 선택 및 액션 바 */}
      <div className="template-select-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            업종 템플릿:
          </span>
          <select
            value={selectedTemplate}
            onChange={handleTemplateChange}
            style={{ fontSize: 'var(--font-size-xs)', padding: '5px 10px', minWidth: 160 }}
          >
            <option value="specialized">전문정비업 (카센터/3급)</option>
            <option value="small">소형자동차정비업 (2급)</option>
            <option value="comprehensive">종합자동차정비업 (1급)</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            className={`status-toggle-btn ${filterStatus === 'all' ? 'active-fit' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            전체 ({complianceItems.length})
          </button>
          <button
            className={`status-toggle-btn ${filterStatus === 'waiting' ? 'active-waiting' : ''}`}
            onClick={() => setFilterStatus('waiting')}
          >
            대기
          </button>
          <button
            className={`status-toggle-btn ${filterStatus === 'in_progress' ? 'active-in_progress' : ''}`}
            onClick={() => setFilterStatus('in_progress')}
          >
            진행중
          </button>
          <button
            className={`status-toggle-btn ${filterStatus === 'fit' ? 'active-fit' : ''}`}
            onClick={() => setFilterStatus('fit')}
          >
            적합
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
            + 항목 추가
          </button>
        </div>
      </div>

      {/* 항목 추가 폼 */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="card-static" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>새 법정/인허가 점검 항목 추가</div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
            <select value={newCat} onChange={(e) => setNewCat(e.target.value)} style={{ fontSize: 12 }}>
              <option value="facility">전기/설비</option>
              <option value="area">작업장 면적</option>
              <option value="equipment">법정 장비</option>
              <option value="environment">환경/폐수</option>
              <option value="safety">소방/안전</option>
              <option value="admin">인허가 행정</option>
            </select>
            <input
              type="text"
              placeholder="점검 항목명 (예: 소음방지시설, 폐수 위탁계약)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              style={{ fontSize: 12 }}
            />
          </div>
          <input
            type="text"
            placeholder="법적 요구조건 및 세부 기준 (예: 관할 환경과 승인 필터 장착)"
            value={newReq}
            onChange={(e) => setNewReq(e.target.value)}
            style={{ fontSize: 12 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddForm(false)}>취소</button>
            <button type="submit" className="btn btn-primary btn-sm">추가</button>
          </div>
        </form>
      )}

      {/* 항목 리스트 */}
      <div className="compliance-list">
        {filteredItems.map(item => (
          <div key={item.id} className={`compliance-item-card status-${item.status}`}>
            <div className="compliance-item-top">
              <div>
                <div className="compliance-item-title">
                  <span className="compliance-cat-tag">{CATEGORY_NAMES[item.category] || item.category}</span>
                  <span>{item.title}</span>
                </div>
              </div>

              {/* 상태 토글 버튼 그룹 */}
              <div className="compliance-status-buttons">
                {Object.entries(STATUS_CONFIG).map(([stKey, stConf]) => (
                  <button
                    key={stKey}
                    type="button"
                    className={`status-toggle-btn ${item.status === stKey ? stConf.class : ''}`}
                    onClick={() => onUpdateStatus(item.id, stKey)}
                  >
                    {stConf.label}
                  </button>
                ))}
                {onDeleteItem && (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => onDeleteItem(item.id)}
                    title="항목 삭제"
                    style={{ color: 'var(--color-error)', padding: '2px 6px' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 법적 기준 안내문 */}
            {item.requirement && (
              <div className="compliance-item-req">
                ⚖️ <strong>법적 기준:</strong> {item.requirement}
              </div>
            )}

            {/* 현장 메모 및 구청 피드백 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>실사 메모:</span>
              <input
                type="text"
                className="compliance-memo-input"
                placeholder="구청 교통과 실사 피드백, 보완 조치 사항 등 입력 (엔터 시 저장)"
                defaultValue={item.memo || ''}
                onBlur={(e) => onUpdateStatus(item.id, item.status, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onUpdateStatus(item.id, item.status, e.target.value);
                    e.target.blur();
                  }
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
