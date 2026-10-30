import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Divider,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { api, downloadCsv } from '../api';
import { useAuth } from '../auth';
import { flag } from '../permissions';

function FormulaBreakdown({ breakdown }) {
  if (!breakdown) return null;
  return (
    <Card size="small" title="Из чего складывается итог" style={{ marginBottom: 16 }}>
      <Typography.Paragraph>
        <Typography.Text strong>
          Итог: {breakdown.total_display ?? '—'} / {breakdown.scale_max}
        </Typography.Text>
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" style={{ fontFamily: 'ui-monospace, monospace' }}>
        {breakdown.formula_text}
      </Typography.Paragraph>
      {breakdown.total != null && (
        <Progress
          percent={Math.round((breakdown.total / breakdown.scale_max) * 100)}
          format={() => `${breakdown.total_display}`}
          strokeColor="var(--color-primary)"
        />
      )}
      <List
        size="small"
        dataSource={breakdown.parts || []}
        renderItem={(p) => (
          <List.Item>
            <List.Item.Meta
              title={
                <Space wrap>
                  <span>{p.label}</span>
                  <Tag>вес {p.weight}%</Tag>
                  {p.missing ? (
                    <Tag>нет оценок</Tag>
                  ) : (
                    <Tag color="processing">
                      вклад {p.contribution} (агрегат {p.aggregated_on_scale})
                    </Tag>
                  )}
                </Space>
              }
              description={
                <Collapse
                  size="small"
                  items={[
                    {
                      key: 'e',
                      label: `Оценки по критерию (${p.entries_count})`,
                      children: (
                        <List
                          size="small"
                          dataSource={p.raw_entries}
                          locale={{ emptyText: 'Пока пусто' }}
                          renderItem={(e) => (
                            <List.Item>
                              <List.Item.Meta
                                title={`${e.title}: ${e.score}/${e.max_score}`}
                                description={
                                  <>
                                    <div>{e.detail}</div>
                                    {e.comment ? <div>Комментарий: {e.comment}</div> : null}
                                    <Typography.Text type="secondary">
                                      {e.teacher_name} · {e.graded_at}
                                    </Typography.Text>
                                  </>
                                }
                              />
                            </List.Item>
                          )}
                        />
                      ),
                    },
                  ]}
                />
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}

export default function DiaryPage() {
  const { user } = useAuth();
  const isStaff = flag(user, 'diaryManage');
  const canRequest = flag(user, 'student') || flag(user, 'parent') || user.role === 'admin';

  const [overview, setOverview] = useState(null);
  const [contactId, setContactId] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [period, setPeriod] = useState(null);
  const [diary, setDiary] = useState(null);
  const [error, setError] = useState('');
  const [raiseOpen, setRaiseOpen] = useState(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [pending, setPending] = useState([]);
  const [schemeParts, setSchemeParts] = useState([]);

  const students = overview?.students || [];
  const selectedStudent = students.find((s) => s.id === contactId);
  const groups = selectedStudent?.groups || [];

  async function loadOverview() {
    const data = await api('/diary/overview');
    setOverview(data);
    setPeriod((p) => p || data.current_period);
    if (!contactId && data.students?.[0]) {
      setContactId(data.students[0].id);
      if (data.students[0].groups?.[0]) setGroupId(data.students[0].groups[0].id);
    }
  }

  async function loadDiary(cid = contactId, gid = groupId, per = period) {
    if (!cid || !gid) {
      setDiary(null);
      return;
    }
    const q = per ? `?period=${encodeURIComponent(per)}` : '';
    const data = await api(`/diary/student/${cid}/group/${gid}${q}`);
    setDiary(data);
  }

  async function loadPending() {
    if (!isStaff) return;
    const data = await api('/diary/raise-requests?status=pending');
    setPending(data.requests || []);
  }

  useEffect(() => {
    loadOverview()
      .then(() => (isStaff ? loadPending() : null))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (contactId && groupId) {
      loadDiary().catch((e) => setError(e.message));
    }
  }, [contactId, groupId, period]);

  useEffect(() => {
    if (!selectedStudent) return;
    if (!selectedStudent.groups.some((g) => g.id === groupId)) {
      setGroupId(selectedStudent.groups[0]?.id || null);
    }
  }, [contactId]);

  const periodOptions = useMemo(() => {
    const keys = new Set([...(diary?.period_keys || []), overview?.current_period].filter(Boolean));
    return [...keys].map((k) => ({ value: k, label: k }));
  }, [diary, overview]);

  async function submitRaise(values) {
    try {
      await api('/diary/raise-requests', {
        method: 'POST',
        body: JSON.stringify({
          entry_id: raiseOpen.id,
          requested_score: values.requested_score,
          reason: values.reason,
        }),
      });
      message.success('Запрос отправлен');
      setRaiseOpen(null);
      await loadDiary();
    } catch (e) {
      message.error(e.message);
    }
  }

  async function submitEntry(values) {
    try {
      await api('/diary/entries', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          group_id: groupId,
          contact_id: contactId,
          period_key: period || overview?.current_period,
        }),
      });
      message.success('Оценка добавлена');
      setEntryOpen(false);
      await loadDiary();
    } catch (e) {
      message.error(e.message);
    }
  }

  async function submitFeedback(values) {
    try {
      await api('/diary/feedback', {
        method: 'POST',
        body: JSON.stringify({
          group_id: groupId,
          contact_id: contactId,
          body: values.body,
          to_user_id: values.to_user_id || null,
        }),
      });
      message.success('Сообщение отправлено');
      await loadDiary();
    } catch (e) {
      message.error(e.message);
    }
  }

  async function reviewRequest(id, status, teacher_response, counter_score) {
    try {
      await api(`/diary/raise-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, teacher_response, counter_score }),
      });
      message.success('Решение сохранено');
      await loadPending();
      await loadDiary();
    } catch (e) {
      message.error(e.message);
    }
  }

  async function openSchemeEditor() {
    const data = await api(`/diary/schemes/${groupId}`);
    const parts =
      data.parts?.length > 0
        ? data.parts.map((p) => ({
            criteria_id: p.criteria_id,
            weight: p.weight,
            aggregation: p.aggregation,
            label_override: p.label_override,
          }))
        : [
            { criteria_id: overview.criteria.find((c) => c.code === 'homework')?.id, weight: 40, aggregation: 'avg' },
            { criteria_id: overview.criteria.find((c) => c.code === 'oral')?.id, weight: 30, aggregation: 'avg' },
            { criteria_id: overview.criteria.find((c) => c.code === 'quiz')?.id, weight: 20, aggregation: 'avg' },
            { criteria_id: overview.criteria.find((c) => c.code === 'late')?.id, weight: 10, aggregation: 'avg' },
          ];
    setSchemeParts(parts.filter((p) => p.criteria_id));
    setSchemeOpen(true);
  }

  async function saveScheme(values) {
    try {
      await api(`/diary/schemes/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: values.name,
          scale_max: values.scale_max,
          description: values.description,
          parts: schemeParts,
        }),
      });
      message.success('Формула сохранена');
      setSchemeOpen(false);
      await loadDiary();
    } catch (e) {
      message.error(e.message);
    }
  }

  const weightSum = schemeParts.reduce((s, p) => s + (Number(p.weight) || 0), 0);

  if (error && !overview) return <Alert type="error" message={error} showIcon />;
  if (!overview) return <Card loading />;

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 4 }}>
          Дневник
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Прозрачные оценки: видно критерий, за что балл и как считается итог по формуле группы.
          {overview.pendingRaises ? ` · запросов на повышение: ${overview.pendingRaises}` : ''}
        </Typography.Paragraph>
      </div>

      {error && <Alert type="error" message={error} showIcon closable onClose={() => setError('')} />}

      <Card size="small">
        <Space wrap>
          {(isStaff || user.role === 'parent' || students.length > 1) && (
            <Select
              style={{ minWidth: 220 }}
              value={contactId}
              onChange={setContactId}
              options={students.map((s) => ({
                value: s.id,
                label: `${s.name}${s.grade ? ` · ${s.grade} кл.` : ''}`,
              }))}
              placeholder="Ученик"
            />
          )}
          <Select
            style={{ minWidth: 240 }}
            value={groupId}
            onChange={setGroupId}
            options={groups.map((g) => ({
              value: g.id,
              label: `${g.name}${g.course_title ? ` · ${g.course_title}` : ''}`,
            }))}
            placeholder="Группа"
          />
          <Select
            style={{ minWidth: 140 }}
            value={period}
            onChange={setPeriod}
            options={periodOptions}
            placeholder="Период"
          />
          {isStaff && groupId && (
            <>
              <Button onClick={openSchemeEditor}>Формула оценки</Button>
              <Button type="primary" onClick={() => setEntryOpen(true)} disabled={!contactId}>
                Выставить оценку
              </Button>
              <Button
                onClick={() =>
                  downloadCsv(
                    `/search/export/diary.csv?group_id=${groupId}`,
                    'diary.csv'
                  ).catch((e) => message.error(e.message))
                }
              >
                CSV
              </Button>
            </>
          )}
        </Space>
      </Card>

      {isStaff && pending.length > 0 && (
        <Card title="Запросы на повышение оценки" size="small">
          <List
            dataSource={pending}
            renderItem={(r) => (
              <List.Item
                actions={[
                  <Button
                    key="ok"
                    type="link"
                    onClick={() =>
                      reviewRequest(r.id, 'approved', 'Оценка повышена по запросу')
                    }
                  >
                    Одобрить
                  </Button>,
                  <Button
                    key="no"
                    type="link"
                    danger
                    onClick={() => reviewRequest(r.id, 'rejected', 'Пока оставляем как есть')}
                  >
                    Отклонить
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={`${r.student_name} · ${r.group_name} · ${r.entry_title || 'итог'}`}
                  description={
                    <>
                      {r.current_score} → {r.requested_score}: {r.reason}
                      <div>
                        <Typography.Text type="secondary">от {r.requester_name}</Typography.Text>
                      </div>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {!diary ? (
        <EmptyHint />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <FormulaBreakdown breakdown={diary.breakdown} />
              {diary.scheme && (
                <Typography.Paragraph type="secondary">
                  Схема: <strong>{diary.scheme.name}</strong>
                  {diary.scheme.description ? ` — ${diary.scheme.description}` : ''}
                </Typography.Paragraph>
              )}
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Обратная связь" size="small">
                <Form layout="vertical" onFinish={submitFeedback}>
                  <Form.Item name="body" rules={[{ required: true, message: 'Напишите текст' }]}>
                    <Input.TextArea rows={3} placeholder="Комментарий ученику / родителю / учителю" />
                  </Form.Item>
                  <Button htmlType="submit" type="primary" block>
                    Отправить
                  </Button>
                </Form>
                <Divider />
                <List
                  size="small"
                  dataSource={diary.feedback || []}
                  locale={{ emptyText: 'Пока нет сообщений' }}
                  renderItem={(f) => (
                    <List.Item>
                      <List.Item.Meta
                        title={`${f.from_name} (${f.from_role})`}
                        description={f.body}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Все оценки периода" size="small">
            <Table
              rowKey="id"
              pagination={false}
              dataSource={diary.entries}
              columns={[
                {
                  title: 'Критерий',
                  dataIndex: 'criteria_name',
                  render: (t, r) => <Tag>{t || r.criteria_code}</Tag>,
                },
                {
                  title: 'Балл',
                  key: 'score',
                  width: 90,
                  render: (_, r) => (
                    <strong>
                      {r.score}/{r.max_score}
                    </strong>
                  ),
                },
                { title: 'За что', dataIndex: 'title' },
                {
                  title: 'Конкретика',
                  dataIndex: 'detail',
                  render: (t) => <Typography.Text type="secondary">{t}</Typography.Text>,
                },
                {
                  title: '',
                  key: 'act',
                  width: 140,
                  render: (_, r) =>
                    canRequest ? (
                      <Button size="small" onClick={() => setRaiseOpen(r)}>
                        Запросить повышение
                      </Button>
                    ) : null,
                },
              ]}
            />
          </Card>

          {(diary.requests || []).length > 0 && (
            <Card title="История запросов" size="small">
              <List
                dataSource={diary.requests}
                renderItem={(r) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag>{r.status}</Tag>
                          {r.entry_title || 'оценка'}
                          {r.current_score != null && (
                            <span>
                              {r.current_score} → {r.requested_score}
                            </span>
                          )}
                        </Space>
                      }
                      description={
                        <>
                          {r.reason}
                          {r.teacher_response ? (
                            <div>
                              Ответ: {r.teacher_response}
                            </div>
                          ) : null}
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </>
      )}

      <Modal
        title="Запрос на повышение оценки"
        open={!!raiseOpen}
        onCancel={() => setRaiseOpen(null)}
        footer={null}
        destroyOnClose
      >
        {raiseOpen && (
          <>
            <Alert
              style={{ marginBottom: 12 }}
              type="info"
              message={`${raiseOpen.title}: ${raiseOpen.score}/${raiseOpen.max_score}`}
              description={raiseOpen.detail}
            />
            <Form layout="vertical" onFinish={submitRaise} initialValues={{ requested_score: Math.min(raiseOpen.max_score, raiseOpen.score + 1) }}>
              <Form.Item name="requested_score" label="Желаемый балл" rules={[{ required: true }]}>
                <InputNumber min={0} max={raiseOpen.max_score} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="reason"
                label="Почему повысить"
                rules={[{ required: true, message: 'Опишите аргументы' }]}
              >
                <Input.TextArea rows={4} placeholder="Что исправлено / какая доп.работа сделана" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
                Отправить запрос
              </Button>
            </Form>
          </>
        )}
      </Modal>

      <Modal
        title="Выставить оценку"
        open={entryOpen}
        onCancel={() => setEntryOpen(false)}
        footer={null}
        destroyOnClose
        width={640}
      >
        <Form layout="vertical" onFinish={submitEntry} initialValues={{ max_score: 5, score: 5 }}>
          <Form.Item name="criteria_id" label="Критерий" rules={[{ required: true }]}>
            <Select
              options={(overview.criteria || []).map((c) => ({
                value: c.id,
                label: `${c.name}${c.direction === 'lower_better' ? ' (меньше лучше)' : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="title" label="Краткий заголовок" rules={[{ required: true }]}>
            <Input placeholder="Напр. Ответ: циклы for" />
          </Form.Item>
          <Form.Item
            name="detail"
            label="За что конкретно (обязательно)"
            rules={[{ required: true, message: 'Нужна прозрачная формулировка' }]}
          >
            <Input.TextArea rows={3} placeholder="Тема, что сделал ученик, ошибки/плюсы" />
          </Form.Item>
          <Space>
            <Form.Item name="score" label="Балл" rules={[{ required: true }]}>
              <InputNumber min={0} step={0.5} />
            </Form.Item>
            <Form.Item name="max_score" label="Макс">
              <InputNumber min={1} step={1} />
            </Form.Item>
          </Space>
          <Form.Item name="comment" label="Комментарий учителю/ученику">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Сохранить
          </Button>
        </Form>
      </Modal>

      <Modal
        title="Формула итоговой оценки"
        open={schemeOpen}
        onCancel={() => setSchemeOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Alert
          type="info"
          style={{ marginBottom: 12 }}
          message="Сумма весов = 100%. Итог считается только по критериям, где есть оценки (веса перенормируются)."
        />
        <Form
          layout="vertical"
          onFinish={saveScheme}
          initialValues={{
            name: diary?.scheme?.name || 'Формула группы',
            scale_max: diary?.scheme?.scale_max || 5,
            description: diary?.scheme?.description || '',
          }}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="scale_max" label="Шкала (макс. балл итога)">
            <InputNumber min={1} max={100} />
          </Form.Item>
          <Form.Item name="description" label="Пояснение для учеников и родителей">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Typography.Text strong>Слагаемые (сейчас {weightSum}%)</Typography.Text>
          {schemeParts.map((p, idx) => (
            <Space key={idx} style={{ display: 'flex', marginTop: 8 }} align="start">
              <Select
                style={{ width: 200 }}
                value={p.criteria_id}
                onChange={(v) => {
                  const next = [...schemeParts];
                  next[idx] = { ...next[idx], criteria_id: v };
                  setSchemeParts(next);
                }}
                options={(overview.criteria || []).map((c) => ({ value: c.id, label: c.name }))}
              />
              <InputNumber
                min={0}
                max={100}
                value={p.weight}
                onChange={(v) => {
                  const next = [...schemeParts];
                  next[idx] = { ...next[idx], weight: v };
                  setSchemeParts(next);
                }}
                addonAfter="%"
              />
              <Select
                style={{ width: 120 }}
                value={p.aggregation}
                onChange={(v) => {
                  const next = [...schemeParts];
                  next[idx] = { ...next[idx], aggregation: v };
                  setSchemeParts(next);
                }}
                options={[
                  { value: 'avg', label: 'среднее' },
                  { value: 'latest', label: 'последняя' },
                  { value: 'max', label: 'макс' },
                  { value: 'min', label: 'мин' },
                ]}
              />
              <Button
                danger
                type="text"
                onClick={() => setSchemeParts(schemeParts.filter((_, i) => i !== idx))}
              >
                ×
              </Button>
            </Space>
          ))}
          <Button
            style={{ marginTop: 8, marginBottom: 16 }}
            onClick={() =>
              setSchemeParts([
                ...schemeParts,
                {
                  criteria_id: overview.criteria[0]?.id,
                  weight: 0,
                  aggregation: 'avg',
                },
              ])
            }
          >
            + критерий
          </Button>
          <Button type="primary" htmlType="submit" block disabled={Math.abs(weightSum - 100) > 0.5}>
            Сохранить формулу
          </Button>
        </Form>
      </Modal>
    </Space>
  );
}

function EmptyHint() {
  return (
    <Card>
      <Typography.Paragraph type="secondary">
        Выберите ученика и группу, чтобы открыть дневник.
      </Typography.Paragraph>
    </Card>
  );
}
