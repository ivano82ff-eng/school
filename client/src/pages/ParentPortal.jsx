import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Alert, Button, Card, Col, List, Row, Space, Tag, Typography } from 'antd';
import { api } from '../api';
import { useAuth } from '../auth';
import { flag } from '../permissions';

const BILL_STATUS = {
  pending: 'К оплате',
  overdue: 'Просрочен',
  paid: 'Оплачен',
  cancelled: 'Отменён',
};

function money(n) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function ParentPortal() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/parent/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (!flag(user, 'parent')) {
    return <Navigate to="/dashboard" replace />;
  }

  if (error) return <Alert type="error" message={error} showIcon />;
  if (!data) return <Card loading />;

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 4 }}>
          Кабинет родителя
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Оплаты, расписание, посещаемость и домашние задания
        </Typography.Paragraph>
      </div>

      {data.children.length === 0 ? (
        <Alert type="info" message="Пока нет привязанных детей. Попросите школу связать ваш контакт." />
      ) : (
        data.children.map(({ child, groups, payments, attendance, attendanceMarks, homework, upcoming, grades }) => (
          <Card
            key={child.id}
            title={`${child.name}${child.grade ? ` · ${child.grade} класс` : ''}`}
            extra={
              <Link to="/messages">
                <Button size="small">Написать в школу</Button>
              </Link>
            }
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12} lg={8}>
                <Typography.Title level={5}>Группы</Typography.Title>
                <List
                  size="small"
                  dataSource={groups}
                  locale={{ emptyText: 'Нет групп' }}
                  renderItem={(g) => (
                    <List.Item>
                      <List.Item.Meta title={g.name} description={g.course_title} />
                    </List.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <Typography.Title level={5}>Ближайшие занятия</Typography.Title>
                <List
                  size="small"
                  dataSource={upcoming}
                  locale={{ emptyText: 'Пока пусто' }}
                  renderItem={(s) => (
                    <List.Item>
                      <List.Item.Meta title={s.group_name} description={s.starts_at} />
                    </List.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <Typography.Title level={5}>Счета</Typography.Title>
                <List
                  size="small"
                  dataSource={payments}
                  locale={{ emptyText: 'Счетов нет' }}
                  renderItem={(p) => (
                    <List.Item>
                      <List.Item.Meta
                        title={`Счёт №${p.id} · ${money(p.amount)}`}
                        description={`${BILL_STATUS[p.status] || p.status} · до ${p.due_date}${
                          p.group_name ? ` · ${p.group_name}` : ''
                        }${p.description ? ` · ${p.description}` : ''}`}
                      />
                      <Tag color={p.status === 'paid' ? 'success' : p.status === 'overdue' ? 'error' : 'warning'}>
                        {BILL_STATUS[p.status] || p.status}
                      </Tag>
                    </List.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <Typography.Title level={5}>Посещаемость</Typography.Title>
                <Space wrap style={{ marginBottom: 8 }}>
                  {attendance.map((a) => (
                    <Tag key={a.status}>
                      {a.status}: {a.c}
                    </Tag>
                  ))}
                </Space>
                <List
                  size="small"
                  dataSource={attendanceMarks || []}
                  locale={{ emptyText: 'Нет отметок' }}
                  renderItem={(mark) => (
                    <List.Item>
                      <List.Item.Meta
                        title={`${mark.group_name}${mark.title ? ` · ${mark.title}` : ''}`}
                        description={`${mark.starts_at} · ${mark.status}`}
                      />
                    </List.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <Typography.Title level={5}>Домашние задания</Typography.Title>
                <List
                  size="small"
                  dataSource={homework}
                  locale={{ emptyText: 'Нет заданий' }}
                  renderItem={(h) => (
                    <List.Item>
                      <List.Item.Meta
                        title={h.title}
                        description={
                          <Space>
                            <Tag>{h.status}</Tag>
                            {h.grade && <Tag color="success">{h.grade}</Tag>}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <Typography.Title level={5}>Оценки</Typography.Title>
                <List
                  size="small"
                  dataSource={grades || []}
                  locale={{ emptyText: 'Пока нет' }}
                  renderItem={(g) => (
                    <List.Item>
                      <List.Item.Meta
                        title={g.group_name}
                        description={
                          <>
                            {g.quizAvg != null ? `Тесты: ${g.quizAvg}%. ` : ''}
                            {(g.homework || []).length === 0
                              ? 'Оценок ДЗ пока нет'
                              : (g.homework || []).map((row) => `${row.title}: ${row.grade}`).join(' · ')}
                          </>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Col>
            </Row>
          </Card>
        ))
      )}
    </Space>
  );
}
