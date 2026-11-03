import { toDateInputValue } from './formatters';

/**
 * '부족했던 점' 모으기
 * - 현장 일지의 '부족했던 점 · 미리 챙겼어야 할 것' 칸 (한 줄에 하나)
 * - 단계별 기록의 '아쉬운 점' · '다음 지점에 꼭 할 것' 메모
 * 한 번 적은 내용을 그대로 모아 보여 줄 뿐, 따로 저장하지 않음 (일지를 고치면 여기도 바뀜)
 */

/** 여러 줄 글 → 항목 목록 (앞의 - • * 1. 같은 표시는 뺌) */
export function splitShortfalls(text = '') {
  return String(text)
    .split('\n')
    .map(s => s.replace(/^\s*([-•*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}

/** 부족했던 점 분야 (다음 지점에서 분야별로 골라 보기) */
export const SHORTFALL_CATEGORIES = ['설계', '인허가', '전기', '설비·배관', '자재', '업체', '공정·일정', '비용', '기타'];

/** 제목·상세·분야 목록 정리 (제목 없이 상세만 적었으면 상세 첫 줄을 제목으로) */
export function cleanShortfallItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(it => (typeof it === 'string'
      ? { title: it.trim(), detail: '' }
      : {
        title: String(it?.title || '').trim(),
        detail: String(it?.detail || '').trim(),
        ...(SHORTFALL_CATEGORIES.includes(it?.category) ? { category: it.category } : {}),
      }))
    .map(it => (it.title ? it : { title: it.detail.split('\n')[0].slice(0, 60), detail: it.detail }))
    .filter(it => it.title);
}

/** 일지의 부족했던 점 → [{ title, detail }] (예전 일지는 줄마다 제목만) */
export function shortfallItemsOf(log = {}) {
  if (Array.isArray(log?.shortfallItems)) return cleanShortfallItems(log.shortfallItems);
  return splitShortfalls(log?.shortfalls).map(title => ({ title, detail: '' }));
}

/** 저장할 모양: 제목·상세 목록 + 제목만 줄마다 이은 글 (노션·검색·예전 화면용) */
export function shortfallFields(items) {
  const list = cleanShortfallItems(items);
  return { shortfallItems: list, shortfalls: list.map(it => it.title).join('\n') };
}

/** 제목만 줄마다 적은 글로 고칠 때(AI 비서 등) 같은 제목의 상세 내용은 그대로 둠 */
export function mergeShortfallText(text, prevItems = []) {
  return splitShortfalls(text).map(title => {
    const prev = prevItems.find(p => p.title === title);
    return { title, detail: prev?.detail || '', ...(prev?.category ? { category: prev.category } : {}) };
  });
}

/** 짧은 지문 (체크 기억용: 글이 같으면 같은 항목) */
function hash(text = '') {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * 한 지점의 부족했던 점 목록
 * { key, text(제목), detail(상세 내용), stageName, date, source: 'log' | 'stage', logId?, branchId, branchName }
 */
export function collectLessons({ branchId, branchName, dailyLogs = [], stages = [] }) {
  const stageName = (id) => stages.find(s => s.id === id)?.name || '';
  const out = [];
  dailyLogs.forEach(log => {
    shortfallItemsOf(log).forEach(({ title: text, detail, category = '' }) => {
      out.push({
        // 제목으로 지문을 만들어서, 상세 내용을 고쳐도 체크·메모가 그대로 남음
        key: `${branchId}:log:${log.id}:${hash(text)}`,
        text,
        detail,
        category,
        stageName: stageName(log.stageId),
        date: toDateInputValue(log.date) || '',
        source: 'log',
        logId: log.id,
        branchId,
        branchName,
      });
    });
  });
  stages.forEach(stage => {
    const l = stage.lessons || {};
    [['bad', '아쉬운 점'], ['next', '다음 지점에 꼭 할 것']].forEach(([field, label]) => {
      splitShortfalls(l[field]).forEach(text => {
        out.push({
          key: `${branchId}:stage:${stage.id}:${field}:${hash(text)}`,
          text,
          stageName: stage.name || '',
          date: '',
          source: 'stage',
          sourceLabel: label,
          branchId,
          branchName,
        });
      });
    });
  });
  return out.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
}

/** 단계 이름별로 묶기 (단계 순서는 stageOrder, 없으면 '단계 미정'은 맨 뒤) */
export function groupByStage(items, stageOrder = []) {
  const groups = new Map();
  items.forEach(it => {
    const name = it.stageName || '단계 미정';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(it);
  });
  const rank = (name) => {
    const i = stageOrder.indexOf(name);
    return i >= 0 ? i : name === '단계 미정' ? 9999 : 999;
  };
  return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([name, list]) => ({ name, items: list }));
}
