import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useStages, useSchedules, useCosts, useDocuments, useBranches } from '../hooks/useFirestore';
import { useActivityLog } from '../hooks/useActivityLog';
import {
  usePartners,
  useCompliance,
  useEquipments,
  useDailyLogs,
  useBranchBudget,
} from '../hooks/useExtendedFeatures';
import { BRANCH_STATUS } from '../utils/constants';
import { useAuth } from '../contexts/AuthContext';
import NeonIcon from '../components/common/NeonIcon';

import BranchForm from '../components/branch/BranchForm';
import StageManager from '../components/branch/StageManager';
import PropertySpecs from '../components/branch/PropertySpecs';
import Timeline from '../components/schedule/Timeline';
import QuickScheduleForm from '../components/schedule/QuickScheduleForm';
import CostList from '../components/cost/CostList';
import QuickCostForm from '../components/cost/QuickCostForm';
import BudgetManager from '../components/cost/BudgetManager';
import DocumentList from '../components/document/DocumentList';
import DocumentUpload from '../components/document/DocumentUpload';
import PhotoGallery from '../components/document/PhotoGallery';
import ActivityLog from '../components/log/ActivityLog';
import PartnerList from '../components/partner/PartnerList';
import ComplianceManager from '../components/compliance/ComplianceManager';
import EquipmentList from '../components/equipment/EquipmentList';
import DailyLogList from '../components/log/DailyLogList';
import MobileNav from '../components/layout/MobileNav';
import LocalDataSyncBanner from '../components/common/LocalDataSyncBanner';
import { formatCurrency } from '../utils/formatters';
import './BranchDetailPage.css';

