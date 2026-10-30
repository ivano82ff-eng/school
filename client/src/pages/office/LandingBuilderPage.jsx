import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  EyeOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { can } from '../../permissions';
import LandingBlockRenderer from '../../components/LandingBlockRenderer';
import { themeCssVars } from '../../utils/landingTheme';

const DEFAULT_CONFIG = {
  hero: { subtitle: '', ctaLabel: 'Записаться', ctaTarget: 'form', ctaAnchor: 'zayavka' },
  features: {
    items: [
      { title: 'Практика', text: 'Проекты с первого занятия' },
      { title: 'Группы', text: 'Небольшие классы' },
      { title: 'Отчёт', text: 'Родителям каждую неделю' },
    ],
  },
  pricing: {
    plans: [
      { name: 'Старт', price: '0 ₽', desc: 'Пробный урок', cta: 'Записаться', highlight: true },
      { name: 'Месяц', price: '4 900 ₽', desc: '8 занятий', cta: 'Хочу' },
    ],
  },
  countdown: { until: new Date(Date.now() + 7 * 86400000).toISOString() },
  survey: {
    questions: [
      {
        id: 'q1',
        text: 'Какой курс интересен?',
        options: [
          { value: 'python', label: 'Python' },
          { value: 'scratch', label: 'Scratch' },
          { value: 'web', label: 'Веб' },
        ],
      },
    ],
  },
  quiz_game: {
    questions: [
      {
        id: 'q1',
        text: 'Что такое переменная?',
        options: [
          { value: 'a', label: 'Коробка для данных' },
          { value: 'b', label: 'Ошибка' },
        ],
        correct: 'a',
      },
      {
        id: 'q2',
        text: '2 + 2?',
        options: [
          { value: '3', label: '3' },
          { value: '4', label: '4' },
        ],
        correct: '4',
      },
    ],
  },
  trial_teaser: {
    previewText: 'Урок 1: напиши первую программу «Привет, мир!»',
    unlockHint: 'Откройте фрагмент и получите очки — затем оставьте заявку',
    buttonLabel: 'Открыть пробный',
    points: 20,
  },
  faq: {
    items: [
      { q: 'С какого возраста?', a: 'С 1 по 11 класс — подберём программу.' },
      { q: 'Онлайн или офлайн?', a: 'Оба формата.' },
    ],
  },
  testimonials: {
    items: [{ text: 'Ребёнок сам просит ещё урок!', author: 'Мама Максима, 7 класс' }],
  },
  cta_form: { interestDefault: 'Python', gamifyPoints: 50, successText: 'Спасибо! Мы на связи.' },
};

