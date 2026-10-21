/**
 * 기록의 노션 전송 상태 표시: 보냄 ✓ / 실패 ! (마우스를 올리면 이유)
 * compact: 카드 구석에 들어가는 작은 표시
 * 데모 모드나 아직 보내기 전에는 아무것도 표시하지 않음
 */
export default function NotionBadge({ record, onRetry, compact = false }) {
  if (record?.notionError) {
    return (
      <span
        className={`notion-badge fail ${compact ? 'compact' : ''}`}
        title={`노션으로 보내지 못했어요: ${record.notionError}`}
        role={onRetry ? 'button' : undefined}
        onClick={onRetry ? (e) => { e.stopPropagation(); onRetry(); } : undefined}
      >
        {compact ? 'N!' : `노션 전송 실패${onRetry ? ' · 다시 보내기' : ''}`}
      </span>
    );
  }
  if (record?.notionPageId) {
    return <span className={`notion-badge ok ${compact ? 'compact' : ''}`} title="노션에 반영됨">{compact ? 'N' : '노션 반영됨'}</span>;
  }
  return null;
}
