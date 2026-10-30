import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { api } from '../api';
import { useAuth } from '../auth';
import { can } from '../permissions';

export default function MessagesPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState('');
  const [directory, setDirectory] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isStaff = can(user, 'office.access', 'content.teach');

  async function loadThreads() {
    const data = await api('/messages/threads');
    setThreads(data.threads || []);
  }

  async function openThread(id) {
    setActiveId(id);
    const data = await api(`/messages/threads/${id}`);
    setDetail(data);
    setReply('');
    loadThreads();
  }

  useEffect(() => {
    loadThreads().catch((e) => setError(e.message));
    if (isStaff) {
      api('/messages/directory')
        .then((d) => setDirectory(d.contacts || []))
        .catch(() => {});
    }
  }, [isStaff]);

  const totalUnread = useMemo(
    () => threads.reduce((s, t) => s + (t.unread || 0), 0),
    [threads]
  );

  async function sendReply() {
    if (!activeId || !reply.trim()) return;
    setBusy(true);
    try {
      await api(`/messages/threads/${activeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: reply }),
      });
      await openThread(activeId);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function createThread(values) {
    setBusy(true);
    setError('');
    try {
      const payload = {
        subject: values.subject,
        body: values.body,
      };
      if (isStaff && values.contactId) payload.contactId = values.contactId;
      const data = await api('/messages/threads', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await loadThreads();
      await openThread(data.thread.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 4 }}>
          Сообщения
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Переписка ученик / родитель / преподаватель
          {totalUnread ? ` · непрочитанных: ${totalUnread}` : ''}
        </Typography.Paragraph>
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      <Card title="Новый диалог" size="small">
        <Form layout="vertical" onFinish={createThread} style={{ maxWidth: 640 }}>
          {isStaff && (
            <Form.Item name="contactId" label="Контакт" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Кому написать"
                options={directory.map((c) => ({
                  value: c.id,
                  label: `${c.name} (${c.type}${c.grade ? `, ${c.grade} кл.` : ''})`,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item name="subject" label="Тема" rules={[{ required: true }]}>
            <Input placeholder="Например: вопрос по расписанию" />
          </Form.Item>
          <Form.Item name="body" label="Сообщение" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={busy}>
            {isStaff ? 'Написать' : 'Написать в школу'}
          </Button>
        </Form>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card title="Диалоги" size="small">
            {threads.length === 0 ? (
              <Empty description="Пока нет переписки" />
            ) : (
              <List
                dataSource={threads}
                renderItem={(t) => (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      background: t.id === activeId ? 'var(--color-primary-soft)' : undefined,
                      paddingInline: 8,
                      borderRadius: 8,
                    }}
                    onClick={() => openThread(t.id).catch((e) => setError(e.message))}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          {t.subject}
                          {t.unread > 0 && <Tag color="processing">{t.unread}</Tag>}
                        </Space>
                      }
                      description={t.last ? `${t.last.sender_name}: ${t.last.body}` : 'Пусто'}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card title={detail?.thread?.subject || 'Выберите диалог'} size="small">
            {!detail ? (
              <Empty description="Откройте диалог слева" />
            ) : (
              <>
                <List
                  dataSource={detail.messages}
                  style={{ maxHeight: 420, overflow: 'auto', marginBottom: 16 }}
                  renderItem={(m) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <strong>{m.sender_name}</strong>
                            <Typography.Text type="secondary">{m.created_at}</Typography.Text>
                          </Space>
                        }
                        description={m.body}
                      />
                    </List.Item>
                  )}
                />
                <Space.Compact style={{ width: '100%' }}>
                  <Input.TextArea
                    rows={2}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Ответ..."
                  />
                </Space.Compact>
                <Button
                  type="primary"
                  style={{ marginTop: 8 }}
                  loading={busy}
                  onClick={sendReply}
                >
                  Отправить
                </Button>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
