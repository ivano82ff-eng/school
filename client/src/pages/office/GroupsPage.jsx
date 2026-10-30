import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  List,
  Row,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import { api } from '../../api';

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [form] = Form.useForm();
  const [memberId, setMemberId] = useState();

  function loadGroups() {
    api('/groups')
      .then((d) => setGroups(d.groups))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadGroups();
    api('/courses').then((d) => setCourses(d.courses)).catch(() => {});
    api('/contacts?type=student').then((d) => setStudents(d.contacts)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    api(`/groups/${selected}`)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [selected]);

  async function createGroup(values) {
    try {
      await api('/groups', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          course_id: values.course_id || null,
          max_students: Number(values.max_students),
        }),
      });
      form.resetFields();
      message.success('Группа создана');
      loadGroups();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addMember() {
    if (!selected || !memberId) return;
    try {
      await api(`/groups/${selected}/members`, {
        method: 'POST',
        body: JSON.stringify({ contact_id: Number(memberId) }),
      });
      setMemberId(undefined);
      message.success('Ученик добавлен');
      setDetail(await api(`/groups/${selected}`));
      loadGroups();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeMember(contactId) {
    await api(`/groups/${selected}/members/${contactId}`, { method: 'DELETE' });
    setDetail(await api(`/groups/${selected}`));
    loadGroups();
  }

  const columns = [
    { title: 'Группа', dataIndex: 'name' },
    { title: 'Курс', render: (_, g) => g.course?.title || '—' },
    { title: 'Преподаватель', render: (_, g) => g.teacher?.name || '—' },
    {
      title: 'Мест',
      render: (_, g) => `${g.membersCount}/${g.max_students}`,
      width: 90,
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {error && <Alert type="error" message={error} showIcon />}
          <Card styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={groups}
              pagination={false}
              onRow={(g) => ({
                onClick: () => setSelected(g.id),
                style: { cursor: 'pointer', background: selected === g.id ? 'var(--color-selection)' : undefined },
              })}
              scroll={{ x: 560 }}
            />
          </Card>
          {detail && (
            <Card title={detail.group.name}>
              <List
                size="small"
                header={<Typography.Text strong>Ученики</Typography.Text>}
                dataSource={detail.members.filter((m) => m.status === 'active')}
                renderItem={(m) => (
                  <List.Item
                    actions={[
                      <Button key="rm" type="link" danger onClick={() => removeMember(m.contact_id)}>
                        Убрать
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={m.name}
                      description={m.grade ? `${m.grade} кл.` : ''}
                    />
                  </List.Item>
                )}
              />
              <Space.Compact style={{ width: '100%', marginTop: 12 }}>
                <Select
                  style={{ flex: 1 }}
                  placeholder="Добавить ученика"
                  value={memberId}
                  onChange={setMemberId}
                  options={students.map((s) => ({ value: s.id, label: s.name }))}
                />
                <Button type="primary" onClick={addMember}>
                  Добавить
                </Button>
              </Space.Compact>
            </Card>
          )}
        </Space>
      </Col>
      <Col xs={24} lg={8}>
        <Card title="Новая группа">
          <Form form={form} layout="vertical" onFinish={createGroup} initialValues={{ max_students: 12 }}>
            <Form.Item name="name" label="Название" rules={[{ required: true }]}>
              <Input placeholder="Python 7кл · Пн/Ср" />
            </Form.Item>
            <Form.Item name="course_id" label="Курс">
              <Select allowClear options={courses.map((c) => ({ value: c.id, label: c.title }))} />
            </Form.Item>
            <Form.Item name="max_students" label="Макс. учеников">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              Создать
            </Button>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}
