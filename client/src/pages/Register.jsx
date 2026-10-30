import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Select, Typography } from 'antd';
import { useAuth } from '../auth';
import { homePathFor } from '../permissions';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState('student');

  if (user) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  async function onFinish(values) {
    setBusy(true);
    setError('');
    try {
      await register({
        ...values,
        grade: values.role === 'student' ? Number(values.grade) : null,
      });
      const u = await register(values);
      navigate(homePathFor(u));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <Card style={{ width: 'min(440px, 100%)' }} title="Регистрация">
        <Form
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ role: 'student', grade: 7 }}
          onValuesChange={(_, all) => setRole(all.role)}
        >
          <Form.Item name="name" label="Имя" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true, min: 4 }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item name="role" label="Я —" rules={[{ required: true }]}>
            <Select
              size="large"
              options={[
                { value: 'student', label: 'Ученик' },
                { value: 'parent', label: 'Родитель' },
                { value: 'teacher', label: 'Преподаватель' },
              ]}
            />
          </Form.Item>
          {role === 'student' && (
            <Form.Item name="grade" label="Класс" rules={[{ required: true }]}>
              <Select
                size="large"
                options={Array.from({ length: 11 }, (_, i) => ({
                  value: i + 1,
                  label: `${i + 1} класс`,
                }))}
              />
            </Form.Item>
          )}
          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
          <Button type="primary" htmlType="submit" block size="large" loading={busy}>
            Создать аккаунт
          </Button>
        </Form>
        <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
