import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useAuth } from '../auth';
import { homePathFor } from '../permissions';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homePathFor(user)} replace />;

  async function onFinish(values) {
    setBusy(true);
    setError('');
    try {
      const u = await login(values.email, values.password);
      navigate(homePathFor(u));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <Card style={{ width: 'min(420px, 100%)' }} title="Вход">
        <Typography.Paragraph type="secondary">
          Демо: student@itscool.local / student123 · admin@itscool.local / admin123
        </Typography.Paragraph>
        <Form
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            email: 'student@itscool.local',
            password: 'student123',
          }}
        >
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true }]}>
            <Input.Password size="large" />
          </Form.Item>
          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
          <Button type="primary" htmlType="submit" block size="large" loading={busy}>
            Войти
          </Button>
        </Form>
        <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
          Нет аккаунта? <Link to="/register">Регистрация</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
