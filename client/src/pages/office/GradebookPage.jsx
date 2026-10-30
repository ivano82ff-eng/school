import { useEffect, useState } from 'react';
import {
  Alert,
  Card,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { api } from '../../api';

export default function GradebookPage() {
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState(null);
  const [students, setStudents] = useState([]);
  const [group, setGroup] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    api('/gradebook')
      .then((d) => {
        setGroups(d.groups || []);
        if (d.groups?.[0]) setGroupId(d.groups[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!groupId) return;
    api(`/gradebook?group_id=${groupId}`)
      .then((d) => {
        setStudents(d.students || []);
        setGroup(d.group || null);
      })
      .catch((e) => setError(e.message));
  }, [groupId]);

  const columns = [
    { title: 'Ученик', dataIndex: 'name', key: 'name' },
    {
      title: 'Класс',
      dataIndex: 'grade',
      key: 'grade',
      width: 90,
      render: (g) => g || '—',
    },
    {
      title: 'ДЗ сдано',
      key: 'hw',
      render: (_, r) => `${r.stats.homeworkDone}/${r.stats.homeworkTotal}`,
    },
    {
      title: 'Оценено',
      key: 'graded',
      render: (_, r) => r.stats.homeworkGraded,
    },
    {
      title: 'Средний тест %',
      key: 'quiz',
      render: (_, r) =>
        r.stats.quizAvg != null ? <Tag color="processing">{r.stats.quizAvg}%</Tag> : '—',
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          Журнал оценок
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Домашки и тесты по группе
        </Typography.Paragraph>
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      <Select
        style={{ minWidth: 280 }}
        placeholder="Группа"
        value={groupId}
        onChange={setGroupId}
        options={groups.map((g) => ({
          value: g.id,
          label: `${g.name}${g.course_title ? ` · ${g.course_title}` : ''}`,
        }))}
      />

      {group && (
        <Card title={group.name} size="small">
          <Table
            rowKey="contact_id"
            dataSource={students}
            columns={columns}
            pagination={false}
            expandable={{
              expandedRowKeys: Object.keys(expanded).filter((k) => expanded[k]),
              onExpand: (open, record) =>
                setExpanded((e) => ({ ...e, [record.contact_id]: open })),
              expandedRowRender: (r) => (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Typography.Text strong>Домашние задания</Typography.Text>
                  {r.homework.map((h) => (
                    <div key={h.id}>
                      {h.title}:{' '}
                      <Tag>{h.status || '—'}</Tag>
                      {h.grade ? <Tag color="success">{h.grade}</Tag> : null}
                      {h.teacher_note ? (
                        <Typography.Text type="secondary"> · {h.teacher_note}</Typography.Text>
                      ) : null}
                    </div>
                  ))}
                  <Typography.Text strong>Тесты</Typography.Text>
                  {r.quizzes.length === 0 ? (
                    <Typography.Text type="secondary">Нет тестов по курсу группы</Typography.Text>
                  ) : (
                    r.quizzes.map((q) => (
                      <div key={q.id}>
                        {q.lesson_title}:{' '}
                        {q.score != null ? (
                          <Tag color="processing">
                            {q.score}/{q.total} ({q.percent}%)
                          </Tag>
                        ) : (
                          <Tag>не сдан</Tag>
                        )}
                      </div>
                    ))
                  )}
                </Space>
              ),
            }}
          />
        </Card>
      )}
    </Space>
  );
}
