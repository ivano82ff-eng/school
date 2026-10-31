import { useMemo } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Card, Menu, Typography } from 'antd';
import { BookOutlined, HomeOutlined, SafetyCertificateOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuth } from '../../auth';
import { can } from '../../permissions';

export default function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const canUsers = can(user, 'admin.users');
  const canRoles = can(user, 'admin.roles');

  const items = useMemo(() => {
    const list = [];
    if (isAdmin) {
      list.push({ key: '/admin', icon: <HomeOutlined />, label: 'Кабинет' });
      list.push({ key: '/admin/guide', icon: <BookOutlined />, label: 'Гид по платформе' });
    }
    if (canUsers) {
      list.push({ key: '/admin/users', icon: <TeamOutlined />, label: 'Пользователи' });
    }
    if (canRoles) {
      list.push({
        key: '/admin/roles',
        icon: <SafetyCertificateOutlined />,
        label: 'Роли и права',
      });
    }
    return list;
  }, [isAdmin, canUsers, canRoles]);

  if (!canUsers && !canRoles && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isAdmin && (location.pathname === '/admin' || location.pathname === '/admin/')) {
    const dest = canUsers ? '/admin/users' : '/admin/roles';
    return <Navigate to={dest} replace />;
  }

  const selected = location.pathname === '/admin'
    ? ['/admin']
    : location.pathname.startsWith('/admin/roles')
    ? ['/admin/roles']
    : location.pathname.startsWith('/admin/guide')
      ? ['/admin/guide']
      : ['/admin/users'];

  return (
    <div>
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Администрирование
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Люди, роли и видимость разделов (гибкий RBAC)
      </Typography.Paragraph>

      <Card styles={{ body: { padding: 8 } }} style={{ marginBottom: 16 }}>
        <Menu
          mode="horizontal"
          selectedKeys={selected}
          items={items}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', background: 'transparent' }}
        />
      </Card>

      <Outlet />
    </div>
  );
}
