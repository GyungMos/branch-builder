import { useState } from 'react';
import { formatDate } from '../../utils/formatters';
import NeonIcon from '../common/NeonIcon';
import './PhotoGallery.css';

export default function PhotoGallery({ documents }) {
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const photos = documents.filter(doc =>
    doc.fileType?.startsWith('image/') && doc.fileUrl
  );

  if (photos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <NeonIcon name="photo" size="lg" color="rose" badge={true} />
        </div>
        <div className="empty-state-title">사진이 없습니다</div>
        <div className="empty-state-desc">서류 탭에서 이미지를 업로드하면 여기에 갤러리로 표시됩니다</div>
      </div>
    );
  }

  return (
    <div className="photo-gallery" id="photo-gallery">
      <div className="gallery-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <NeonIcon name="photo" size="xs" color="rose" badge={false} />
          <span>공사 사진</span>
        </h4>
        <span className="badge badge-neutral">{photos.length}장</span>
      </div>

      <div className="gallery-grid">
        {photos.map(photo => (
          <div
            key={photo.id}
            className="gallery-item"
            onClick={() => setSelectedPhoto(photo)}
          >
            <img src={photo.fileUrl} alt={photo.name || photo.fileName} loading="lazy" />
            <div className="gallery-item-overlay">
              <span className="gallery-item-name">{photo.name || photo.fileName}</span>
              <span className="gallery-item-date">
                {photo.createdAt ? formatDate(photo.createdAt) : ''}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 라이트박스 */}
      {selectedPhoto && (
        <>
          <div className="lightbox-backdrop" onClick={() => setSelectedPhoto(null)} />
          <div className="lightbox" onClick={() => setSelectedPhoto(null)}>
            <button className="lightbox-close" onClick={() => setSelectedPhoto(null)}>✕</button>
            <img
              src={selectedPhoto.fileUrl}
              alt={selectedPhoto.name || selectedPhoto.fileName}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="lightbox-info">
              <h4>{selectedPhoto.name || selectedPhoto.fileName}</h4>
              <p>{selectedPhoto.createdAt ? formatDate(selectedPhoto.createdAt) : ''}</p>
              {selectedPhoto.memo && <p className="text-secondary">{selectedPhoto.memo}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
