import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Col, Row, Space, Statistic, Tag, Typography, List } from 'antd';
import { api } from '../../api';
import { useAuth } from '../../auth';

function money(n) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s.replace(' ', 'T')).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OfficeHome() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/office/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert type="error" message={error} showIcon />;
  if (!data) return <Card loading />;

  const { stats, upcoming, recentPayments, recentLeads = [], visibility = {} } = data;
  const showMoney = visibility.payments;
  const showLeads = visibility.leads;
  const showSchedule = visibility.schedule;
  const statCards = [
    ['Ученики', stats.students],
    ['Родители', stats.parents],
    ['Группы', stats.groups],
  ];
  if (showLeads) statCards.push(['Заявки', stats.leadsOpen || 0]);
  if (showMoney) {
    statCards.push(['Просрочки', stats.overdue]);
    statCards.push(['К оплате', money(stats.pendingSum)]);
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        {statCards.map(([title, value]) => (
          <Col xs={12} sm={8} md={4} key={title}>
            <Card size="small">
              <Statistic title={title} value={value} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {showSchedule && (
        <Col xs={24} lg={8}>
          <Card
            title="Ближайшие занятия"
            extra={<Link to="/office/schedule">Все</Link>}
            size="small"
          >
            <List
              size="small"
              dataSource={upcoming}
              locale={{ emptyText: 'Пока пусто' }}
              renderItem={(s) => (
                <List.Item>
                  <List.Item.Meta title={s.group_name} description={fmtDate(s.starts_at)} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        )}
        {showLeads && (
        <Col xs={24} lg={8}>
          <Card title="Новые заявки" extra={<Link to="/office/leads">CRM</Link>} size="small">
            <List
              size="small"
              dataSource={recentLeads}
              locale={{ emptyText: 'Пока пусто' }}
              renderItem={(l) => (
                <List.Item>
                  <List.Item.Meta title={l.name} description={<Tag>{l.status}</Tag>} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        )}
        {showMoney && (
        <Col xs={24} lg={8}>
          <Card title="Платежи" extra={user && <Link to="/office/reports">Отчёты</Link>} size="small">
            <List
              size="small"
              dataSource={recentPayments}
              locale={{ emptyText: 'Пока пусто' }}
              renderItem={(p) => (
                <List.Item>
                  <Typography.Text>{p.student_name}</Typography.Text>
                  <Typography.Text strong>{money(p.amount)}</Typography.Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        )}
      </Row>
    </Space>
  );
}
