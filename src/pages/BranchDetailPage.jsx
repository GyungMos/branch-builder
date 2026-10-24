import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
import StageBook from '../components/branch/StageBook';
import CopyBranchModal from '../components/branch/CopyBranchModal';
import BranchTabBar from '../components/branch/BranchTabBar';
import Timeline from '../components/schedule/Timeline';
import ArchitectPresetModal from '../components/schedule/ArchitectPresetModal';
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
import DailyLogForm from '../components/log/DailyLogForm';
import BranchTimelineFeed from '../components/branch/BranchTimelineFeed';
import MobileNav from '../components/layout/MobileNav';
import LocalDataSyncBanner from '../components/common/LocalDataSyncBanner';
import { formatCurrency, toDateInputValue } from '../utils/formatters';
import { isScheduledCost, daysUntilDue } from '../utils/costs';
import { useSubcollection } from '../hooks/useSubcollection';
import { usePeople } from '../hooks/useSettings';
import OpenPlanBoard from '../components/openplan/OpenPlanBoard';
import OpenPlanEditor from '../components/openplan/OpenPlanEditor';
import OpenTaskTable from '../components/opentask/OpenTaskTable';
import OpenTaskForm from '../components/opentask/OpenTaskForm';
import AiAssistant from '../components/ai/AiAssistant';
import ImportTasksModal from '../components/opentask/ImportTasksModal';
import { syncToNotion, archiveNotionPage } from '../utils/notionBranchSync';
import { OPEN_TASK_GROUPS, OPEN_TASK_CATEGORIES } from '../utils/constants';
import './BranchDetailPage.css';