export default function LandingBuilderPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const allowed = can(user, 'marketing.landings');
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({ themes: [], block_types: [] });
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [form] = Form.useForm();
  const [pageForm] = Form.useForm();
  const [themeForm] = Form.useForm();

  async function load() {
    const [page, m] = await Promise.all([api(`/landings/${id}`), api('/landings/meta')]);
    setData(page);
    setMeta(m);
    pageForm.setFieldsValue({
      title: page.page.title,
      slug: page.page.slug,
      theme_id: page.page.theme_id,
      status: page.page.status,
    });
  }

  useEffect(() => {
    if (!allowed) return;
    load().catch((e) => setError(e.message));
  }, [allowed, id]);

  const selected = useMemo(
    () => data?.blocks?.find((b) => b.id === selectedId) || null,
    [data, selectedId]
  );

  const tokens = data?.page?.theme?.tokens || {};
  const cssVars = themeCssVars(tokens);

  useEffect(() => {
    if (selected) {
      form.setFieldsValue({
        title: selected.title,
        content: selected.content,
        visible: selected.visible,
        config_json: JSON.stringify(selected.config || {}, null, 2),
      });
    }
  }, [selected, form]);

  if (!allowed) return <Navigate to="/office" replace />;
  if (error) return <Alert type="error" message={error} showIcon />;
  if (!data) return <Card loading />;

  async function savePage(values) {
    try {
      const res = await api(`/landings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      setData(res);
      message.success('Страница сохранена');
    } catch (e) {
      message.error(e.message);
    }
  }

  async function addBlock(values) {
    try {
      const type = values.type;
      const res = await api(`/landings/${id}/blocks`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          title: values.title || type,
          content: values.content || '',
          config: DEFAULT_CONFIG[type] || {},
        }),
      });
      setAddOpen(false);
      await load();
      setSelectedId(res.block.id);
      message.success('Блок добавлен');
    } catch (e) {
      message.error(e.message);
    }
  }

  async function saveBlock(values) {
    if (!selected) return;
    let config = selected.config || {};
    if (values.config_json != null) {
      try {
        config = JSON.parse(values.config_json);
      } catch {
        message.error('config JSON невалиден');
        return;
      }
    }
    try {
      await api(`/landings/blocks/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: values.title,
          content: values.content,
          visible: values.visible,
          config,
        }),
      });
      message.success('Блок сохранён');
      await load();
    } catch (e) {
      message.error(e.message);
    }
  }

  async function move(block, dir) {
    const ids = data.blocks.map((b) => b.id);
    const i = ids.indexOf(block.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const res = await api(`/landings/${id}/blocks/reorder`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    setData(res);
  }

  async function removeBlock(blockId) {
    await api(`/landings/blocks/${blockId}`, { method: 'DELETE' });
    if (selectedId === blockId) setSelectedId(null);
    await load();
  }

  async function saveTheme(values) {
    try {
      const tokens = {
        bg: values.bg,
        surface: values.surface,
        text: values.text,
        muted: values.muted,
        primary: values.primary,
        primaryText: values.primaryText,
        accent: values.accent,
        heroBg: values.heroBg,
        heroText: values.heroText,
        radius: values.radius,
        font: values.font,
        buttonRadius: values.buttonRadius,
      };
      let themeId = data.page.theme_id;
      if (values.mode === 'new') {
        const created = await api('/landings/themes/custom', {
          method: 'POST',
          body: JSON.stringify({ name: values.name, tokens }),
        });
        themeId = created.theme.id;
      } else if (themeId) {
        await api(`/landings/themes/${themeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: values.name, tokens }),
        });
      } else {
        const created = await api('/landings/themes/custom', {
          method: 'POST',
          body: JSON.stringify({ name: values.name || 'Моя тема', tokens }),
        });
        themeId = created.theme.id;
      }
      await api(`/landings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ theme_id: themeId }),
      });
      setThemeOpen(false);
      await load();
      message.success('Тема применена');
    } catch (e) {
      message.error(e.message);
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <Link to="/office/landings">← К списку</Link>
        <Link to={`/office/landings/${id}/analytics`}>Аналитика</Link>
        {data.page.status === 'published' && (
          <a href={`/l/${data.page.slug}`} target="_blank" rel="noreferrer">
            <Button icon={<EyeOutlined />} size="small">
              Публичная /l/{data.page.slug}
            </Button>
          </a>
        )}
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form form={pageForm} layout="inline" onFinish={savePage}>
          <Form.Item name="title" rules={[{ required: true }]}>
            <Input style={{ width: 220 }} placeholder="Название" />
          </Form.Item>
          <Form.Item name="slug">
            <Input style={{ width: 160 }} addonBefore="/l/" />
          </Form.Item>
          <Form.Item name="theme_id">
            <Select
              style={{ width: 180 }}
              allowClear
              options={meta.themes.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Тема"
            />
          </Form.Item>
          <Form.Item name="status">
            <Select
              style={{ width: 140 }}
              options={[
                { value: 'draft', label: 'Черновик' },
                { value: 'published', label: 'Опубликован' },
                { value: 'archived', label: 'Архив' },
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
            Сохранить
          </Button>
          <Button onClick={() => setThemeOpen(true)}>Цвета / тема</Button>
        </Form>
      </Card>

      <Row gutter={16}>
        <Col xs={24} md={7}>
          <Card
            title="Блоки"
            size="small"
            extra={
              <Button size="small" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
                Добавить
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {data.blocks.map((b) => (
                <Card
                  key={b.id}
                  size="small"
                  hoverable
                  onClick={() => setSelectedId(b.id)}
                  style={{
                    borderColor: selectedId === b.id ? tokens.primary || '#8E6FAF' : undefined,
                    opacity: b.visible ? 1 : 0.5,
                  }}
                >
                  <Space wrap>
                    <Tag>{b.type}</Tag>
                    <Typography.Text>{b.title || b.slug}</Typography.Text>
                  </Space>
                  <div style={{ marginTop: 8 }}>
                    <Space>
                      <Button
                        size="small"
                        icon={<ArrowUpOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          move(b, -1);
                        }}
                      />
                      <Button
                        size="small"
                        icon={<ArrowDownOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          move(b, 1);
                        }}
                      />
                      <Button
                        size="small"
                        danger
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBlock(b.id);
                        }}
                      >
                        ×
                      </Button>
                    </Space>
                  </div>
                </Card>
              ))}
            </Space>
          </Card>

          {selected && (
            <Card title={`Правка: ${selected.type}`} size="small" style={{ marginTop: 12 }}>
              <Form form={form} layout="vertical" onFinish={saveBlock}>
                <Form.Item name="title" label="Заголовок">
                  <Input />
                </Form.Item>
                <Form.Item name="content" label="Текст / контент">
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item name="visible" label="Видимый" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name="config_json" label="Config (JSON)">
                  <Input.TextArea rows={10} style={{ fontFamily: 'monospace', fontSize: 12 }} />
                </Form.Item>
                <Button type="primary" htmlType="submit" block>
                  Сохранить блок
                </Button>
              </Form>
            </Card>
          )}
        </Col>

        <Col xs={24} md={17}>
          <Card title="Превью" size="small">
            <div
              className="landing-preview"
              style={{
                ...cssVars,
                background: 'var(--lp-bg)',
                color: 'var(--lp-text)',
                fontFamily: 'var(--lp-font)',
                borderRadius: 12,
                padding: 12,
                minHeight: 480,
              }}
            >
              {data.blocks
                .filter((b) => b.visible)
                .map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedId(b.id)}
                    style={{
                      outline: selectedId === b.id ? `2px solid ${tokens.primary || '#8E6FAF'}` : 'none',
                      borderRadius: 8,
                      marginBottom: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <LandingBlockRenderer
                      block={b}
                      page={data.page}
                      preview
                      themeTokens={tokens}
                    />
                  </div>
                ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Добавить блок"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => form.submit()}
        footer={null}
        destroyOnClose
      >
        <Form
          layout="vertical"
          onFinish={addBlock}
          initialValues={{ type: 'features' }}
        >
          <Form.Item name="type" label="Тип" rules={[{ required: true }]}>
            <Select
              options={(meta.block_types || []).map((t) => ({
                value: t.type,
                label: `${t.label} (${t.type})`,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="title" label="Заголовок">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Добавить
          </Button>
        </Form>
      </Modal>

      <Modal
        title="Тема и цвета"
        open={themeOpen}
        onCancel={() => setThemeOpen(false)}
        onOk={() => themeForm.submit()}
        destroyOnClose
        width={560}
      >
        <Form
          form={themeForm}
          layout="vertical"
          onFinish={saveTheme}
          initialValues={{
            mode: 'edit',
            name: data.page.theme?.name || 'Моя тема',
            bg: tokens.bg || '#F5F7FA',
            surface: tokens.surface || '#FFFFFF',
            text: tokens.text || '#2C3E50',
            muted: tokens.muted || '#6B7C93',
            primary: tokens.primary || '#8E6FAF',
            primaryText: tokens.primaryText || '#FFFFFF',
            accent: tokens.accent || '#27AE60',
            heroBg: tokens.heroBg || '#8E6FAF',
            heroText: tokens.heroText || '#FFFFFF',
            radius: tokens.radius || '16px',
            font: tokens.font || 'system-ui, sans-serif',
            buttonRadius: tokens.buttonRadius || '12px',
          }}
        >
          <Form.Item name="mode" label="Сохранить как">
            <Select
              options={[
                { value: 'edit', label: 'Обновить текущую / применить' },
                { value: 'new', label: 'Новая тема' },
              ]}
            />
          </Form.Item>
          <Form.Item name="name" label="Название темы">
            <Input />
          </Form.Item>
          <Row gutter={8}>
            {[
              ['bg', 'Фон'],
              ['surface', 'Карточки'],
              ['text', 'Текст'],
              ['muted', 'Вторичный'],
              ['primary', 'Акцент'],
              ['primaryText', 'Текст кнопки'],
              ['accent', 'Доп. акцент'],
              ['heroText', 'Текст hero'],
            ].map(([name, label]) => (
              <Col span={12} key={name}>
                <Form.Item name={name} label={label}>
                  <Input type="color" />
                </Form.Item>
              </Col>
            ))}
          </Row>
          <Form.Item name="heroBg" label="Hero фон (цвет или CSS gradient)">
            <Input />
          </Form.Item>
          <Form.Item name="radius" label="Скругление">
            <Input />
          </Form.Item>
          <Form.Item name="buttonRadius" label="Скругление кнопок">
            <Input />
          </Form.Item>
          <Form.Item name="font" label="Шрифт">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

