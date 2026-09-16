import { DOCUMENT_CATEGORIES } from '../../utils/constants';
import { formatDate, formatFileSize } from '../../utils/formatters';
import './DocumentList.css';

export default function DocumentList({ documents, onDelete }) {
  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📁</div>
        <div className="empty-state-title">서류가 없습니다</div>
        <div className="empty-state-desc">서류를 업로드하면 카테고리별로 관리할 수 있습니다</div>
      </div>
    );
  }

  // 카테고리별 그룹핑
  const grouped = {};
  documents.forEach(doc => {
    const cat = doc.category || 'etc';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(doc);
  });

  const isImage = (fileType) => fileType?.startsWith('image/');

  return (
    <div className="document-list" id="document-list">
      {DOCUMENT_CATEGORIES.map(cat => {
        const docs = grouped[cat.id];
        if (!docs || docs.length === 0) return null;

        return (
          <div key={cat.id} className="doc-category-section">
            <div className="doc-category-header">
              <span className="doc-category-icon">{cat.icon}</span>
              <h4>{cat.label}</h4>
              <span className="badge badge-neutral">{docs.length}</span>
            </div>
            <div className="doc-items">
              {docs.map(doc => (
                <div key={doc.id} className="doc-item" id={`doc-${doc.id}`}>
                  {isImage(doc.fileType) && doc.fileUrl ? (
                    <div className="doc-thumbnail">
                      <img src={doc.fileUrl} alt={doc.name || doc.fileName} loading="lazy" />
                    </div>
                  ) : (
                    <div className="doc-file-icon">
                      {doc.fileType?.includes('pdf') ? '📄' : '📎'}
                    </div>
                  )}
                  <div className="doc-info">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="doc-name"
                    >
                      {doc.name || doc.fileName}
                    </a>
                    <div className="doc-meta">
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>•</span>
                      <span>{doc.createdAt ? formatDate(doc.createdAt) : ''}</span>
                    </div>
                    {doc.memo && <p className="doc-memo">{doc.memo}</p>}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm doc-delete"
                    onClick={() => { if (window.confirm('이 서류를 삭제하시겠습니까?')) onDelete(doc.id, doc.storagePath); }}
                    aria-label="삭제"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
