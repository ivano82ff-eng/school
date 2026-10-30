import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Input,
  Row,
  Space,
  Switch,
  Typography,
  message,
} from 'antd';
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
          if (found?.live) {
            setRoleEdit({ ...found, permissions: [...(found.permissions || [])] });
          } else if (found) {
            setError('Эта роль отключена и не назначается');
            setRoleEdit(null);
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

  const visibleRoles = roles.filter((r) => r.live);

  return (
    <>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card title="Роли">
            <Space direction="vertical" style={{ width: '100%' }}>
              {visibleRoles.map((r) => (
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
                    disabled
                    checkedChildren="вкл"
                    unCheckedChildren="выкл"
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
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                Выберите роль слева. Сейчас работают администратор, преподаватель, ученик и
                родитель.
              </Typography.Paragraph>
            </Card>
          )}
        </Col>
      </Row>
    </>
  );
}
