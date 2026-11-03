import { createContext, useContext, useState } from 'react';

/**
 * 왼쪽 메뉴에 보여 줄 지점 메뉴 옆 숫자 (예: 처리 안 된 하자 2)
 * 지점 화면이 값을 알려 주면 왼쪽 메뉴가 받아서 보여 줌
 */
const BranchNavContext = createContext({ counts: {}, setCounts: () => {} });

export function BranchNavProvider({ children }) {
  const [counts, setCounts] = useState({});
  return <BranchNavContext.Provider value={{ counts, setCounts }}>{children}</BranchNavContext.Provider>;
}

export const useBranchNav = () => useContext(BranchNavContext);
