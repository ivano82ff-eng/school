import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { can } from '../../permissions';

function groupPermissions(permissions) {
  const map = {};
  for (const p of permissions) {
    if (!map[p.module]) map[p.module] = [];
    map[p.module].push(p);
  }
  return map;
}

export default function AdminRolesPage() {
  const { user } = useAuth();
  const allowed = can(user, 'admin.roles');
  const { code } = useParams();
  const navigate = useNavigate();

  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [roleEdit, setRoleEdit] = useState(null);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [roleForm] = Form.useForm();

  async function loadRolesFull() {
    const data = await api('/admin/roles');
    setRoles(data.roles || []);
    setPermissions(data.permissions || []);
    return data.roles || [];
  }

  useEffect(() => {
    if (!allowed) return;
    loadRolesFull()
      .then((list) => {
        if (code) {
          const found = list.find((r) => r.code === code);
          if (found) {
            setRoleEdit({ ...found, permissions: [...(found.permissions || [])] });
          } else {
            setError(`Роль «${code}» не найдена`);
            setRoleEdit(null);
          }
        } else {
          setRoleEdit(null);
        }
      })
      .catch((e) => setError(e.message));
  }, [allowed, code]);

  const permGroups = useMemo(() => groupPermissions(permissions), [permissions]);

  if (!allowed) {
    return can(user, 'admin.users') ? (
      <Navigate to="/admin/users" replace />
    ) : (
      <Navigate to="/dashboard" replace />
    );
  }

  async function saveRolePerms() {
    if (!roleEdit) return;
    try {
      await api(`/admin/roles/${roleEdit.code}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: roleEdit.name,
          description: roleEdit.description,
          active: roleEdit.active !== 0,
          permissions: roleEdit.permissions || [],
        }),
      });
      message.success('Права роли сохранены');
      const list = await loadRolesFull();
      const refreshed = list.find((r) => r.code === roleEdit.code);
      if (refreshed) {
        setRoleEdit({ ...refreshed, permissions: [...(refreshed.permissions || [])] });
      }
    } catch (e) {
      message.error(e.message);
    }
  }

  async function createRole(values) {
    try {
      const created = await api('/admin/roles', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success('Роль создана');
      setCreateOpen(false);
      roleForm.resetFields();
      await loadRolesFull();
      navigate(`/admin/roles/${created.role.code}`);
    } catch (e) {
      message.error(e.message);
    }
  }

  return (
    <>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card
            title="Роли"
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setCreateOpen(true)}
              >
                Создать
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {roles.map((r) => (
                <Button
                  key={r.code}
                  block
                  type={code === r.code ? 'primary' : 'default'}
                  onClick={() => navigate(`/admin/roles/${r.code}`)}
                >
                  {r.name}
                  {r.active === 0 ? ' (выкл)' : ''}
                </Button>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          {roleEdit ? (
            <Card
              title={`Права: ${roleEdit.name}`}
              extra={
                <Space>
                  <Switch
                    checked={roleEdit.active !== 0}
                    disabled={roleEdit.code === 'admin'}
                    checkedChildren="вкл"
                    unCheckedChildren="выкл"
                    onChange={(v) => setRoleEdit({ ...roleEdit, active: v ? 1 : 0 })}
                  />
                  <Button type="primary" onClick={saveRolePerms}>
                    Сохранить
                  </Button>
                </Space>
              }
            >
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                URL: /admin/roles/{roleEdit.code}
              </Typography.Text>
              <Input
                value={roleEdit.name}
                onChange={(e) => setRoleEdit({ ...roleEdit, name: e.target.value })}
                style={{ marginBottom: 8 }}
              />
              <Input.TextArea
                rows={2}
                value={roleEdit.description || ''}
                onChange={(e) => setRoleEdit({ ...roleEdit, description: e.target.value })}
                style={{ marginBottom: 16 }}
                placeholder="Описание роли"
              />
              {Object.entries(permGroups).map(([mod, list]) => (
                <div key={mod} style={{ marginBottom: 16 }}>
                  <Typography.Text strong style={{ textTransform: 'uppercase' }}>
                    {mod}
                  </Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    <Checkbox.Group
                      style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                      value={(roleEdit.permissions || []).filter((c) =>
                        list.some((p) => p.code === c)
                      )}
                      onChange={(vals) => {
                        const other = (roleEdit.permissions || []).filter(
                          (c) => !list.some((p) => p.code === c)
                        );
                        setRoleEdit({
                          ...roleEdit,
                          permissions: [...other, ...vals],
                        });
                      }}
                      options={list.map((p) => ({
                        value: p.code,
                        label: `${p.name} (${p.code})`,
                      }))}
                    />
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <Card>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                Выберите роль слева или создайте новую. После создания откроется страница правки.
              </Typography.Paragraph>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                Создать роль
              </Button>
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="Новая роль"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => roleForm.submit()}
        destroyOnClose
        okText="Создать"
      >
        <Form form={roleForm} layout="vertical" onFinish={createRole}>
          <Form.Item name="code" label="Код (латиница)" rules={[{ required: true }]}>
            <Input placeholder="curator" />
          </Form.Item>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input placeholder="Куратор" />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="permissions" label="Права">
            <Select
              mode="multiple"
              options={permissions.map((p) => ({
                value: p.code,
                label: `${p.name} (${p.code})`,
              }))}
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
