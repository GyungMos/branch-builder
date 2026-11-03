import ModalPortal from '../common/ModalPortal';
import { formatDateShort } from '../../utils/formatters';
import ShortfallTitle from './ShortfallTitle';
import './Lessons.css';

const SHOW_MAX = 6;

/**
 * 지점을 열면 띄우는 알림: 이전 지점에서 부족했던 점 중 아직 안 챙긴 것 (지금 단계 것을 먼저)
 */
export default function LessonsPopup({ items, currentStage, onOpenAll, onSnoozeToday, onClose }) {
  const sorted = [...items].sort((a, b) => (b.stageName === currentStage) - (a.stageName === currentStage));
  const nowCount = items.filter(it => it.stageName === currentStage).length;
  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal lessons-popup" role="dialog" aria-label="이전 지점에서 부족했던 점">
        <div className="modal-header">
          <h2 className="modal-title">⚠ 이전 지점에서 부족했던 점 {items.length}개</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="modal-body">
          <p className="lessons-help">
            다른 지점을 열면서 아쉬웠던 점이에요. 미리 챙겨 두세요.
            {currentStage && nowCount > 0 && <> 지금 단계(<strong>{currentStage}</strong>)에 해당하는 것이 <strong>{nowCount}개</strong> 있어요.</>}
          </p>
          <ul className="lessons-list">
            {sorted.slice(0, SHOW_MAX).map(it => (
              <li key={it.key} className="lessons-item">
                <ShortfallTitle
                  title={it.text}
                  detail={it.detail}
                  prefix={it.stageName === currentStage ? <><span className="lessons-now">지금 단계</span>{' '}</> : null}
                />
                <span className="lessons-src">{[it.branchName, it.stageName, it.date && formatDateShort(it.date)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
          {items.length > SHOW_MAX && <p className="lessons-help">외 {items.length - SHOW_MAX}개 더 있어요.</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onSnoozeToday}>오늘은 그만 보기</button>
          <button type="button" className="btn btn-primary" onClick={onOpenAll}>모두 보고 챙기기</button>
        </div>
      </div>
    </ModalPortal>
  );
}
