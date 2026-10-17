import { DEFAULT_STAGES } from './constants';
import { standardIndexOf } from './branchCompare';

const norm = (s) => (s || '').replace(/[\s·()\-_.,]/g, '').toLowerCase();

/** 단계 이름으로 표준 단계를 찾아 그 단계의 필수 서류 목록을 돌려줌 */
export function requiredDocsFor(stage) {
  if (!stage) return [];
  const idx = standardIndexOf(stage.name);
  return idx >= 0 ? (DEFAULT_STAGES[idx].requiredDocs || []) : [];
}

/**
 * 필수 서류별로 올린 파일이 있는지 확인
 * - '올리기' 버튼으로 올린 파일(requiredDoc 표시)이 있거나
 * - 파일 이름에 서류 이름이 들어 있으면 올린 것으로 봄 (예: '건축물대장·토지대장'은 둘 중 하나만 있어도 됨)
 */
export function requiredDocStatus(stage, stageDocs = []) {
  const notNeeded = new Set(stage?.docsNotNeeded || []);
  return requiredDocsFor(stage).map(name => {
    const parts = name.split('·').map(p => norm(p.split('(')[0])).filter(Boolean);
    const docs = stageDocs.filter(d =>
      d.requiredDoc === name ||
      parts.some(p => norm(d.name).includes(p) || norm(d.fileName).includes(p))
    );
    return { name, docs, notNeeded: notNeeded.has(name), done: docs.length > 0 };
  });
}
