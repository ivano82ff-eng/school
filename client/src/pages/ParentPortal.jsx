import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Alert, Button, Card, List, Space, Tag } from 'antd';
import { api } from '../api';
import { useAuth } from '../auth';
import { flag } from '../permissions';
import { CabinetGrid, CabinetShell } from '../components/CabinetShell';

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
    <CabinetShell
      title="Кабинет родителя"
      subtitle="Оплаты, расписание, посещаемость и домашние задания"
    >
      {data.children.length === 0 ? (
        <Alert type="info" message="Пока нет привязанных детей. Попросите школу связать ваш контакт." />
      ) : (
        data.children.map(({ child, groups, payments, attendance, attendanceMarks, homework, upcoming, grades }) => (
          <Card
            key={child.id}
            className="cabinet-card"
            title={`${child.name}${child.grade ? ` · ${child.grade} класс` : ''}`}
            extra={
              <Link to="/messages">
                <Button size="small">Написать в школу</Button>
              </Link>
            }
          >
            <CabinetGrid columns={3}>
              <Card className="cabinet-card" title="Группы">
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
              </Card>
              <Card className="cabinet-card" title="Ближайшие занятия">
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
              </Card>
              <Card className="cabinet-card" title="Счета">
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
              </Card>
              <Card className="cabinet-card" title="Посещаемость">
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
              </Card>
              <Card className="cabinet-card" title="Домашние задания">
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
              </Card>
              <Card className="cabinet-card" title="Оценки">
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
              </Card>
            </CabinetGrid>
          </Card>
        ))
      )}
    </CabinetShell>
  );
}
