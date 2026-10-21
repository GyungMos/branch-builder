/**
 * 기록의 노션 전송 상태 표시: 보냄 ✓ / 실패 ! (마우스를 올리면 이유)
 * 데모 모드나 아직 보내기 전에는 아무것도 표시하지 않음
 */
export default function NotionBadge({ record, onRetry }) {
  if (record?.notionError) {
    return (
      <span
        className="notion-badge fail"
        title={`노션으로 보내지 못했어요: ${record.notionError}`}
        role={onRetry ? 'button' : undefined}
        onClick={onRetry ? (e) => { e.stopPropagation(); onRetry(); } : undefined}
      >
        노션 ! {onRetry ? '다시 보내기' : ''}
      </span>
    );
  }
  if (record?.notionPageId) {
    return <span className="notion-badge ok" title="노션에 반영됨">노션 ✓</span>;
  }
  return null;
}
