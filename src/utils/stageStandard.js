import { DEFAULT_STAGES } from './constants';

/**
 * 지점의 기존 단계를 표준 단계(DEFAULT_STAGES)에 맞추는 계획을 만든다.
 * - 이름 규칙(match)이 맞는 기존 단계는 이름·순서만 바꿈 (단계 id가 그대로라 연결된 일정·비용·서류 유지)
 * - 맞는 단계가 없는 표준 단계는 기본 체크리스트와 함께 새로 추가
 * - 표준에 없는 기존 단계는 지우지 않고 맨 뒤로 보냄
 */
export function planStageStandardization(stages) {
  const remaining = [...stages].sort((a, b) => (a.order || 0) - (b.order || 0));
  const updates = [];
  const adds = [];

  DEFAULT_STAGES.forEach(std => {
    const idx = remaining.findIndex(s => s.name === std.name || std.match?.test(s.name));
    if (idx >= 0) {
      const [stage] = remaining.splice(idx, 1);
      updates.push({ stage, name: std.name, order: std.order });
    } else {
      adds.push({
        name: std.name,
        order: std.order,
        checklist: (std.checklist || []).map((text, i) => ({ id: `${Date.now()}-${std.order}-${i}`, text, done: false })),
      });
    }
  });

  const extras = remaining.map((stage, i) => ({ stage, order: DEFAULT_STAGES.length + i + 1 }));

  const changedUpdates = updates.filter(u => u.stage.name !== u.name || u.stage.order !== u.order);
  const changedExtras = extras.filter(e => e.stage.order !== e.order);

  return {
    updates,
    adds,
    extras,
    renames: updates.filter(u => u.stage.name !== u.name),
    // 표준과 다른 점이 있는지 (표준에 없는 단계가 남아 있는 것만으로는 다르다고 보지 않음)
    needsChange: stages.length > 0 && (adds.length > 0 || changedUpdates.length > 0 || changedExtras.length > 0),
  };
}
