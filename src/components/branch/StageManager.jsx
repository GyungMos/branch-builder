import { useState } from 'react';
import { STAGE_STATUS, DEFAULT_STAGES } from '../../utils/constants';
import ModalPortal from '../common/ModalPortal';
import NeonIcon from '../common/NeonIcon';
import './StageManager.css';

export default function StageManager({ stages, onAdd, onUpdate, onDelete }) {
  const [newStageName, setNewStageName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [expandedStage, setExpandedStage] = useState(null);
  const [newCheckItem, setNewCheckItem] = useState('');

  const handleAddStage = async (e) => {
    e.preventDefault();
    if (!newStageName.trim()) return;
    await onAdd({
      name: newStageName.trim(),
      order: stages.length + 1,
      checklist: [],
    });
    setNewStageName('');
    setShowAddForm(false);
  };

  const handleStatusToggle = (stage) => {
    const statusFlow = ['waiting', 'progress', 'complete'];
    const currentIndex = statusFlow.indexOf(stage.status);
    const nextStatus = statusFlow[(currentIndex + 1) % statusFlow.length];
    onUpdate(stage.id, { status: nextStatus });
  };

  const handleLoadTemplate = async () => {
    for (const stage of DEFAULT_STAGES) {
      await onAdd({ name: stage.name, order: stage.order, checklist: [] });
    }
    setShowTemplates(false);
  };

  // --- 체크리스트 CRUD ---
  const handleAddCheckItem = (stage) => {
    if (!newCheckItem.trim()) return;
    const checklist = [...(stage.checklist || []), { id: Date.now().toString(), text: newCheckItem.trim(), done: false }];
    onUpdate(stage.id, { checklist });
    setNewCheckItem('');
  };

  const handleToggleCheckItem = (stage, itemId) => {
    const checklist = (stage.checklist || []).map(item =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    onUpdate(stage.id, { checklist });
  };

  const handleDeleteCheckItem = (stage, itemId) => {
    const checklist = (stage.checklist || []).filter(item => item.id !== itemId);
    onUpdate(stage.id, { checklist });
  };

  const completedCount = stages.filter(s => s.status === 'complete').length;
  const progress = stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;

  return (
    <div className="stage-manager" id="stage-manager">
      {stages.length > 0 && (
        <div className="stage-progress-summary">
          <div className="stage-progress-text">
            <span>{completedCount}/{stages.length} 단계 완료</span>
            <span className="text-accent font-semibold">{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="stage-list">
        {stages.map((stage, index) => {
          const statusInfo = STAGE_STATUS[stage.status] || STAGE_STATUS.waiting;
          const checklist = stage.checklist || [];
          const checkDone = checklist.filter(i => i.done).length;
          const isExpanded = expandedStage === stage.id;

          return (
            <div
              key={stage.id}
              className={`stage-item stage-${stage.status}`}
              id={`stage-${stage.id}`}
            >
              <div className="stage-connector">
                <div className={`stage-dot ${stage.status}`} onClick={() => handleStatusToggle(stage)} />
                {index < stages.length - 1 && <div className={`stage-line ${stage.status}`} />}
              </div>
              <div className="stage-content">
                <div className="stage-header">
                  <div className="stage-title-area" onClick={() => setExpandedStage(isExpanded ? null : stage.id)}>
                    <span className="stage-name">{stage.name}</span>
                    {checklist.length > 0 && (
                      <span className="stage-check-count">{checkDone}/{checklist.length}</span>
                    )}
                    <span className={`stage-expand-icon ${isExpanded ? 'expanded' : ''}`}>▸</span>
                  </div>
                  <div className="stage-actions">
                    <span className={`badge badge-${statusInfo.color === 'waiting' ? 'neutral' : statusInfo.color === 'progress' ? 'warning' : 'success'}`}>
                      {statusInfo.label}
                    </span>
                    <button
                      className="btn btn-ghost btn-sm stage-delete"
                      onClick={() => { if (window.confirm('이 단계를 삭제하시겠습니까?')) onDelete(stage.id); }}
                      aria-label="단계 삭제"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* 체크리스트 영역 */}
                {isExpanded && (
                  <div className="stage-checklist">
                    {checklist.length === 0 && (
                      <p className="checklist-empty">세부 할일을 추가하세요</p>
                    )}
                    {checklist.map(item => (
                      <div key={item.id} className={`checklist-item ${item.done ? 'done' : ''}`}>
                        <label className="checklist-checkbox">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => handleToggleCheckItem(stage, item.id)}
                          />
                          <span className="checkmark" />
                          <span className="checklist-text">{item.text}</span>
                        </label>
                        <button
                          className="btn btn-ghost btn-sm checklist-delete"
                          onClick={() => handleDeleteCheckItem(stage, item.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <form
                      className="checklist-add-form"
                      onSubmit={(e) => { e.preventDefault(); handleAddCheckItem(stage); }}
                    >
                      <input
                        type="text"
                        value={expandedStage === stage.id ? newCheckItem : ''}
                        onChange={(e) => setNewCheckItem(e.target.value)}
                        placeholder="할일 추가..."
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={!newCheckItem.trim()}>+</button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {stages.length === 0 && (
        <div className="stage-empty">
          <p className="text-secondary text-sm" style={{ marginBottom: 12 }}>
            아직 단계가 없습니다. 직접 추가하거나 기본 템플릿을 불러올 수 있습니다.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowTemplates(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <NeonIcon name="document" size="xs" color="cyan" badge={false} />
            <span>기본 템플릿 불러오기</span>
          </button>
        </div>
      )}

      {showTemplates && (
        <ModalPortal onClose={() => setShowTemplates(false)}>
          <div className="modal-backdrop" onClick={() => setShowTemplates(false)} />
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">기본 템플릿 불러오기</h2>
              <button className="modal-close" onClick={() => setShowTemplates(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="text-secondary text-sm">아래 7개 단계가 자동으로 추가됩니다:</p>
              <div className="template-list">
                {DEFAULT_STAGES.map((s, i) => (
                  <div key={i} className="template-item">
                    <span className="template-order">{s.order}</span>
                    <span>{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowTemplates(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleLoadTemplate}>불러오기</button>
            </div>
          </div>
        </ModalPortal>
      )}

      <div className="stage-add-area">
        {showAddForm ? (
          <form onSubmit={handleAddStage} className="stage-add-form">
            <input
              type="text"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="단계명을 입력하세요"
              autoFocus
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!newStageName.trim()}>추가</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowAddForm(false); setNewStageName(''); }}>취소</button>
          </form>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddForm(true)} id="add-stage-btn">
            + 단계 추가
          </button>
        )}
      </div>
    </div>
  );
}
