import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Select, Table, Typography, message } from 'antd';
import { api } from '../../api';

export default function AttendancePage() {
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState();
  const [roster, setRoster] = useState([]);
  const [marks, setMarks] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    api('/schedule')
      .then((d) => setSessions(d.sessions))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setRoster([]);
      return;
    }
    api(`/attendance/session/${sessionId}`)
      .then((d) => {
        setRoster(d.roster);
        const initial = {};
        for (const r of d.roster) initial[r.contact_id] = r.attendance_status || 'present';
        setMarks(initial);
      })
      .catch((e) => setError(e.message));
  }, [sessionId]);

  async function save() {
    try {
      await api(`/attendance/session/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
          marks: Object.entries(marks).map(([contact_id, status]) => ({
            contact_id: Number(contact_id),
            status,
          })),
        }),
      });
      message.success('Посещаемость сохранена');
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    {
      title: 'Ученик',
      render: (_, r) => (
        <div>
          <strong>{r.name}</strong>
          <div style={{ color: '#4d6b60' }}>{r.grade ? `${r.grade} кл.` : ''}</div>
        </div>
      ),
    },
    {
      title: 'Статус',
      render: (_, r) => (
        <Select
          style={{ width: 180 }}
          value={marks[r.contact_id] || 'present'}
          onChange={(v) => setMarks((m) => ({ ...m, [r.contact_id]: v }))}
          options={[
            { value: 'present', label: 'Присутствовал' },
            { value: 'late', label: 'Опоздал' },
            { value: 'absent', label: 'Отсутствовал' },
            { value: 'excused', label: 'Уважительно' },
          ]}
        />
      ),
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Card>
          {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
          <Form.Item label="Занятие">
            <Select
              placeholder="Выбери занятие"
              style={{ width: '100%' }}
              value={sessionId}
              onChange={setSessionId}
              options={sessions.map((s) => ({
                value: s.id,
                label: `${s.group?.name} · ${s.title || 'Занятие'} · ${s.starts_at}`,
              }))}
            />
          </Form.Item>
          {roster.length > 0 && (
            <>
              <Table rowKey="contact_id" columns={columns} dataSource={roster} pagination={false} />
              <Button type="primary" style={{ marginTop: 12 }} onClick={save}>
                Сохранить журнал
              </Button>
            </>
          )}
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card title="Как пользоваться">
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Выберите занятие, отметьте кто был на уроке и сохраните. Занятие станет «проведено».
          </Typography.Paragraph>
        </Card>
      </Col>
    </Row>
  );
}
