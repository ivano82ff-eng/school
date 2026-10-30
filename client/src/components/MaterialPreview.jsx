import { useEffect, useState } from 'react';
import { Alert, Button, Card, Modal, Space, Spin, Typography } from 'antd';
import { DownloadOutlined, FileOutlined } from '@ant-design/icons';
import { downloadMaterial, fetchMaterialBlob } from '../api';

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
const VIDEO = new Set(['mp4', 'webm', 'mov']);

const TYPE_LABEL = {
  ppt: 'Презентация PowerPoint',
  pptx: 'Презентация PowerPoint',
  key: 'Презентация Keynote',
  pdf: 'PDF',
  mp4: 'Видео MP4',
  webm: 'Видео WebM',
  mov: 'Видео MOV',
  doc: 'Документ Word',
  docx: 'Документ Word',
  odt: 'Документ',
  txt: 'Текст',
  rtf: 'Документ RTF',
  xls: 'Таблица Excel',
  xlsx: 'Таблица Excel',
  csv: 'Таблица CSV',
  png: 'Изображение PNG',
  jpg: 'Изображение JPEG',
  jpeg: 'Изображение JPEG',
  gif: 'Изображение GIF',
  webp: 'Изображение WebP',
  zip: 'Архив ZIP',
};

function fileExt(name) {
  const base = String(name || '').split(/[/\\]/).pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

function previewKind(ext) {
  if (ext === 'pdf') return 'pdf';
  if (IMAGE.has(ext)) return 'image';
  if (VIDEO.has(ext)) return 'video';
  return 'file';
}

export default function MaterialPreview({ material, open, onClose }) {
  const name = material?.original_name || material?.title || 'Файл';
  const ext = fileExt(name);
  const kind = previewKind(ext);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !material?.id || kind === 'file') {
      setUrl('');
      setLoading(false);
      setError('');
      return undefined;
    }
    let cancelled = false;
    let objectUrl = '';
    setLoading(true);
    setError('');
    setUrl('');
    fetchMaterialBlob(material.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, material?.id, kind]);

  async function onDownload() {
    setError('');
    try {
      await downloadMaterial(material.id, name);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={material?.title || 'Материал'}
      width={kind === 'file' ? 520 : 880}
      destroyOnClose
      footer={[
        <Button key="download" icon={<DownloadOutlined />} onClick={onDownload}>
          Скачать
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Закрыть
        </Button>,
      ]}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      {loading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      )}
      {kind === 'image' && url && (
        <img src={url} alt={name} style={{ display: 'block', maxWidth: '100%', margin: '0 auto' }} />
      )}
      {kind === 'pdf' && url && (
        <iframe title={name} src={url} style={{ width: '100%', height: '70vh', border: 0 }} />
      )}
      {kind === 'video' && url && (
        <video src={url} controls style={{ width: '100%', maxHeight: '70vh' }} />
      )}
      {kind === 'file' && (
        <Card>
          <Space align="start" size={16}>
            <FileOutlined style={{ fontSize: 28 }} />
            <div>
              <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
                {name}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                {TYPE_LABEL[ext] || 'Файл'}
              </Typography.Paragraph>
              <Typography.Paragraph style={{ marginBottom: 12 }}>
                Этот тип открывается скачиванием. В окне можно увидеть имя и тип файла.
              </Typography.Paragraph>
              <Button type="primary" icon={<DownloadOutlined />} onClick={onDownload}>
                Скачать
              </Button>
            </div>
          </Space>
        </Card>
      )}
    </Modal>
  );
}