export default function BranchDetailPage() {
  const { branchId } = useParams();
  const navigate = useNavigate();
  const [branch, setBranch] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showCostForm, setShowCostForm] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [showBranchEdit, setShowBranchEdit] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editingCost, setEditingCost] = useState(null);
  const [loading, setLoading] = useState(true);

  const { demoMode } = useAuth();
  const { branches, updateBranch } = useBranches();
  const { stages, addStage, updateStage, deleteStage } = useStages(branchId);
  const { schedules, addSchedule, updateSchedule, deleteSchedule } = useSchedules(branchId);
  const { costs, addCost, updateCost, deleteCost, totalCost } = useCosts(branchId);
  const { documents, uploadDocument, deleteDocument } = useDocuments(branchId);
  const { logs, addLog } = useActivityLog(branchId);

  // 실무 6대 확장 기능 훅
  const { partners, addPartner, updatePartner, deletePartner } = usePartners(branchId);
  const {
    complianceItems,
    loadTemplate,
    updateItemStatus,
    addItem: addComplianceItem,
    deleteItem: deleteComplianceItem,
    fitCount,
    progressPercent: compliancePercent,
  } = useCompliance(branchId);
  const {
    equipments,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    totalEquipmentCost,
    installedCount,
  } = useEquipments(branchId);
  const {
    dailyLogs,
    addDailyLog,
    updateDailyLog,
    deleteDailyLog,
    addDailyLogEntry,
    updateDailyLogEntry,
    deleteDailyLogEntry,
  } = useDailyLogs(branchId);
  const { budget, updateBudget } = useBranchBudget(branchId, totalCost);

  useEffect(() => {
    if (!branchId) return;
    if (demoMode) {
      const found = branches.find(b => b.id === branchId);
      if (found) setBranch(found);
      else if (branches.length > 0) navigate('/');
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'branches', branchId), (snapshot) => {
      if (snapshot.exists()) setBranch({ id: snapshot.id, ...snapshot.data() });
      else navigate('/');
      setLoading(false);
    });
    return unsubscribe;
  }, [branchId, navigate, demoMode, branches]);

  if (loading || !branch) {
    return <div className="loading-overlay"><div className="spinner spinner-lg" /></div>;
  }

  const completedStages = stages.filter(s => s.status === 'complete').length;
  const progress = stages.length > 0 ? Math.round((completedStages / stages.length) * 100) : 0;

  // --- 핸들러들 ---
  const handleStatusChange = async (newStatus) => {
    await updateBranch(branchId, { status: newStatus });
    addLog('branch_update', `상태 변경: ${BRANCH_STATUS[newStatus]?.label}`);
  };

  const handleBranchEdit = async (data) => {
    await updateBranch(branchId, data);
    setShowBranchEdit(false);
    addLog('branch_update', `지점 정보 수정: ${data.name}`);
  };

  // 단계
  const handleAddStage = async (data) => {
    await addStage(data);
    addLog('stage_add', `단계 추가: ${data.name}`);
  };
  const handleUpdateStage = async (stageId, data) => {
    await updateStage(stageId, data);
    if (data.status) {
      const st = stages.find(s => s.id === stageId);
      addLog('stage_update', `단계 상태 변경: ${st?.name || ''} → ${data.status}`);
    }
    if (data.checklist) {
      addLog('checklist_toggle', `체크리스트 변경`);
    }
  };
  const handleDeleteStage = async (stageId) => {
    const st = stages.find(s => s.id === stageId);
    await deleteStage(stageId);
    addLog('stage_delete', `단계 삭제: ${st?.name || ''}`);
  };

  // 일정
  const handleEditSchedule = (schedule) => { setEditingSchedule(schedule); setShowScheduleForm(true); };
  const handleScheduleSubmit = async (data) => {
    if (editingSchedule) {
      await updateSchedule(editingSchedule.id, data);
      addLog('schedule_update', `일정 수정: ${data.title}`);
    } else {
      await addSchedule(data);
      addLog('schedule_add', `일정 추가: ${data.title}`);
    }
    setShowScheduleForm(false);
    setEditingSchedule(null);
  };
  const handleDeleteSchedule = async (scheduleId) => {
    const sc = schedules.find(s => s.id === scheduleId);
    await deleteSchedule(scheduleId);
    addLog('schedule_delete', `일정 삭제: ${sc?.title || ''}`);
  };

  // 비용
  const handleEditCost = (cost) => { setEditingCost(cost); setShowCostForm(true); };
  const handleCostSubmit = async (data) => {
    if (editingCost) {
      await updateCost(editingCost.id, data);
      addLog('cost_update', `비용 수정: ${data.title} (${data.amount}원)`);
    } else {
      await addCost(data);
      addLog('cost_add', `비용 추가: ${data.title} (${data.amount}원)`);
    }
    setShowCostForm(false);
    setEditingCost(null);
  };
  const handleDeleteCost = async (costId) => {
    const c = costs.find(x => x.id === costId);
    await deleteCost(costId);
    addLog('cost_delete', `비용 삭제: ${c?.title || ''}`);
  };

  // 서류
  const handleUploadDocument = async (file, metadata, onProgress) => {
    await uploadDocument(file, metadata, onProgress);
    addLog('doc_upload', `서류 업로드: ${file.name}`);
    setShowDocUpload(false);
  };
  const handleDeleteDocument = async (docId, storagePath) => {
    const d = documents.find(x => x.id === docId);
    await deleteDocument(docId, storagePath);
    addLog('doc_delete', `서류 삭제: ${d?.fileName || ''}`);
  };

  // 협력업체 핸들러
  const handleAddPartner = async (data) => {
    await addPartner(data);
    addLog('partner_add', `협력업체 등록: ${data.companyName}`);
  };
  const handleUpdatePartner = async (partnerId, data) => {
    await updatePartner(partnerId, data);
    addLog('partner_update', `협력업체 수정: ${data.companyName}`);
  };
  const handleDeletePartner = async (partnerId) => {
    const p = partners.find(x => x.id === partnerId);
    await deletePartner(partnerId);
    addLog('partner_delete', `협력업체 삭제: ${p?.companyName || ''}`);
  };

  // 장비 핸들러
  const handleAddEquipment = async (data) => {
    await addEquipment(data);
    addLog('equipment_add', `장비 등록: ${data.name}`);
  };
  const handleUpdateEquipment = async (equipId, data) => {
    await updateEquipment(equipId, data);
    addLog('equipment_update', `장비 상태 변경: ${data.name || ''}`);
  };
  const handleDeleteEquipment = async (equipId) => {
    const eq = equipments.find(x => x.id === equipId);
    await deleteEquipment(equipId);
    addLog('equipment_delete', `장비 삭제: ${eq?.name || ''}`);
  };

  // 현장 일일 일지 핸들러
  const handleAddDailyLog = async (data) => {
    await addDailyLog(data);
    addLog('dailylog_add', `현장 일지 작성: ${data.date} (${data.summary})`);
  };
  const handleUpdateDailyLog = async (logId, data) => {
    await updateDailyLog(logId, data);
    addLog('dailylog_update', `현장 일지 수정: ${data.date} (${data.summary})`);
  };
  const handleDeleteDailyLog = async (logId) => {
    await deleteDailyLog(logId);
    addLog('dailylog_delete', `현장 일지 삭제`);
  };
  const handleAddDailyLogEntry = async (logId, entryData) => {
    await addDailyLogEntry(logId, entryData);
    addLog('dailylog_entry_add', `현장 일지 추가 작업/조치 등록: ${entryData.summary}`);
  };
  const handleUpdateDailyLogEntry = async (logId, entryId, entryData) => {
    await updateDailyLogEntry(logId, entryId, entryData);
    addLog('dailylog_entry_update', `현장 일지 추가 작업/조치 수정`);
  };
  const handleDeleteDailyLogEntry = async (logId, entryId) => {
    await deleteDailyLogEntry(logId, entryId);
    addLog('dailylog_entry_delete', `현장 일지 추가 작업/조치 삭제`);
  };

  // 예산 핸들러
  const handleUpdateBudget = async (newBudget) => {
    await updateBudget(newBudget);
    addLog('budget_update', `목표 예산 변경: ${newBudget.totalBudget}원`);
  };

  // 7대 탭 정의 (3D 네온 아이콘 적용)
  const tabs = [
    { id: 'overview', label: '개요/부동산', iconName: 'building', iconColor: 'cyan' },
    { id: 'schedule', label: '일정/현장일지', iconName: 'calendar', iconColor: 'blue' },
    { id: 'cost', label: '비용/예산', iconName: 'money', iconColor: 'amber' },
    { id: 'equipment', label: '장비/시설인허가', iconName: 'equipment', iconColor: 'violet' },
    { id: 'partner', label: '협력업체', iconName: 'partner', iconColor: 'coral' },
    { id: 'documents', label: '서류/사진', iconName: 'document', iconColor: 'emerald' },
    { id: 'log', label: '활동이력', iconName: 'history', iconColor: 'rose' },
  ];

  return (
    <div className="page branch-detail" id="branch-detail-page">
      <LocalDataSyncBanner />
      {/* 지점 헤더 */}
      <div className="branch-detail-header animate-fade-in-up">
        <div className="branch-detail-header-top">
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <NeonIcon name="building" color="emerald" size="md" />
              {branch.name}
            </h1>
            {branch.address && <p className="text-secondary text-sm" style={{ marginTop: 4 }}>📍 {branch.address}</p>}
          </div>
          <div className="branch-header-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowBranchEdit(true)} id="edit-branch-btn">
              ✏️ 지점/제원 수정
            </button>
            <select className="branch-status-select" value={branch.status} onChange={(e) => handleStatusChange(e.target.value)} id="branch-status-select">
              {Object.entries(BRANCH_STATUS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3D 네온 KPI 요약 카드 */}
        <div className="branch-summary-cards">
          <div className="summary-card">
            <NeonIcon name="dashboard" color="cyan" size="sm" badge={false} />
            <div>
              <div className="summary-value">{progress}%</div>
              <div className="summary-label">공정 진행률</div>
            </div>
            <div className="progress-bar" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderRadius: 0 }}>
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="summary-card">
            <NeonIcon name="money" color="amber" size="sm" badge={false} />
            <div>
              <div className="summary-value">{formatCurrency(totalCost)}</div>
              <div className="summary-label">총 집행 비용</div>
            </div>
          </div>

          <div className="summary-card">
            <NeonIcon name="equipment" color="violet" size="sm" badge={false} />
            <div>
              <div className="summary-value">{equipments.length} <span style={{ fontSize: 13, fontWeight: 400 }}>대</span></div>
              <div className="summary-label">정비 장비 (설치 {installedCount})</div>
            </div>
          </div>

          <div className="summary-card">
            <NeonIcon name="partner" color="coral" size="sm" badge={false} />
            <div>
              <div className="summary-value">{partners.length} <span style={{ fontSize: 13, fontWeight: 400 }}>개사</span></div>
              <div className="summary-label">협력업체 연락망</div>
            </div>
          </div>
        </div>
      </div>

      {/* PC 탭 바 */}
      <div className="tabs branch-tabs" id="branch-tabs" style={{ display: 'flex', overflowX: 'auto', gap: 4 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            id={`tab-${tab.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <NeonIcon name={tab.iconName} color={tab.iconColor} size="sm" badge={false} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 탭 내용 영역 */}
      <div className="branch-tab-content animate-fade-in" key={activeTab}>
        {/* 1. 개요 & 부동산 제원 */}
        {activeTab === 'overview' && (
          <div className="tab-overview">
            <PropertySpecs property={branch.property} onEdit={() => setShowBranchEdit(true)} />

            <div className="overview-section">
              <div className="overview-section-header">
                <h3>📋 7단계 오픈 프로세스 & 체크리스트</h3>
              </div>
              <StageManager
                stages={stages}
                onAdd={handleAddStage}
                onUpdate={handleUpdateStage}
                onDelete={handleDeleteStage}
              />
            </div>

            {branch.description && (
              <div className="card-static" style={{ marginTop: 'var(--space-xl)' }}>
                <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: 6 }}>📝 지점 메모</h4>
                <p className="text-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>{branch.description}</p>
              </div>
            )}
          </div>
        )}

        {/* 2. 일정 타임라인 & 현장 일일 작업일지 */}
        {activeTab === 'schedule' && (
          <div className="tab-schedule" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xl)' }}>
            <div>
              <div className="tab-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <NeonIcon name="calendar" color="blue" size="sm" />
                  <h3>일정 타임라인 (간트차트)</h3>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditingSchedule(null); setShowScheduleForm(true); }}>
                  + 일정 추가
                </button>
              </div>
              <Timeline schedules={schedules} stages={stages} onEdit={handleEditSchedule} onDelete={handleDeleteSchedule} />
            </div>

            {/* 현장 일일 작업일지 통합 */}
            <DailyLogList
              branchId={branchId}
              dailyLogs={dailyLogs}
              onAdd={handleAddDailyLog}
              onUpdate={handleUpdateDailyLog}
              onDelete={handleDeleteDailyLog}
              onAddEntry={handleAddDailyLogEntry}
              onUpdateEntry={handleUpdateDailyLogEntry}
              onDeleteEntry={handleDeleteDailyLogEntry}
            />
          </div>
        )}

        {/* 3. 비용 관리 & 목표 예산 게이지 */}
        {activeTab === 'cost' && (
          <div className="tab-cost">
            {/* 목표 예산 vs 실지출 비교 게이지 */}
            <BudgetManager
              budget={budget}
              totalCost={totalCost}
              costs={costs}
              onUpdateBudget={handleUpdateBudget}
            />

            <div className="tab-header" style={{ marginTop: 'var(--space-xl)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NeonIcon name="money" color="amber" size="sm" />
                <h3>상세 지출 내역 (계좌 정보 포함)</h3>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditingCost(null); setShowCostForm(true); }}>
                + 지출 추가
              </button>
            </div>
            <CostList costs={costs} totalCost={totalCost} onEdit={handleEditCost} onDelete={handleDeleteCost} />
          </div>
        )}

        {/* 4. 정비 장비/리프트 대장 & 법정 시설/인허가 대장 */}
        {activeTab === 'equipment' && (
          <div className="tab-equipment" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xl)' }}>
            <EquipmentList
              equipments={equipments}
              onAdd={handleAddEquipment}
              onUpdate={handleUpdateEquipment}
              onDelete={handleDeleteEquipment}
              totalEquipmentCost={totalEquipmentCost}
              installedCount={installedCount}
            />

            <ComplianceManager
              complianceItems={complianceItems}
              onUpdateStatus={updateItemStatus}
              onLoadTemplate={loadTemplate}
              onAddItem={addComplianceItem}
              onDeleteItem={deleteComplianceItem}
              fitCount={fitCount}
              progressPercent={compliancePercent}
            />
          </div>
        )}

        {/* 5. 협력업체 / 거래처 연락망 */}
        {activeTab === 'partner' && (
          <div className="tab-partner">
            <PartnerList
              partners={partners}
              onAdd={handleAddPartner}
              onUpdate={handleUpdatePartner}
              onDelete={handleDeletePartner}
            />
          </div>
        )}

        {/* 6. 서류 & 사진 갤러리 */}
        {activeTab === 'documents' && (
          <div className="tab-documents" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xl)' }}>
            <div>
              <div className="tab-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <NeonIcon name="document" color="emerald" size="sm" />
                  <h3>인허가 및 계약 서류</h3>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowDocUpload(true)}>
                  + 서류 업로드
                </button>
              </div>
              <DocumentList documents={documents} onDelete={handleDeleteDocument} />
            </div>

            <div>
              <div className="tab-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <NeonIcon name="photo" color="rose" size="sm" />
                  <h3>현장 사진 갤러리</h3>
                </div>
              </div>
              <PhotoGallery documents={documents} />
            </div>
          </div>
        )}

        {/* 7. 활동 이력 로그 */}
        {activeTab === 'log' && (
          <div className="tab-log">
            <div className="tab-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NeonIcon name="history" color="rose" size="sm" />
                <h3>지점 활동 변경 이력</h3>
              </div>
            </div>
            <ActivityLog logs={logs} />
          </div>
        )}
      </div>

      {/* 모바일 하단 네비게이션 */}
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* 모달 팝업들 */}
      {showBranchEdit && (
        <BranchForm
          branch={branch}
          onSubmit={handleBranchEdit}
          onClose={() => setShowBranchEdit(false)}
        />
      )}

      {showScheduleForm && (
        <QuickScheduleForm
          schedule={editingSchedule}
          stages={stages}
          onSubmit={handleScheduleSubmit}
          onClose={() => { setShowScheduleForm(false); setEditingSchedule(null); }}
        />
      )}

      {showCostForm && (
        <QuickCostForm
          cost={editingCost}
          stages={stages}
          onSubmit={handleCostSubmit}
          onClose={() => { setShowCostForm(false); setEditingCost(null); }}
        />
      )}

      {showDocUpload && (
        <DocumentUpload
          stages={stages}
          onUpload={handleUploadDocument}
          onClose={() => setShowDocUpload(false)}
        />
      )}
    </div>
  );
}