export default function BranchDetailPage({ initialTab }) {
  const { branchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // URL 경로 또는 파라미터 기반 초기 탭 결정
  const getInitialTab = () => {
    if (initialTab) return initialTab;
    if (location.pathname.endsWith('/timeline')) return 'timeline';
    const queryTab = searchParams.get('tab');
    if (queryTab === 'overview') return 'stages'; // 예전 주소 호환
    if (queryTab) return queryTab;
    return 'stages';
  };

  const [branch, setBranch] = useState(null);
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showCostForm, setShowCostForm] = useState(false);
  const [showDailyLogForm, setShowDailyLogForm] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [showBranchEdit, setShowBranchEdit] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editingCost, setEditingCost] = useState(null);
  const [formStageId, setFormStageId] = useState('');
  const [formRequiredDoc, setFormRequiredDoc] = useState(''); // 필수 서류 '올리기'로 열 때 서류 이름
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false); // 단계별 기록에서 + 버튼으로 열 때 미리 고를 단계
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

  // 오픈 계획 · 오픈 준비 스케줄 (노션에서 쓰던 양식)
  const { items: plans, add: addPlan, update: updatePlan, remove: removePlan } = useSubcollection(branchId, 'openPlans');
  const { items: tasks, add: addTask, update: updateTask, remove: removeTask } = useSubcollection(branchId, 'openTasks');
  const { names: people } = usePeople();
  const [planEditor, setPlanEditor] = useState(null); // { plan } 수정 또는 { status } 새 항목
  const [taskEditor, setTaskEditor] = useState(null); // { task } 수정 또는 { defaults } 새 항목
  const [showImportTasks, setShowImportTasks] = useState(false);
  const [showAi, setShowAi] = useState(false);

  // 노션 자동 전송: 저장한 기록을 줄 세워 두었다가, 최신 내용이 화면 상태에 들어오면 보냄 (사이트 저장은 기다리지 않음)
  const [notionQueue, setNotionQueue] = useState([]);
  const queueNotion = (kind, id) => {
    if (demoMode || !id) return;
    setNotionQueue(q => (q.some(x => x.kind === kind && x.id === id) ? q : [...q, { kind, id }]));
  };
  useEffect(() => {
    if (!notionQueue.length || !branch) return;
    const lists = { plan: plans, task: tasks, schedule: schedules, cost: costs, dailyLog: dailyLogs, document: documents };
    const ready = notionQueue.filter(q => lists[q.kind].some(rec => rec.id === q.id));
    if (!ready.length) return;
    setNotionQueue(q => q.filter(x => !ready.includes(x)));
    ready.forEach(q => {
      syncToNotion(q.kind, branch, lists[q.kind].find(rec => rec.id === q.id), { updateBranch, stages });
    });
  }, [notionQueue, plans, tasks, schedules, costs, dailyLogs, documents, branch, stages, updateBranch]);

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
  // 새 현장 일지의 기본 단계: 진행중인 단계
  const currentStageId = [...stages].sort((a, b) => (a.order || 0) - (b.order || 0)).find(s => s.status === 'progress')?.id || '';
  const progress = stages.length > 0 ? Math.round((completedStages / stages.length) * 100) : 0;

  // 종료 예정일이 지났는데 완료되지 않은 지연 공정 일정 계산
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const delayedSchedules = schedules.filter(s => {
    if (s.status === 'completed' || s.status === 'complete') return false;
    if (!s.endDate) return false;
    const end = s.endDate?.toDate ? s.endDate.toDate() : new Date(s.endDate);
    return end < todayDate;
  });

  // 지급 예정일이 지났는데 아직 지급 완료 처리가 안 된 비용
  const overduePayments = costs.filter(c => isScheduledCost(c) && (daysUntilDue(c) ?? 1) < 0);

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
    if (data.lessons) {
      const st = stages.find(s => s.id === stageId);
      addLog('stage_update', `다음 지점 메모 저장: ${st?.name || ''}`);
    }
  };
  const handleDeleteStage = async (stageId) => {
    const st = stages.find(s => s.id === stageId);
    await deleteStage(stageId);
    addLog('stage_delete', `단계 삭제: ${st?.name || ''}`);
  };
  // 기존 단계를 표준 단계 이름·순서로 맞춤 (단계 id 유지 → 연결된 기록 그대로)
  const handleStandardizeStages = async (plan) => {
    for (const u of plan.updates) {
      if (u.stage.name !== u.name || u.stage.order !== u.order) {
        await updateStage(u.stage.id, { name: u.name, order: u.order });
      }
    }
    for (const e of plan.extras) {
      if (e.stage.order !== e.order) await updateStage(e.stage.id, { order: e.order });
    }
    for (const a of plan.adds) {
      await addStage(a);
    }
    addLog('stage_update', `단계를 표준 ${plan.updates.length + plan.adds.length}단계로 맞춤 (이름 변경 ${plan.renames.length}개, 추가 ${plan.adds.length}개)`);
  };

  // 일정
  const handleEditSchedule = (schedule) => { setEditingSchedule(schedule); setShowScheduleForm(true); };
  const handleScheduleSubmit = async (data) => {
    if (editingSchedule) {
      await updateSchedule(editingSchedule.id, data);
      queueNotion('schedule', editingSchedule.id);
      addLog('schedule_update', `일정 수정: ${data.title}`);
    } else {
      const created = await addSchedule(data);
      queueNotion('schedule', created?.id);
      addLog('schedule_add', `일정 추가: ${data.title}`);
    }
    setShowScheduleForm(false);
    setEditingSchedule(null);
    setFormStageId('');
  };
  const handleToggleScheduleComplete = async (schedule) => {
    const done = schedule.status === 'completed' || schedule.status === 'complete';
    await updateSchedule(schedule.id, { status: done ? 'pending' : 'completed' });
    queueNotion('schedule', schedule.id);
    addLog('schedule_update', `일정 ${done ? '완료 취소' : '완료'}: ${schedule.title}`);
  };
  const handleDeleteSchedule = async (scheduleId) => {
    const sc = schedules.find(s => s.id === scheduleId);
    await deleteSchedule(scheduleId);
    archiveNotionPage(sc?.notionPageId);
    addLog('schedule_delete', `일정 삭제: ${sc?.title || ''}`);
  };

  // 설계사 표준 신축공정 일정 일괄 등록 (시작일 기준으로 계산된 일정)
  const handleAddArchitectPreset = async (items) => {
    try {
      for (const item of items) {
        const created = await addSchedule(item);
        queueNotion('schedule', created?.id);
      }
      addLog('schedule_add', `설계사 표준 신축공정 ${items.length}개 일괄 등록 (시작일 ${items[0]?.startDate})`);
      setShowPresetModal(false);
    } catch (err) {
      console.error('프리셋 등록 실패:', err);
      alert('일괄 등록 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // 비용
  const handleEditCost = (cost) => { setEditingCost(cost); setShowCostForm(true); };
  const handleCostSubmit = async (data) => {
    if (editingCost) {
      await updateCost(editingCost.id, data);
      queueNotion('cost', editingCost.id);
      addLog('cost_update', `비용 수정: ${data.title} (${data.amount}원)`);
    } else {
      const created = await addCost(data);
      queueNotion('cost', created?.id);
      addLog('cost_add', `비용 추가: ${data.title} (${data.amount}원)`);
    }
    setShowCostForm(false);
    setEditingCost(null);
    setFormStageId('');
  };
  const handleMarkCostPaid = async (cost) => {
    await updateCost(cost.id, { paymentStatus: 'paid', date: toDateInputValue(new Date()) });
    queueNotion('cost', cost.id);
    addLog('cost_update', `지급 완료 처리: ${cost.title} (${cost.amount}원)`);
  };
  const handleDeleteCost = async (costId) => {
    const c = costs.find(x => x.id === costId);
    await deleteCost(costId);
    archiveNotionPage(c?.notionPageId);
    addLog('cost_delete', `비용 삭제: ${c?.title || ''}`);
  };

  // 서류
  // 업로드 창은 { file, ...정보 } 한 덩어리로 넘겨줌 (예전엔 인자 순서가 어긋나 업로드가 실패했음)
  const handleUploadDocument = async ({ file, ...metadata }, onProgress) => {
    const created = await uploadDocument(file, metadata, onProgress);
    queueNotion('document', created?.id);
    addLog('doc_upload', `서류 업로드: ${metadata.requiredDoc ? `[${metadata.requiredDoc}] ` : ''}${file.name}`);
    setShowDocUpload(false);
    setFormStageId('');
    setFormRequiredDoc('');
  };
  const handleDeleteDocument = async (docId, storagePath) => {
    const d = documents.find(x => x.id === docId);
    await deleteDocument(docId, storagePath);
    archiveNotionPage(d?.notionPageId);
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
    const created = await addDailyLog(data);
    queueNotion('dailyLog', created?.id);
    addLog('dailylog_add', `현장 일지 작성: ${data.date} (${data.summary})`);
  };
  const handleUpdateDailyLog = async (logId, data) => {
    await updateDailyLog(logId, data);
    queueNotion('dailyLog', logId);
    addLog('dailylog_update', `현장 일지 수정: ${data.date} (${data.summary})`);
  };
  const handleDeleteDailyLog = async (logId) => {
    const target = dailyLogs.find(l => l.id === logId);
    await deleteDailyLog(logId);
    archiveNotionPage(target?.notionPageId);
    addLog('dailylog_delete', `현장 일지 삭제`);
  };
  const handleAddDailyLogEntry = async (logId, entryData) => {
    await addDailyLogEntry(logId, entryData);
    queueNotion('dailyLog', logId);
    addLog('dailylog_entry_add', `현장 일지 추가 작업/조치 등록: ${entryData.summary}`);
  };
  const handleUpdateDailyLogEntry = async (logId, entryId, entryData) => {
    await updateDailyLogEntry(logId, entryId, entryData);
    queueNotion('dailyLog', logId);
    addLog('dailylog_entry_update', `현장 일지 추가 작업/조치 수정`);
  };
  const handleDeleteDailyLogEntry = async (logId, entryId) => {
    await deleteDailyLogEntry(logId, entryId);
    queueNotion('dailyLog', logId);
    addLog('dailylog_entry_delete', `현장 일지 추가 작업/조치 삭제`);
  };

  // 오픈 계획 핸들러
  const handleSavePlan = async (data) => {
    const editing = planEditor?.plan;
    if (editing) {
      await updatePlan(editing.id, data);
      queueNotion('plan', editing.id);
      addLog('plan_update', `오픈 계획 수정: ${data.title}`);
    } else {
      const created = await addPlan({ ...data, order: Date.now() });
      queueNotion('plan', created?.id);
      addLog('plan_add', `오픈 계획 추가: ${data.title}`);
    }
    setPlanEditor(null);
  };
  const handleMovePlan = async (plan, status) => {
    await updatePlan(plan.id, { status });
    queueNotion('plan', plan.id);
    addLog('plan_update', `오픈 계획 상태 변경: ${plan.title}`);
  };
  const handleDeletePlan = async (plan) => {
    await removePlan(plan.id);
    archiveNotionPage(plan.notionPageId);
    addLog('plan_delete', `오픈 계획 삭제: ${plan.title}`);
    setPlanEditor(null);
  };

  // AI 비서가 제안한 '고치기' 적용: 바꾸라고 한 칸만 바꿈 (지우기는 하지 않음)
  const applyAiUpdate = async ({ kind, id, changes = [] }, { isDate, stageIdOf }) => {
    const list = { open_plan: plans, open_task: tasks, schedule: schedules, daily_log: dailyLogs }[kind] || [];
    const rec = list.find(r => r.id === id);
    if (!rec) throw new Error('고칠 기록을 찾지 못했어요.');
    const names = (s) => String(s || '').split(/[,，、]/).map(x => x.trim()).filter(Boolean);
    const day = (s) => {
      if (!String(s || '').trim()) return null;
      if (!isDate(s)) throw new Error(`날짜는 YYYY-MM-DD로 적어 주세요: ${s}`);
      return s;
    };
    const data = {};
    changes.forEach(({ field, value }) => {
      const val = String(value ?? '').trim();
      switch (field) {
        case 'title': if (val) data.title = val; break;
        case 'status': if (['todo', 'doing', 'done'].includes(val)) data.status = val; break;
        case 'assignee1': data.assignee1 = names(val); break;
        case 'assignee2': data.assignee2 = names(val); break;
        case 'due_date': data.dueDate = day(val); break;
        case 'body_add': if (val) data.body = `${rec.body || ''}${rec.body ? '\n' : ''}${val}`; break;
        case 'group': data.group = val; break;
        case 'category': data.category = val; break;
        case 'start_date': data.startDate = day(val); break;
        case 'end_date': data.endDate = day(val); break;
        case 'done':
          if (kind === 'schedule') data.status = val === 'true' ? 'completed' : 'pending';
          else data.done = val === 'true';
          break;
        case 'memo': data.memo = val; break;
        case 'stage': data.stageId = stageIdOf(val); break;
        case 'assignee': data.assignee = val; break;
        case 'date': if (day(val)) data.date = val; break;
        case 'summary': if (val) data.summary = val; break;
        case 'weather': if (['sunny', 'cloudy', 'rain', 'snow'].includes(val)) data.weather = val; break;
        case 'workers_count': data.workersCount = Number(val) || 0; break;
        case 'equipment_used': data.equipmentUsed = val; break;
        case 'issues': data.issues = val; break;
        default: break;
      }
    });
    if (!Object.keys(data).length) return;
    const title = data.title || rec.title || '';
    if (kind === 'open_plan') {
      await updatePlan(id, data);
      queueNotion('plan', id);
      addLog('plan_update', `오픈 계획 수정 (AI): ${title}`);
    } else if (kind === 'open_task') {
      await updateTask(id, data);
      queueNotion('task', id);
      addLog('task_update', `오픈 준비 수정 (AI): ${title}`);
    } else if (kind === 'schedule') {
      // 일정은 시작·끝 날짜가 항상 있어야 함
      if (data.startDate === null) delete data.startDate;
      if (data.endDate === null) data.endDate = data.startDate || toDateInputValue(rec.startDate);
      await updateSchedule(id, data);
      queueNotion('schedule', id);
      addLog('schedule_update', `일정 수정 (AI): ${title}`);
    } else if (kind === 'daily_log') {
      // 일지 저장은 사진·추가 작업까지 통째로 다시 쓰므로 기존 내용을 함께 넘김 (사진이 지워지지 않게)
      await handleUpdateDailyLog(id, { ...rec, ...data });
    }
  };

  // AI 비서가 제안한 내용 저장 (확인 후 [추가]를 누른 것만)
  const handleAiSave = async (kind, v) => {
    const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
    const stageIdOf = (name) => (name ? stages.find(s => s.name === name)?.id || null : null);
    if (kind === 'add_open_plan') {
      const created = await addPlan({
        title: v.title, status: v.status || 'todo', assignee1: v.assignee1 || [], assignee2: v.assignee2 || [],
        dueDate: isDate(v.due_date) ? v.due_date : null, body: v.body || '', order: Date.now(),
      });
      queueNotion('plan', created?.id);
      addLog('plan_add', `오픈 계획 추가 (AI): ${v.title}`);
    } else if (kind === 'add_open_task') {
      const created = await addTask({
        title: v.title, group: v.group || '', category: v.category || '',
        startDate: isDate(v.start_date) ? v.start_date : null,
        endDate: isDate(v.end_date) && v.end_date >= v.start_date ? v.end_date : null,
        done: Boolean(v.done), assignee1: v.assignee1 || [], assignee2: v.assignee2 || [], memo: v.memo || '', files: [], body: '',
        order: Date.now(),
      });
      queueNotion('task', created?.id);
      addLog('task_add', `오픈 준비 추가 (AI): ${v.title}`);
    } else if (kind === 'add_schedule') {
      if (!isDate(v.start_date)) throw new Error(`'${v.title}' 일정의 시작일을 YYYY-MM-DD로 적어 주세요.`);
      const created = await addSchedule({
        title: v.title, startDate: v.start_date, endDate: isDate(v.end_date) && v.end_date >= v.start_date ? v.end_date : v.start_date,
        stageId: stageIdOf(v.stage), assignee: v.assignee || '', memo: v.memo || '',
      });
      queueNotion('schedule', created?.id);
      addLog('schedule_add', `일정 추가 (AI): ${v.title}`);
    } else if (kind === 'update_record') {
      await applyAiUpdate(v, { isDate, stageIdOf });
    } else if (kind === 'add_daily_log') {
      if (!isDate(v.date)) throw new Error(`'${v.title}' 일지의 날짜를 YYYY-MM-DD로 적어 주세요.`);
      await handleAddDailyLog({
        date: v.date, title: v.title || '', summary: v.summary || v.title || '', weather: v.weather || 'sunny',
        workersCount: Number(v.workers_count) || 0, equipmentUsed: v.equipment_used || '', issues: v.issues || '',
        photos: [], stageId: stageIdOf(v.stage),
      });
    }
  };

  // 오픈 준비 스케줄 핸들러
  const taskGroups = Array.from(new Set([...OPEN_TASK_GROUPS, ...tasks.map(t => t.group).filter(Boolean)]));
  const taskCategories = Array.from(new Set([...OPEN_TASK_CATEGORIES, ...tasks.map(t => t.category).filter(Boolean)]));
  const handleSaveTask = async (data) => {
    const editing = taskEditor?.task;
    if (editing) {
      await updateTask(editing.id, data);
      queueNotion('task', editing.id);
      addLog('task_update', `오픈 준비 수정: ${data.title}`);
    } else {
      const created = await addTask({ ...data, order: Date.now() });
      queueNotion('task', created?.id);
      addLog('task_add', `오픈 준비 추가: ${data.title}`);
    }
    setTaskEditor(null);
  };
  const handleToggleTask = async (task) => {
    if (!task) return;
    await updateTask(task.id, { done: !task.done });
    queueNotion('task', task.id);
  };
  const handleDeleteTask = async (task) => {
    if (!task) return;
    await removeTask(task.id);
    archiveNotionPage(task.notionPageId);
    addLog('task_delete', `오픈 준비 삭제: ${task.title}`);
    setTaskEditor(null);
  };
  const handleImportTasks = async (items) => {
    const base = Date.now();
    for (const [i, item] of items.entries()) {
      const created = await addTask({ ...item, order: base + i });
      queueNotion('task', created?.id);
    }
    addLog('task_add', `오픈 준비 항목 ${items.length}개 가져오기`);
    setShowImportTasks(false);
  };

  // 예산 핸들러
  const handleUpdateBudget = async (newBudget) => {
    await updateBudget(newBudget);
    addLog('budget_update', `목표 예산 변경: ${newBudget.totalBudget}원`);
  };

  // 원형 프로그레스 계산 (반경 22, 둘레 138.2)
  const circleCircumference = 138.2;
  const strokeOffset = circleCircumference - (circleCircumference * Math.min(progress, 100)) / 100;

  return (
    <div className="page branch-detail" id="branch-detail-page">
      <LocalDataSyncBanner />

      {/* 지연 일정 스마트 알림 배너 */}
      {delayedSchedules.length > 0 && (
        <div className="branch-delay-alert animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NeonIcon name="alert" color="rose" size="sm" />
            <div>
              <span style={{ fontWeight: 700, color: '#f87171' }}>공정 지연 주의: </span>
              기한이 경과한 미완료 일정이 <strong>{delayedSchedules.length}건</strong> 있습니다.
              <span className="text-secondary text-xs" style={{ marginLeft: 6 }}>
                ({delayedSchedules.map(s => s.title).slice(0, 2).join(', ')}{delayedSchedules.length > 2 ? ' 외' : ''})
              </span>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setActiveTab('schedule')}
            style={{ color: '#f87171', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <span>일정 확인</span>
            <NeonIcon name="arrow-right" color="rose" size="sm" badge={false} />
          </button>
        </div>
      )}

      {overduePayments.length > 0 && (
        <div className="branch-delay-alert animate-fade-in">
          <div>
            <span style={{ fontWeight: 700, color: 'var(--color-warning)' }}>지급일 지남: </span>
            지급 예정일이 지난 비용이 <strong>{overduePayments.length}건</strong> 있어요.
            <span className="text-secondary text-xs" style={{ marginLeft: 6 }}>
              ({overduePayments.map(c => c.title).slice(0, 2).join(', ')}{overduePayments.length > 2 ? ' 외' : ''})
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('cost')}>비용 확인</button>
        </div>
      )}

      {/* 지점 헤더 */}
      <div className="branch-detail-header animate-fade-in-up">
        <div className="branch-detail-header-top">
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <NeonIcon name="building" color="emerald" size="md" />
              <span>{branch.name}</span>
            </h1>
            {branch.address && (
              <p className="text-secondary text-sm" style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <NeonIcon name="pin" size="xs" color="rose" badge={false} />
                <span>{branch.address}</span>
              </p>
            )}
          </div>
          <div className="branch-header-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowBranchEdit(true)}
              id="edit-branch-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <NeonIcon name="edit" color="emerald" size="sm" badge={false} />
              <span>지점/제원 수정</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowCopyModal(true)}
              id="copy-branch-btn"
              title="단계·체크리스트·협력업체·장비 등을 복사해 새 지점 만들기"
            >
              이 지점처럼 새 지점 만들기
            </button>
            <select className="branch-status-select" value={branch.status} onChange={(e) => handleStatusChange(e.target.value)} id="branch-status-select">
              {Object.entries(BRANCH_STATUS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 관제 센터 스타일 3D 네온 KPI 요약 카드 */}
        <div className="branch-summary-cards">
          {/* 공정 진행률 - 원형 네온 도넛 게이지 */}
          <div className="summary-card radial-kpi-card">
            <div className="radial-kpi-ring">
              <svg viewBox="0 0 56 56" className="radial-svg">
                <circle cx="28" cy="28" r="22" className="radial-bg-circle" />
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  className="radial-progress-circle"
                  style={{
                    strokeDasharray: circleCircumference,
                    strokeDashoffset: strokeOffset,
                  }}
                />
              </svg>
              <span className="radial-value-text tabular-nums">{progress}%</span>
            </div>
            <div className="summary-info">
              <div className="summary-value tabular-nums">{completedStages} / {stages.length} <span style={{ fontSize: 13, fontWeight: 400 }}>단계</span></div>
              <div className="summary-label">공정 진행 현황</div>
            </div>
          </div>

          <div className="summary-card">
            <NeonIcon name="money" color="amber" size="md" />
            <div className="summary-info">
              <div className="summary-value tabular-nums">{formatCurrency(totalCost)}</div>
              <div className="summary-label">총 집행 공사비</div>
            </div>
          </div>

          <div className="summary-card">
            <NeonIcon name="equipment" color="violet" size="md" />
            <div className="summary-info">
              <div className="summary-value tabular-nums">{equipments.length} <span style={{ fontSize: 13, fontWeight: 400 }}>대</span></div>
              <div className="summary-label">정비 장비 (설치 {installedCount}대)</div>
            </div>
          </div>

          <div className="summary-card">
            <NeonIcon name="partner" color="coral" size="md" />
            <div className="summary-info">
              <div className="summary-value tabular-nums">{partners.length} <span style={{ fontSize: 13, fontWeight: 400 }}>개사</span></div>
              <div className="summary-label">협력업체 연락망</div>
            </div>
          </div>
        </div>
      </div>

      {/* PC 세그먼트 필(Pill) 탭 바 */}
      <BranchTabBar activeTab={activeTab} onChange={setActiveTab} />

      {/* 탭 내용 영역 */}
      <div className="branch-tab-content animate-fade-in" key={activeTab}>
        {/* 0. 점포별 건축 통합 타임라인 피드 */}
        {activeTab === 'timeline' && (
          <div className="tab-timeline">
            <BranchTimelineFeed
              branch={branch}
              stages={stages}
              schedules={schedules}
              dailyLogs={dailyLogs}
              costs={costs}
              documents={documents}
              equipments={equipments}
              logs={logs}
              onOpenScheduleForm={() => { setEditingSchedule(null); setShowScheduleForm(true); }}
              onOpenCostForm={() => { setEditingCost(null); setShowCostForm(true); }}
              onOpenDailyLogForm={() => setShowDailyLogForm(true)}
            />
          </div>
        )}

        {/* 1. 단계별 기록 (임대차계약 → … → 오픈) */}
        {activeTab === 'stages' && (
          <StageBook
            key={branchId}
            branch={branch}
            stages={stages}
            schedules={schedules}
            costs={costs}
            documents={documents}
            dailyLogs={dailyLogs}
            equipments={equipments}
            onAddStage={handleAddStage}
            onUpdateStage={handleUpdateStage}
            onDeleteStage={handleDeleteStage}
            onToggleScheduleComplete={handleToggleScheduleComplete}
            onEditSchedule={handleEditSchedule}
            onEditCost={handleEditCost}
            onAddSchedule={(stageId) => { setEditingSchedule(null); setFormStageId(stageId); setShowScheduleForm(true); }}
            onAddCost={(stageId) => { setEditingCost(null); setFormStageId(stageId); setShowCostForm(true); }}
            onAddDocument={(stageId, requiredDoc = '') => { setFormStageId(stageId); setFormRequiredDoc(requiredDoc); setShowDocUpload(true); }}
            onEditBranch={() => setShowBranchEdit(true)}
            onStandardizeStages={handleStandardizeStages}
          />
        )}

        {/* 오픈 계획 (노션 '오픈 계획' 보드 양식) */}
        {activeTab === 'plans' && (
          <div className="tab-plans">
            <div className="tab-header">
              <h3>오픈 계획</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setPlanEditor({ status: 'todo' })}>+ 새 항목</button>
            </div>
            <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-md)' }}>
              큰 할 일·회의록을 카드로 관리해요. 카드를 눌러 세부 내용을 쓰고, PC에서는 카드를 다른 칸으로 끌어 상태를 바꿀 수 있어요.
            </p>
            <OpenPlanBoard
              plans={plans}
              onOpen={(plan) => setPlanEditor({ plan })}
              onCreate={(status) => setPlanEditor({ status })}
              onMove={handleMovePlan}
            />
          </div>
        )}

        {/* 오픈 준비 스케줄 (노션 '구리OPEN 스케쥴' 표 양식) */}
        {activeTab === 'tasks' && (
          <div className="tab-tasks">
            <div className="tab-header">
              <h3>오픈 준비 스케줄</h3>
            </div>
            <OpenTaskTable
              tasks={tasks}
              onAdd={(defaults) => setTaskEditor({ defaults })}
              onEdit={(task) => task && setTaskEditor({ task })}
              onToggleDone={handleToggleTask}
              onDelete={handleDeleteTask}
              onImport={() => setShowImportTasks(true)}
              onRetryNotion={(task) => queueNotion('task', task.id)}
            />
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
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowPresetModal(true)}>
                    표준 일정 불러오기
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => { setEditingSchedule(null); setShowScheduleForm(true); }}>
                    + 일정 추가
                  </button>
                </div>
              </div>
              <Timeline
                schedules={schedules}
                stages={stages}
                onEdit={handleEditSchedule}
                onDelete={handleDeleteSchedule}
                onToggleComplete={handleToggleScheduleComplete}
              />
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
              stages={stages}
              defaultStageId={currentStageId}
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
            <CostList costs={costs} totalCost={totalCost} onEdit={handleEditCost} onDelete={handleDeleteCost} onMarkPaid={handleMarkCostPaid} />
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

      {/* AI 비서: 말로 부탁하면 오픈 계획·오픈 준비·일정·현장 일지에 넣을 내용을 만들어 줌 */}
      <button type="button" className="fab-ai" onClick={() => setShowAi(true)} title="AI 비서에게 말로 부탁해서 기록 추가">
        ✨ AI 비서
      </button>
      {showAi && (
        <AiAssistant
          branchName={branch?.name || ''}
          people={people}
          groups={taskGroups}
          categories={taskCategories}
          stageList={[...stages].sort((a, b) => (a.order || 0) - (b.order || 0))}
          records={{ plans, tasks, schedules, dailyLogs }}
          onSave={handleAiSave}
          onClose={() => setShowAi(false)}
        />
      )}

      {/* 우측 하단 플로팅 퀵 버튼 (현장 일일 일지 즉시 작성) */}
      <button
        type="button"
        className="fab-daily-log"
        onClick={() => setShowDailyLogForm(true)}
        title="현장 일일 일지 즉시 작성 (어디서나 1초 오픈)"
        id="fab-quick-daily-log"
      >
        <NeonIcon name="log" size="sm" color="cyan" badge={false} />
        <span className="fab-text">+ 일지 작성</span>
      </button>

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
          defaultStageId={formStageId}
          onSubmit={handleScheduleSubmit}
          onClose={() => { setShowScheduleForm(false); setEditingSchedule(null); setFormStageId(''); }}
        />
      )}

      {showCostForm && (
        <QuickCostForm
          cost={editingCost}
          stages={stages}
          defaultStageId={formStageId}
          onSubmit={handleCostSubmit}
          onClose={() => { setShowCostForm(false); setEditingCost(null); setFormStageId(''); }}
        />
      )}

      {planEditor && (
        <OpenPlanEditor
          plan={planEditor.plan}
          defaultStatus={planEditor.status}
          branchId={branchId}
          people={people}
          onSave={handleSavePlan}
          onDelete={handleDeletePlan}
          onRetryNotion={() => planEditor.plan && queueNotion('plan', planEditor.plan.id)}
          onClose={() => setPlanEditor(null)}
        />
      )}

      {taskEditor && (
        <OpenTaskForm
          task={taskEditor.task}
          defaults={taskEditor.defaults}
          branchId={branchId}
          people={people}
          groups={taskGroups}
          categories={taskCategories}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onRetryNotion={() => taskEditor.task && queueNotion('task', taskEditor.task.id)}
          onClose={() => setTaskEditor(null)}
        />
      )}

      {showImportTasks && (
        <ImportTasksModal
          branches={branches}
          currentBranchId={branchId}
          onImport={handleImportTasks}
          onClose={() => setShowImportTasks(false)}
        />
      )}

      {showCopyModal && (
        <CopyBranchModal source={branch} onClose={() => setShowCopyModal(false)} />
      )}

      {showPresetModal && (
        <ArchitectPresetModal
          stages={stages}
          onApply={handleAddArchitectPreset}
          onClose={() => setShowPresetModal(false)}
        />
      )}

      {showDocUpload && (
        <DocumentUpload
          stages={stages}
          defaultStageId={formStageId}
          defaultRequiredDoc={formRequiredDoc}
          onUpload={handleUploadDocument}
          onClose={() => { setShowDocUpload(false); setFormStageId(''); setFormRequiredDoc(''); }}
        />
      )}

      {showDailyLogForm && (
        <DailyLogForm
          branchId={branchId}
          stages={stages}
          defaultStageId={currentStageId}
          onSubmit={async (data) => {
            await handleAddDailyLog(data);
            setShowDailyLogForm(false);
          }}
          onClose={() => setShowDailyLogForm(false)}
        />
      )}
    </div>
  );
}
