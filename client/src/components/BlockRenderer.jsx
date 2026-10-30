import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Radio,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { api, downloadFile } from '../api';

export default function BlockRenderer({ block, onQuizDone }) {
  const cfg = block.config || {};
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState({});

  async function submitQuiz() {
    setBusy(true);
    try {
      const res = await api(`/builder/blocks/${block.id}/quiz`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      setResult(res);
      onQuizDone?.(res);
      if (res.diary_entry) message.success('Оценка ушла в дневник');
    } catch (e) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const wrap = (children) => (
    <Card
      id={`block-${block.slug}`}
      size="small"
      title={
        <Space>
          {block.title || block.type}
          <Tag>{block.type}</Tag>
          {block.criteria && <Tag color="processing">→ {block.criteria.name}</Tag>}
        </Space>
      }
      style={{ marginBottom: 12 }}
    >
      {children}
    </Card>
  );

  switch (block.type) {
    case 'section':
      return (
        <div id={`block-${block.slug}`} style={{ margin: '24px 0 8px' }}>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            {block.title}
          </Typography.Title>
          {block.content && (
            <Typography.Paragraph type="secondary">{block.content}</Typography.Paragraph>
          )}
        </div>
      );
    case 'heading':
      return (
        <Typography.Title id={`block-${block.slug}`} level={cfg.level || 3}>
          {block.title || block.content}
        </Typography.Title>
      );
    case 'markdown':
      return wrap(
        <div className="lesson-markdown">
          <ReactMarkdown>{block.content || ''}</ReactMarkdown>
        </div>
      );
    case 'html':
      return wrap(
        <div dangerouslySetInnerHTML={{ __html: block.content || '' }} />
      );
    case 'video':
      return wrap(
        <div style={{ position: 'relative', paddingTop: '56.25%' }}>
          <iframe
            title={block.title}
            src={cfg.url || block.content}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            allowFullScreen
          />
        </div>
      );
    case 'embed':
      return wrap(
        <iframe
          title={block.title}
          src={cfg.url || block.content}
          style={{ width: '100%', minHeight: cfg.height || 360, border: '1px solid var(--color-border)' }}
        />
      );
    case 'code':
      return wrap(
        <pre style={{ background: 'var(--color-code-bg)', color: 'var(--color-code-text)', padding: 16, borderRadius: 12, overflow: 'auto' }}>
          <code>{block.content}</code>
        </pre>
      );
    case 'callout':
      return wrap(
        <Alert type={cfg.tone || 'info'} message={block.title} description={block.content} showIcon />
      );
    case 'divider':
      return <hr id={`block-${block.slug}`} style={{ borderColor: 'var(--color-border)', margin: '20px 0' }} />;
    case 'image':
      return wrap(
        block.file ? (
          <Button onClick={() => downloadFile(block.file.id, block.file.original_name)}>
            Открыть изображение: {block.file.original_name}
          </Button>
        ) : (
          <Typography.Text type="secondary">{cfg.url || 'Нет файла'}</Typography.Text>
        )
      );
    case 'file':
    case 'presentation':
    case 'download':
      return wrap(
        <Space direction="vertical">
          {block.content && <Typography.Paragraph>{block.content}</Typography.Paragraph>}
          {block.file ? (
            <Button
              type="primary"
              onClick={() => downloadFile(block.file.id, block.file.original_name)}
            >
              Скачать {block.file.original_name}
            </Button>
          ) : (
            <Alert type="warning" message="Файл не прикреплён" />
          )}
        </Space>
      );
    case 'checklist':
      return wrap(
        <Space direction="vertical">
          {(cfg.items || []).map((item, i) => (
            <Checkbox
              key={i}
              checked={!!checks[i]}
              onChange={(e) => setChecks((c) => ({ ...c, [i]: e.target.checked }))}
            >
              {item}
            </Checkbox>
          ))}
        </Space>
      );
    case 'grade_info':
      return wrap(
        <Alert
          type="info"
          showIcon
          message={block.criteria ? `Критерий дневника: ${block.criteria.name}` : 'Критерий не привязан'}
          description={
            block.content ||
            'Этот блок показывает, как активность урока влияет на итоговую оценку по формуле группы.'
          }
        />
      );
    case 'quiz': {
      const questions = cfg.questions || [];
      return wrap(
        <Space direction="vertical" style={{ width: '100%' }}>
          {block.content && <Typography.Paragraph>{block.content}</Typography.Paragraph>}
          <Form layout="vertical">
            {questions.map((q, idx) => {
              const key = q.id != null ? String(q.id) : String(idx);
              return (
                <Form.Item key={key} label={q.question}>
                  <Radio.Group
                    onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
                    value={answers[key]}
                  >
                    <Space direction="vertical">
                      {(q.options || []).map((opt, oi) => (
                        <Radio key={oi} value={oi}>
                          {opt}
                        </Radio>
                      ))}
                    </Space>
                  </Radio.Group>
                </Form.Item>
              );
            })}
          </Form>
          <Button type="primary" loading={busy} onClick={submitQuiz}>
            Отправить ответы
          </Button>
          {result && (
            <Alert
              type={result.passed ? 'success' : 'warning'}
              message={`Результат: ${result.score} / ${result.total}`}
            />
          )}
        </Space>
      );
    }
    default:
      return wrap(<Typography.Text type="secondary">Неизвестный тип: {block.type}</Typography.Text>);
  }
}
