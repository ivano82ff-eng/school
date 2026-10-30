import { useMemo } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Card, Menu, Typography } from 'antd';
import {
  BarChartOutlined,
  BookOutlined,
  CalendarOutlined,
  ContactsOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FolderOutlined,
  FundOutlined,
  NotificationOutlined,
  ReadOutlined,
  ScheduleOutlined,
  SettingOutlined,
  TeamOutlined,
  WalletOutlined,
  RocketOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { useAuth } from '../auth';
import { can, flag } from '../permissions';

const ALL_ITEMS = [
  { key: '/office', icon: <FundOutlined />, label: 'Обзор', perm: 'office.dashboard' },
  { key: '/office/landings', icon: <RocketOutlined />, label: 'Лендинги', perm: 'marketing.landings' },
  {
    key: '/office/analytics',
    icon: <LineChartOutlined />,
    label: 'Аналитика',
    perm: ['office.reports', 'marketing.analytics'],
  },
  { key: '/office/leads', icon: <BarChartOutlined />, label: 'CRM', perm: 'office.leads' },
  { key: '/office/trials', icon: <ExperimentOutlined />, label: 'Пробные', perm: 'office.trials' },
  { key: '/office/contacts', icon: <ContactsOutlined />, label: 'Контакты', perm: 'office.contacts' },
  { key: '/office/groups', icon: <TeamOutlined />, label: 'Группы', perm: 'office.groups' },
  { key: '/office/payments', icon: <WalletOutlined />, label: 'Оплаты', perm: 'office.payments' },
  { key: '/office/schedule', icon: <CalendarOutlined />, label: 'Расписание', perm: 'office.schedule' },
  {
    key: '/office/attendance',
    icon: <ScheduleOutlined />,
    label: 'Посещаемость',
    perm: 'office.attendance',
  },
  { key: '/office/homework', icon: <FileTextOutlined />, label: 'ДЗ', perm: 'office.homework' },
  { key: '/office/gradebook', icon: <ReadOutlined />, label: 'Журнал', perm: 'office.gradebook' },
  { key: '/diary', icon: <BookOutlined />, label: 'Дневник', perm: 'diary.access' },
  { key: '/office/materials', icon: <BookOutlined />, label: 'Материалы', perm: 'office.materials' },
  {
    key: '/office/documents',
    icon: <FolderOutlined />,
    label: 'Документы',
    perm: 'office.documents',
  },
  {
    key: '/office/announcements',
    icon: <NotificationOutlined />,
    label: 'Объявления',
    perm: 'office.announcements',
  },
  { key: '/office/reports', icon: <BarChartOutlined />, label: 'Отчёты', perm: 'office.reports' },
  { key: '/teacher', icon: <FileTextOutlined />, label: 'Контент', perm: 'content.teach' },
  { key: '/admin/guide', icon: <SettingOutlined />, label: 'Гид', perm: 'admin.roles' },
  { key: '/admin/users', icon: <SettingOutlined />, label: 'Пользователи', perm: 'admin.users' },
  { key: '/admin/roles', icon: <SettingOutlined />, label: 'Роли', perm: 'admin.roles' },
];

export default function OfficeLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(
    () =>
      ALL_ITEMS.filter((i) => {
        const perms = Array.isArray(i.perm) ? i.perm : [i.perm];
        return can(user, ...perms);
      }).map(({ key, icon, label }) => ({
        key,
        icon,
        label,
      })),
    [user]
  );

  if (!user || !flag(user, 'office')) {
    return <Navigate to="/dashboard" replace />;
  }

  const match = items
    .filter((i) => i.key !== '/office')
    .find((i) => location.pathname.startsWith(i.key));
  const selected = [location.pathname === '/office' ? '/office' : match?.key || location.pathname];

  return (
    <div>
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Офис школы
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Разделы зависят от вашей роли и прав доступа
      </Typography.Paragraph>

      <Card styles={{ body: { padding: 8 } }} style={{ marginBottom: 16, overflowX: 'auto' }}>
        <Menu
          mode="horizontal"
          selectedKeys={selected}
          items={items}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', background: 'transparent', minWidth: Math.max(640, items.length * 110) }}
        />
      </Card>

      <Outlet />
    </div>
  );
}
