import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Button, Card, Space, Typography } from 'antd';
import { api } from '../api';

export default function CertificatePage() {
  const { id } = useParams();
  const [cert, setCert] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/student/certificates/${id}`)
      .then((d) => setCert(d.certificate))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Alert type="error" message={error} showIcon />;
  if (!cert) return <Card loading />;

  const issued = new Date(cert.issued_at).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }} className="certificate-print">
      <Space>
        <Button onClick={() => window.print()}>Печать</Button>
      </Space>

      <div className="certificate-sheet">
        <p className="certificate-brand">IT-Scool</p>
        <Typography.Title level={2} style={{ marginTop: 0 }}>
          Сертификат
        </Typography.Title>
        <Typography.Paragraph style={{ fontSize: 18 }}>
          Настоящим подтверждается, что
        </Typography.Paragraph>
        <Typography.Title level={3} style={{ color: 'var(--color-primary)', margin: '8px 0 20px' }}>
          {cert.student_name}
        </Typography.Title>
        <Typography.Paragraph style={{ fontSize: 17, maxWidth: 520, margin: '0 auto' }}>
          успешно прошёл(а) курс{' '}
          <strong>
            {cert.icon} {cert.course_title}
          </strong>
          {cert.category ? ` (${cert.category})` : ''}.
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ marginTop: 28 }}>
          Дата выдачи: {issued}
        </Typography.Paragraph>
        <Typography.Text type="secondary">{cert.title}</Typography.Text>
      </div>
    </Space>
  );
}
