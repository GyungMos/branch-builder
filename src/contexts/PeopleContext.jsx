import { createContext, useContext } from 'react';
import { usePeople } from '../hooks/useSettings';

// 서로 잘 구분되는 색 (담당자는 명단 순서대로 자동 배정, 설정에서 바꿀 수 있음)
export const PEOPLE_PALETTE = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#64748b',
];

// 오픈 계획 상태 기본 색 (설정에서 바꿀 수 있음)
export const DEFAULT_STATUS_COLORS = { todo: '#64748b', doing: '#3b82f6', done: '#10b981' };

function hashColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PEOPLE_PALETTE[Math.abs(h) % PEOPLE_PALETTE.length];
}

/** 담당자 색: 직접 정한 색 → 명단 순서 색 → (명단에 없는 이름) 이름으로 정한 색 */
export function colorForPerson(name, names = [], colors = {}) {
  if (colors[name]) return colors[name];
  const i = names.indexOf(name);
  return i >= 0 ? PEOPLE_PALETTE[i % PEOPLE_PALETTE.length] : hashColor(name);
}

const PeopleContext = createContext({
  names: [],
  colors: {},
  colorOf: hashColor,
  statusColor: (id) => DEFAULT_STATUS_COLORS[id] || DEFAULT_STATUS_COLORS.todo,
});

/** 로그인한 뒤 화면 어디서나 담당자 명단·색, 상태 색을 쓸 수 있게 */
export function PeopleProvider({ children }) {
  const { names, colors, statusColors } = usePeople();
  const value = {
    names,
    colors,
    colorOf: (name) => colorForPerson(name, names, colors),
    statusColor: (id) => statusColors[id] || DEFAULT_STATUS_COLORS[id] || DEFAULT_STATUS_COLORS.todo,
  };
  return <PeopleContext.Provider value={value}>{children}</PeopleContext.Provider>;
}

export const usePeopleContext = () => useContext(PeopleContext);
