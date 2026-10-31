import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Col, Row, Space, Statistic, Typography } from 'antd';
import { api } from '../../api';

function money(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function AdminHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/admin/summary')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert type="error" showIcon message={error} />;
  if (!data) return <Card loading />;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Paragraph type="secondary">
        Сводка школы: ученики, курсы, ближайшие занятия и неоплаченные счета.
      </Typography.Paragraph>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Ученики" value={data.students} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Курсы" value={data.courses} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Ближайшие занятия" value={data.upcoming} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Просрочено" value={money(data.bills.overdueSum)} />
          </Card>
        </Col>
      </Row>
      <Card>
        <Typography.Paragraph>
          К оплате: {data.bills.pendingCount} на {money(data.bills.pendingSum)}. Просрочено:{' '}
          {data.bills.overdueCount}.
        </Typography.Paragraph>
        <Space wrap>
          <Link to="/admin/users">
            <Button type="primary">Люди</Button>
          </Link>
          <Link to="/office/payments">
            <Button>Счета</Button>
          </Link>
          <Link to="/teacher/blocks">
            <Button>Конструктор курсов</Button>
          </Link>
          <Link to="/teacher">
            <Button>Кабинет преподавателя</Button>
          </Link>
        </Space>
      </Card>
    </Space>
  );
}
