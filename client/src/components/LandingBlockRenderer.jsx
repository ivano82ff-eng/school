import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  InputNumber,
  Progress,
  Radio,
  Space,
  Typography,
  message,
} from 'antd';
import { api } from '../api';

function sessionKey(slug) {
  const k = `lp_sid_${slug}`;
  let sid = localStorage.getItem(k);
  if (!sid) {
    sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(k, sid);
  }
  return sid;
}

export function useLandingSession(slug) {
  return useMemo(() => (slug ? sessionKey(slug) : null), [slug]);
}

export default function LandingBlockRenderer({
  block,
  page,
  sessionId,
  themeTokens = {},
  preview = false,
  onLead,
  onPoints,
}) {
  const cfg = block.config || {};
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [board, setBoard] = useState([]);
  const [ticks, setTicks] = useState(0);

  const primary = themeTokens.primary || '#8E6FAF';
  const btnStyle = {
    background: primary,
    borderColor: primary,
    color: themeTokens.primaryText || '#fff',
    borderRadius: themeTokens.buttonRadius || 12,
  };

  useEffect(() => {
    if (block.type === 'countdown' && cfg.until) {
      const t = setInterval(() => setTicks((x) => x + 1), 1000);
      return () => clearInterval(t);
    }
  }, [block.type, cfg.until]);

  useEffect(() => {
    if (block.type === 'leaderboard' && page?.slug && !preview) {
      api(`/landings/public/${page.slug}/leaderboard`)
        .then((d) => setBoard(d.leaderboard || []))
        .catch(() => {});
    }
  }, [block.type, page?.slug, preview, ticks]);

  async function track(event_type, meta = {}) {
    if (preview || !page?.slug) return;
    try {
      await api(`/landings/public/${page.slug}/event`, {
        method: 'POST',
        body: JSON.stringify({
          event_type,
          block_id: block.id,
          session_id: sessionId,
          meta,
        }),
      });
    } catch {
      // ignore
    }
  }

  async function submitLead(values) {
    setBusy(true);
    try {
      const res = await api('/leads/public', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          child_grade: values.child_grade ? Number(values.child_grade) : null,
          landing_page_id: page.id,
          landing_block_id: block.id,
          session_id: sessionId,
          gamifyPoints: cfg.gamifyPoints || 50,
          utm: Object.fromEntries(new URLSearchParams(window.location.search)),
        }),
      });
      setDone(true);
      onLead?.(res.lead);
      onPoints?.(cfg.gamifyPoints || 50);
      message.success(cfg.successText || 'Заявка отправлена');
      await track('cta_click', { form: true });
    } catch (e) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitSurvey() {
    if (preview) return;
    setBusy(true);
    try {
      const res = await api(`/landings/public/${page.slug}/survey`, {
        method: 'POST',
        body: JSON.stringify({
          block_id: block.id,
          session_id: sessionId,
          answers,
        }),
      });
      setQuizResult(res);
      onPoints?.(res.points || 10);
      message.success(res.score != null ? `Результат: ${res.score}%` : 'Ответ принят');
    } catch (e) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function addGamePoints(delta, state = {}) {
    if (preview || !page?.slug) {
      onPoints?.(delta);
      return;
    }
    try {
      const res = await api(`/landings/public/${page.slug}/game`, {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, delta, state }),
      });
      onPoints?.(delta, res.game?.score);
    } catch {
      onPoints?.(delta);
    }
  }

  const section = (children, extraStyle = {}) => (
    <section
      id={block.slug}
      style={{
        margin: '0 auto',
        maxWidth: cfg.fullBleed ? '100%' : 960,
        padding: cfg.padding || '28px 20px',
        ...extraStyle,
      }}
    >
      {children}
    </section>
  );

  switch (block.type) {
    case 'hero':
      return (
        <section
          id={block.slug}
          style={{
            background: themeTokens.heroBg || primary,
            color: themeTokens.heroText || '#fff',
            padding: '72px 24px',
            textAlign: 'center',
            borderRadius: themeTokens.radius || 16,
            marginBottom: 8,
          }}
        >
          <Typography.Title style={{ color: 'inherit', marginTop: 0 }} level={1}>
            {block.title || 'Заголовок'}
          </Typography.Title>
          <Typography.Paragraph style={{ color: 'inherit', opacity: 0.92, fontSize: 18 }}>
            {block.content || cfg.subtitle}
          </Typography.Paragraph>
          {cfg.ctaLabel && (
            <Button
              size="large"
              style={btnStyle}
              onClick={() => {
                track('cta_click');
                if (cfg.ctaTarget === 'form') {
                  document.getElementById(cfg.ctaAnchor || 'zayavka')?.scrollIntoView({
                    behavior: 'smooth',
                  });
                } else if (cfg.href) window.location.href = cfg.href;
              }}
            >
              {cfg.ctaLabel}
            </Button>
          )}
        </section>
      );

    case 'heading':
      return section(
        <Typography.Title level={cfg.level || 2} style={{ color: themeTokens.text }}>
          {block.title || block.content}
        </Typography.Title>
      );

    case 'text':
    case 'markdown':
      return section(
        <>
          {block.title && (
            <Typography.Title level={4} style={{ color: themeTokens.text }}>
              {block.title}
            </Typography.Title>
          )}
          <Typography.Paragraph style={{ color: themeTokens.muted, whiteSpace: 'pre-wrap' }}>
            {block.content}
          </Typography.Paragraph>
        </>
      );

    case 'image':
      return section(
        <img
          src={cfg.url || block.content}
          alt={block.title || ''}
          style={{
            width: '100%',
            borderRadius: themeTokens.radius || 16,
            display: 'block',
          }}
        />
      );

    case 'video':
      return section(
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
          <iframe
            title={block.title || 'video'}
            src={cfg.embedUrl || block.content}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            allowFullScreen
          />
        </div>
      );

    case 'features': {
      const items = cfg.items || [];
      return section(
        <>
          {block.title && (
            <Typography.Title level={3} style={{ color: themeTokens.text }}>
              {block.title}
            </Typography.Title>
          )}
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}
          >
            {items.map((it, i) => (
              <Card key={i} style={{ borderRadius: themeTokens.radius }}>
                <Typography.Title level={5}>{it.title}</Typography.Title>
                <Typography.Paragraph type="secondary">{it.text}</Typography.Paragraph>
              </Card>
            ))}
          </div>
        </>
      );
    }

    case 'pricing': {
      const plans = cfg.plans || [];
      return section(
        <>
          {block.title && (
            <Typography.Title level={3} style={{ color: themeTokens.text }}>
              {block.title}
            </Typography.Title>
          )}
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            {plans.map((p, i) => (
              <Card
                key={i}
                style={{
                  borderRadius: themeTokens.radius,
                  borderColor: p.highlight ? primary : undefined,
                  borderWidth: p.highlight ? 2 : 1,
                }}
              >
                <Typography.Title level={4}>{p.name}</Typography.Title>
                <Typography.Title level={2} style={{ color: primary, margin: '8px 0' }}>
                  {p.price}
                </Typography.Title>
                <Typography.Paragraph type="secondary">{p.desc}</Typography.Paragraph>
                {p.cta && (
                  <Button
                    block
                    style={btnStyle}
                    onClick={() => {
                      track('cta_click', { plan: p.name });
                      document.getElementById('zayavka')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    {p.cta}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </>
      );
    }

    case 'countdown': {
      void ticks;
      const until = cfg.until ? new Date(cfg.until).getTime() : 0;
      const left = Math.max(0, until - Date.now());
      const d = Math.floor(left / 86400000);
      const h = Math.floor((left % 86400000) / 3600000);
      const m = Math.floor((left % 3600000) / 60000);
      const s = Math.floor((left % 60000) / 1000);
      return section(
        <Card style={{ textAlign: 'center', borderRadius: themeTokens.radius }}>
          <Typography.Title level={4}>{block.title || 'До конца акции'}</Typography.Title>
          <Typography.Title level={2} style={{ color: primary, letterSpacing: 2 }}>
            {`${d}д ${h}ч ${m}м ${s}с`}
          </Typography.Title>
          <Typography.Paragraph type="secondary">{block.content}</Typography.Paragraph>
        </Card>
      );
    }

    case 'cta_button':
      return section(
        <div style={{ textAlign: 'center' }}>
          <Button
            size="large"
            style={btnStyle}
            onClick={() => {
              track('cta_click');
              if (cfg.href) window.open(cfg.href, '_blank');
              else document.getElementById(cfg.anchor || 'zayavka')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {block.title || cfg.label || 'Подробнее'}
          </Button>
        </div>
      );

    case 'cta_form':
      return section(
        <Card
          id={block.slug}
          title={block.title || 'Заявка'}
          style={{ borderRadius: themeTokens.radius, maxWidth: 520, margin: '0 auto' }}
        >
          {done ? (
            <Alert type="success" showIcon message={cfg.successText || 'Заявка отправлена!'} />
          ) : (
            <Form
              layout="vertical"
              onFinish={submitLead}
              initialValues={{
                interest: cfg.interestDefault || 'Python',
                child_grade: 5,
              }}
            >
              <Form.Item name="name" label="Ваше имя" rules={[{ required: true }]}>
                <Input size="large" />
              </Form.Item>
              <Form.Item name="phone" label="Телефон">
                <Input size="large" />
              </Form.Item>
              <Form.Item name="email" label="Email">
                <Input type="email" size="large" />
              </Form.Item>
              <Form.Item name="child_name" label="Имя ребёнка">
                <Input size="large" />
              </Form.Item>
              <Form.Item name="child_grade" label="Класс">
                <InputNumber min={1} max={11} style={{ width: '100%' }} size="large" />
              </Form.Item>
              <Form.Item name="interest" label="Интерес / курс">
                <Input size="large" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={busy} style={btnStyle}>
                {cfg.submitLabel || 'Отправить'}
              </Button>
            </Form>
          )}
        </Card>
      );

    case 'trial_teaser':
      return section(
        <Card style={{ borderRadius: themeTokens.radius, background: themeTokens.surface }}>
          <Typography.Title level={3}>{block.title || 'Пробный фрагмент'}</Typography.Title>
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
            {block.content || cfg.previewText}
          </Typography.Paragraph>
          {cfg.unlockHint && (
            <Alert type="info" showIcon message={cfg.unlockHint} style={{ marginBottom: 12 }} />
          )}
          <Space>
            <Button
              style={btnStyle}
              onClick={() => {
                track('trial_open');
                addGamePoints(cfg.points || 15, { trialOpened: true });
                message.success('Пробный контент открыт · +очки');
              }}
            >
              {cfg.buttonLabel || 'Открыть пробный урок'}
            </Button>
            <Button
              onClick={() =>
                document.getElementById('zayavka')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Записаться
            </Button>
          </Space>
        </Card>
      );

    case 'survey':
    case 'quiz_game': {
      const questions = cfg.questions || [];
      return section(
        <Card title={block.title || 'Опрос'} style={{ borderRadius: themeTokens.radius }}>
          {block.content && (
            <Typography.Paragraph type="secondary">{block.content}</Typography.Paragraph>
          )}
          {quizResult ? (
            <Alert
              type="success"
              showIcon
              message={
                quizResult.score != null
                  ? `Готово! Результат ${quizResult.score}%, +${quizResult.points} очков`
                  : 'Спасибо за ответы!'
              }
            />
          ) : (
            <>
              {questions.map((q) => (
                <div key={q.id} style={{ marginBottom: 16 }}>
                  <Typography.Text strong>{q.text}</Typography.Text>
                  {q.options ? (
                    <Radio.Group
                      style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      value={answers[q.id]}
                      options={q.options.map((o) => ({ value: o.value, label: o.label }))}
                    />
                  ) : (
                    <Input
                      style={{ marginTop: 8 }}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    />
                  )}
                </div>
              ))}
              <Button type="primary" loading={busy} onClick={submitSurvey} style={btnStyle}>
                Отправить
              </Button>
            </>
          )}
        </Card>
      );
    }

    case 'points_bar':
      return section(
        <Card size="small" style={{ borderRadius: themeTokens.radius }}>
          <Typography.Text>{block.title || 'Ваш прогресс'}</Typography.Text>
          <Progress
            percent={Math.min(100, Number(cfg.percent) || 0)}
            strokeColor={primary}
            style={{ marginTop: 8 }}
          />
        </Card>
      );

    case 'leaderboard':
      return section(
        <Card title={block.title || 'Рейтинг'} style={{ borderRadius: themeTokens.radius }}>
          {(board.length ? board : [{ rank: 1, label: 'Пока пусто', score: 0 }]).map((r) => (
            <div
              key={r.rank}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid #eee',
              }}
            >
              <span>
                #{r.rank} {r.label}
              </span>
              <strong>{r.score}</strong>
            </div>
          ))}
        </Card>
      );

    case 'faq': {
      const items = (cfg.items || []).map((it, i) => ({
        key: String(i),
        label: it.q,
        children: <Typography.Paragraph>{it.a}</Typography.Paragraph>,
      }));
      return section(
        <>
          {block.title && (
            <Typography.Title level={3} style={{ color: themeTokens.text }}>
              {block.title}
            </Typography.Title>
          )}
          <Collapse items={items} />
        </>
      );
    }

    case 'testimonials': {
      const items = cfg.items || [];
      return section(
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          {items.map((it, i) => (
            <Card key={i} style={{ borderRadius: themeTokens.radius }}>
              <Typography.Paragraph>«{it.text}»</Typography.Paragraph>
              <Typography.Text type="secondary">— {it.author}</Typography.Text>
            </Card>
          ))}
        </div>
      );
    }

    case 'embed':
      return section(
        <div dangerouslySetInnerHTML={{ __html: block.content || cfg.html || '' }} />
      );

    case 'divider':
      return <hr style={{ border: 0, borderTop: `1px solid ${themeTokens.muted}33`, margin: '24px 0' }} />;

    case 'spacer':
      return <div style={{ height: cfg.height || 32 }} />;

    case 'gallery': {
      const urls = cfg.urls || [];
      return section(
        <div
          style={{
            display: 'grid',
            gap: 8,
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          }}
        >
          {urls.map((u, i) => (
            <img
              key={i}
              src={u}
              alt=""
              style={{ width: '100%', borderRadius: 8, objectFit: 'cover', aspectRatio: '4/3' }}
            />
          ))}
        </div>
      );
    }

    default:
      return section(
        <Card size="small">
          <Typography.Text type="secondary">
            Блок «{block.type}»: {block.title}
          </Typography.Text>
          {block.content && <Typography.Paragraph>{block.content}</Typography.Paragraph>}
        </Card>
      );
  }
}

