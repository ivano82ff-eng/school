import { useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Drawer,
  Flex,
  Grid,
  Layout as AntLayout,
  Menu,
  Space,
  Typography,
} from 'antd';
import {
  BookOutlined,
  FormOutlined,
  HomeOutlined,
  MailOutlined,
  MenuOutlined,
  MoonOutlined,
  ProjectOutlined,
  ReadOutlined,
  SettingOutlined,
  SunOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuth } from '../auth';
import { flag } from '../permissions';
import { useThemeMode } from '../theme/ThemeProvider';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import OnboardingTour, { useTourReplay } from '../onboarding/OnboardingTour';

const { Header, Content, Footer } = AntLayout;
const { useBreakpoint } = Grid;

export default function Layout() {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const { forceKey, replayTour } = useTourReplay();
  const location = useLocation();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return ['/admin/guide'];
    if (path.startsWith('/office')) return ['/office'];
    if (path.startsWith('/teacher')) return ['/teacher'];
    if (path.startsWith('/parent')) return ['/parent'];
    if (path.startsWith('/portfolio')) return ['/portfolio'];
    if (path.startsWith('/diary')) return ['/diary'];
    if (path.startsWith('/messages')) return ['/messages'];
    if (path.startsWith('/dashboard')) return ['/dashboard'];
    if (path.startsWith('/courses')) return ['/courses'];
    if (path.startsWith('/product')) return ['/product'];
    return [path];
  }, [location.pathname]);

  const items = useMemo(() => {
    const list = [
      { key: '/courses', icon: <BookOutlined />, label: 'Курсы' },
    ];
    if (user) {
      if (flag(user, 'student') || user.role === 'admin') {
        list.push({
          key: '/dashboard',
          icon: <ReadOutlined />,
          label: 'Моё обучение',
        });
      }
      if (flag(user, 'diary')) {
        list.push({ key: '/diary', icon: <FormOutlined />, label: 'Дневник' });
      }
      if (flag(user, 'portfolio')) {
        list.push({
          key: '/portfolio',
          icon: <ProjectOutlined />,
          label: 'Портфолио',
        });
      }
      if (flag(user, 'documents')) {
        list.push({
          key: '/documents',
          icon: <BookOutlined />,
          label: 'Документы',
        });
      }
      if (flag(user, 'messages')) {
        list.push({
          key: '/messages',
          icon: <MailOutlined />,
          label: 'Сообщения',
        });
      }
      if (flag(user, 'parent')) {
        list.push({
          key: '/parent',
          icon: <UserOutlined />,
          label: 'Кабинет родителя',
        });
      }
      if (flag(user, 'office')) {
        list.push({ key: '/office', icon: <TeamOutlined />, label: 'Офис' });
      }
      if (flag(user, 'content')) {
        list.push({ key: '/teacher', icon: <HomeOutlined />, label: 'Контент' });
      }
      if (flag(user, 'admin')) {
        list.push({
          key: '/admin/guide',
          icon: <SettingOutlined />,
          label: 'Админ',
        });
      }
    }
    return list;
  }, [user]);

  function onMenuClick({ key }) {
    navigate(key);
    setOpen(false);
  }

  return (
    <div className="app-shell">
      <AntLayout>
        <Header className="app-header">
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setOpen(true)}
              aria-label="Меню"
            />
          )}
          <Link to="/" className="brand-link" data-tour="brand">
            <span className="brand-mark">IT</span>
            <span>Scool</span>
          </Link>

          {!isMobile && (
            <Menu
              mode="horizontal"
              selectedKeys={selected}
              items={items.map((item) =>
                item.key === '/courses'
                  ? { ...item, label: <span data-tour="nav-courses">{item.label}</span> }
                  : item.key === '/dashboard'
                    ? { ...item, label: <span data-tour="nav-dashboard">{item.label}</span> }
                    : item.key === '/office'
                      ? { ...item, label: <span data-tour="nav-office">{item.label}</span> }
                      : item.key === '/teacher'
                        ? { ...item, label: <span data-tour="nav-content">{item.label}</span> }
                        : item.key === '/parent'
                          ? { ...item, label: <span data-tour="nav-parent">{item.label}</span> }
                          : item
              )}
              onClick={onMenuClick}
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent' }}
            />
          )}

          <Flex align="center" gap={8} style={{ marginLeft: 'auto' }}>
            {user && flag(user, 'search') && !isMobile && <GlobalSearch />}
            <Button
              type="text"
              icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleMode}
              aria-label={mode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              title={mode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            />
            {user ? (
              <>
                <NotificationBell />
                <Button type="text" data-tour="tour-help" onClick={replayTour}>
                  Гид
                </Button>
                {!isMobile && (
                  <Typography.Text type="secondary">{user.name}</Typography.Text>
                )}
                <Button onClick={logout}>Выйти</Button>
              </>
            ) : (
              <Space>
                <Button type="text" onClick={() => navigate('/login')}>
                  Войти
                </Button>
                <Button type="primary" onClick={() => navigate('/register')}>
                  Регистрация
                </Button>
              </Space>
            )}
          </Flex>
        </Header>

        <Drawer
          title="Меню"
          placement="left"
          open={open}
          onClose={() => setOpen(false)}
          styles={{ body: { padding: 0 } }}
        >
          <Menu
            mode="inline"
            selectedKeys={selected}
            items={items}
            onClick={onMenuClick}
          />
        </Drawer>

        <Content>
          <div className="app-content">
            <Outlet />
          </div>
        </Content>

        <Footer className="app-footer">
          IT-Scool — обучающая платформа IT-курсов для школьников 1–11 классов ·{' '}
          <Link to="/product">Презентация для заказчика</Link>
        </Footer>
      </AntLayout>
      {user && <OnboardingTour user={user} forceKey={forceKey} />}
    </div>
  );
}
