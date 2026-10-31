import { useEffect, useState } from 'react';
import { Alert, Button, Card, Modal, Space, Spin, Typography } from 'antd';
import { DownloadOutlined, FileOutlined } from '@ant-design/icons';
import { downloadMaterial, fetchMaterialBlob } from '../api';
import CourseFileViewer, { canViewInBrowser, fileExt } from './CourseFileViewer';

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

export default function MaterialPreview({ material, open, onClose }) {
  const name = material?.original_name || material?.title || 'Файл';
  const ext = fileExt(name);
  const viewable = canViewInBrowser(ext);
  const [blob, setBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !material?.id || !viewable) {
      setBlob(null);
      setLoading(false);
      setError('');
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setBlob(null);
    fetchMaterialBlob(material.id)
      .then((file) => {
        if (!cancelled) setBlob(file);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, material?.id, viewable]);

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
      width={viewable ? 880 : 520}
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
      {viewable && blob && <CourseFileViewer blob={blob} name={name} />}
      {!viewable && (
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
