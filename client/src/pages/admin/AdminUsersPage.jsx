import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { can } from '../../permissions';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const allowed = can(user, 'admin.users');

  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState(null);
  const [error, setError] = useState('');
  const [userModal, setUserModal] = useState(null);
  const [userForm] = Form.useForm();

  async function loadRoles() {
    const data = await api('/admin/bootstrap');
    setRoles(data.roles || []);
  }

  async function loadUsers(nextQ = q, nextRole = roleFilter) {
    const params = new URLSearchParams();
    if (nextQ) params.set('q', nextQ);
    if (nextRole) params.set('role', nextRole);
    const data = await api(`/admin/users?${params}`);
    setUsers(data.users || []);
  }

  useEffect(() => {
    if (!allowed) return;
    loadRoles()
      .then(() => loadUsers())
      .catch((e) => setError(e.message));
  }, [allowed]);

  const roleOptions = useMemo(
    () => roles.filter((r) => r.active !== 0).map((r) => ({ value: r.code, label: r.name })),
    [roles]
  );

  if (!allowed) return <Navigate to="/admin/roles" replace />;

  async function saveUser(values) {
    try {
      if (userModal?.id) {
        await api(`/admin/users/${userModal.id}`, {
          method: 'PATCH',
          body: JSON.stringify(values),
        });
        message.success('Пользователь обновлён');
      } else {
        await api('/admin/users', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        message.success('Пользователь создан');
      }
      setUserModal(null);
      userForm.resetFields();
      await loadUsers();
    } catch (e) {
      message.error(e.message);
    }
  }

  const userColumns = [
    { title: 'Имя', dataIndex: 'name' },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Роль',
      dataIndex: 'role',
      render: (r) => {
        const meta = roles.find((x) => x.code === r);
        return <Tag>{meta?.name || r}</Tag>;
      },
    },
    {
      title: 'Активен',
      dataIndex: 'active',
      render: (v) => (v ? <Tag color="green">да</Tag> : <Tag color="red">нет</Tag>),
    },
    {
      title: '',
      key: 'actions',
      render: (_, row) => (
        <Button
          size="small"
          onClick={() => {
            setUserModal(row);
            userForm.setFieldsValue({
              name: row.name,
              email: row.email,
              role: row.role,
              grade: row.grade,
              active: row.active,
              password: '',
            });
          }}
        >
          Изменить
        </Button>
      ),
    },
  ];

  return (
    <>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="Поиск"
            allowClear
            onSearch={(v) => {
              setQ(v);
              loadUsers(v, roleFilter);
            }}
            style={{ width: 220 }}
          />
          <Select
            allowClear
            placeholder="Роль"
            options={roleOptions}
            style={{ width: 180 }}
            onChange={(v) => {
              setRoleFilter(v || null);
              loadUsers(q, v || null);
            }}
          />
          <Button
            type="primary"
            onClick={() => {
              setUserModal({});
              userForm.resetFields();
              userForm.setFieldsValue({ role: 'student', active: true });
            }}
          >
            Добавить человека
          </Button>
        </Space>
        <Table
          rowKey="id"
          columns={userColumns}
          dataSource={users}
          pagination={{ pageSize: 12 }}
          size="middle"
        />
      </Card>

      <Modal
        title={userModal?.id ? 'Редактировать пользователя' : 'Новый пользователь'}
        open={!!userModal}
        onCancel={() => setUserModal(null)}
        onOk={() => userForm.submit()}
        destroyOnClose
      >
        <Form form={userForm} layout="vertical" onFinish={saveUser}>
          <Form.Item name="name" label="Имя" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Роль" rules={[{ required: true }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="grade" label="Класс (для ученика)">
            <InputNumber min={1} max={11} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="password"
            label={userModal?.id ? 'Новый пароль (опционально)' : 'Пароль'}
            rules={userModal?.id ? [] : [{ required: true, min: 4 }]}
          >
            <Input.Password />
          </Form.Item>
          {userModal?.id && (
            <Form.Item name="active" label="Активен" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
