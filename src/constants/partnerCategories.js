// 협력업체 / 공사 거래처 분야별 고유 컬러 및 메타데이터 정의

export const PARTNER_CATEGORIES = [
  {
    id: 'construction',
    label: '건축 / 토목',
    shortLabel: '건축/토목',
    icon: '🏗️',
    color: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.4)',
    bg: 'rgba(245, 158, 11, 0.12)',
    text: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.25)',
  },
  {
    id: 'facility',
    label: '전기 / 설비',
    shortLabel: '전기/설비',
    icon: '⚡',
    color: '#06b6d4',
    border: 'rgba(6, 182, 212, 0.4)',
    bg: 'rgba(6, 182, 212, 0.12)',
    text: '#22d3ee',
    glow: 'rgba(6, 182, 212, 0.25)',
  },
  {
    id: 'equipment',
    label: '정비장비 / 리프트',
    shortLabel: '정비장비/리프트',
    icon: '🔧',
    color: '#a855f7',
    border: 'rgba(168, 85, 247, 0.4)',
    bg: 'rgba(168, 85, 247, 0.12)',
    text: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.25)',
  },
  {
    id: 'interior',
    label: '간판 / 인테리어',
    shortLabel: '간판/인테리어',
    icon: '🎨',
    color: '#f43f5e',
    border: 'rgba(244, 63, 94, 0.4)',
    bg: 'rgba(244, 63, 94, 0.12)',
    text: '#fb7185',
    glow: 'rgba(244, 63, 94, 0.25)',
  },
  {
    id: 'safety',
    label: '소방 / 환경',
    shortLabel: '소방/환경',
    icon: '🧯',
    color: '#10b981',
    border: 'rgba(16, 185, 129, 0.4)',
    bg: 'rgba(16, 185, 129, 0.12)',
    text: '#34d399',
    glow: 'rgba(16, 185, 129, 0.25)',
  },
  {
    id: 'admin',
    label: '인허가 / 관공서',
    shortLabel: '인허가/관공서',
    icon: '🏛️',
    color: '#6366f1',
    border: 'rgba(99, 102, 241, 0.4)',
    bg: 'rgba(99, 102, 241, 0.12)',
    text: '#818cf8',
    glow: 'rgba(99, 102, 241, 0.25)',
  },
  {
    id: 'etc',
    label: '기타',
    shortLabel: '기타',
    icon: '📌',
    color: '#94a3b8',
    border: 'rgba(148, 163, 184, 0.4)',
    bg: 'rgba(148, 163, 184, 0.12)',
    text: '#cbd5e1',
    glow: 'rgba(148, 163, 184, 0.25)',
  },
];

export const PARTNER_CATEGORY_MAP = PARTNER_CATEGORIES.reduce((acc, cat) => {
  acc[cat.id] = cat;
  return acc;
}, {});

export function getPartnerCategory(catId) {
  return (
    PARTNER_CATEGORY_MAP[catId] || {
      id: catId || 'etc',
      label: '기타',
      shortLabel: '기타',
      icon: '📌',
      color: '#94a3b8',
      border: 'rgba(148, 163, 184, 0.4)',
      bg: 'rgba(148, 163, 184, 0.12)',
      text: '#cbd5e1',
      glow: 'rgba(148, 163, 184, 0.25)',
    }
  );
}
