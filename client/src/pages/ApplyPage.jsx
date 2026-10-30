import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Select, Typography, message } from 'antd';
import { api } from '../api';

export default function ApplyPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onFinish(values) {
    setBusy(true);
    setError('');
    try {
      await api('/leads/public', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          child_grade: Number(values.child_grade),
          source: 'website',
        }),
      });
      setDone(true);
      message.success('Заявка отправлена');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <Card title="Заявка на обучение" style={{ width: 'min(480px, 100%)' }}>
        <Typography.Paragraph type="secondary">
          Оставьте контакты — школа свяжется и предложит пробный урок.
        </Typography.Paragraph>
        {done ? (
          <Alert type="success" showIcon message="Заявка отправлена! Мы скоро напишем." />
        ) : (
          <Form layout="vertical" onFinish={onFinish} initialValues={{ child_grade: 5, interest: 'Python' }}>
            <Form.Item name="name" label="Ваше имя" rules={[{ required: true }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item name="phone" label="Телефон">
              <Input size="large" />
            </Form.Item>
            <Form.Item name="email" label="Email">
              <Input type="email" size="large" />
            </Form.Item>
            <Form.Item name="child_name" label="Имя ребёнка">
              <Input size="large" />
            </Form.Item>
            <Form.Item name="child_grade" label="Класс">
              <Select
                size="large"
                options={Array.from({ length: 11 }, (_, i) => ({ value: i + 1, label: `${i + 1}` }))}
              />
            </Form.Item>
            <Form.Item name="interest" label="Интерес">
              <Input size="large" placeholder="Python, Scratch, веб..." />
            </Form.Item>
            {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
            <Button type="primary" htmlType="submit" block size="large" loading={busy}>
              Отправить заявку
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
