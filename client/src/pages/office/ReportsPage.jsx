import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Col, List, Row, Space, Statistic, Tag } from 'antd';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { can } from '../../permissions';

function money(n) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/reports/overview')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert type="error" message={error} showIcon />;
  if (!data) return <Card loading />;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        {data.revenuePaid != null && (
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="Оплачено всего" value={money(data.revenuePaid)} />
            </Card>
          </Col>
        )}
        {data.revenueOpen != null && (
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="К оплате" value={money(data.revenueOpen)} />
            </Card>
          </Col>
        )}
        {data.openLeads != null && (
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="Открытых заявок" value={data.openLeads} />
            </Card>
          </Col>
        )}
        {data.homeworkPending != null && (
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="ДЗ в работе" value={data.homeworkPending} />
            </Card>
          </Col>
        )}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            title="Неоплаченные счета"
            extra={
              can(user, 'office.payments') ? (
                <Link to="/office/payments">
                  <Button size="small">К оплатам</Button>
                </Link>
              ) : null
            }
          >
            <List
              dataSource={data.unpaid}
              locale={{ emptyText: 'Все чисто' }}
              renderItem={(p) => (
                <List.Item>
                  <List.Item.Meta
                    title={p.student_name}
                    description={`${p.group_name || p.description} · до ${p.due_date}`}
                  />
                  <Tag color={p.status === 'overdue' ? 'error' : 'warning'}>{money(p.amount)}</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        {data.lowAttendance != null && (
        <Col xs={24} md={12}>
          <Card
            title="Низкая посещаемость"
            extra={
              <Link to="/office/attendance">
                <Button size="small">К журналу</Button>
              </Link>
            }
          >
            <List
              dataSource={data.lowAttendance}
              locale={{ emptyText: 'Пока нет сигналов' }}
              renderItem={(s) => (
                <List.Item>
                  <List.Item.Meta
                    title={s.name}
                    description={`был ${s.present}/${s.marked}, пропуск ${s.absent}`}
                  />
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
