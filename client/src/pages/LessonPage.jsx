import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  Alert,
  Button,
  Card,
  Flex,
  Form,
  Radio,
  Space,
  Typography,
} from 'antd';
import { api } from '../api';
import BlockRenderer from '../components/BlockRenderer';

export default function LessonPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api(`/builder/lessons/${id}/play`)
      .then((d) => {
        setData(d);
        setAnswers({});
        setResult(null);
        if (window.location.hash?.startsWith('#block-')) {
          setTimeout(() => {
            document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth' });
          }, 200);
        }
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function complete() {
    setBusy(true);
    try {
      await api(`/lessons/${id}/complete`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitQuiz() {
    setBusy(true);
    try {
      const res = await api(`/lessons/${id}/quiz`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      setResult(res);
      if (res.passed) load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <Alert type="error" message={error} showIcon />;
  if (!data) return <Card loading />;

  const { lesson, quiz, completed, siblings, blocks = [], course, deep_link } = data;
  const idx = siblings.findIndex((s) => s.id === lesson.id);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];
  const hasBlocks = blocks.length > 0;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Flex justify="space-between" wrap gap={8}>
        <Link to={`/courses/${lesson.course_id}`}>← К курсу</Link>
        <Typography.Text type="secondary">
          Урок {idx + 1} из {siblings.length}
          {deep_link ? ` · ${deep_link}` : ''}
        </Typography.Text>
      </Flex>

      <Card>
        <Typography.Text type="secondary">
          {course?.icon} {course?.title}
        </Typography.Text>
        <Typography.Title level={2} style={{ marginTop: 4 }}>
          {lesson.title}
        </Typography.Title>
        {lesson.summary && <Typography.Paragraph type="secondary">{lesson.summary}</Typography.Paragraph>}
        {completed && <Alert type="success" message="Урок пройден" showIcon />}
      </Card>

      {hasBlocks ? (
        blocks.map((b) => <BlockRenderer key={b.id} block={b} onQuizDone={() => load()} />)
      ) : (
        <Card className="lesson-markdown">
          <ReactMarkdown>{lesson.content}</ReactMarkdown>
        </Card>
      )}

      {quiz && (
        <Card title={quiz.title || 'Тест'}>
          <Form layout="vertical">
            {quiz.questions.map((q) => (
              <Form.Item key={q.id} label={q.question}>
                <Radio.Group
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  value={answers[q.id]}
                >
                  <Space direction="vertical">
                    {q.options.map((opt, i) => (
                      <Radio key={i} value={i}>
                        {opt}
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </Form.Item>
            ))}
          </Form>
          <Button type="primary" loading={busy} onClick={submitQuiz}>
            Проверить
          </Button>
          {result && (
            <Alert
              style={{ marginTop: 12 }}
              type={result.passed ? 'success' : 'warning'}
              message={`${result.score} из ${result.total}`}
            />
          )}
        </Card>
      )}

      <Flex justify="space-between" wrap gap={8}>
        {prev ? (
          <Link to={`/lessons/${prev.id}`}>
            <Button>← {prev.title}</Button>
          </Link>
        ) : (
          <span />
        )}
        <Button type="primary" loading={busy} onClick={complete} disabled={completed}>
          {completed ? 'Пройден' : 'Отметить пройденным'}
        </Button>
        {next ? (
          <Link to={`/lessons/${next.id}`}>
            <Button>
              {next.title} →
            </Button>
          </Link>
        ) : (
          <span />
        )}
      </Flex>
      {error && <Alert type="error" message={error} showIcon />}
    </Space>
  );
}
