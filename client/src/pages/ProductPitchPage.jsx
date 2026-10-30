import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Anchor, Button, Dropdown, Space, Table, Tag, Typography, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { exportPitchPdf, exportPitchPptx } from '../utils/pitchExport';

const { Title, Paragraph, Text } = Typography;

const SCREENSHOTS = [
  {
    src: '/pitch/pitch-map.png',
    title: 'Карта платформы',
    caption:
      'Единый контур: обучение, офис/CRM, кабинет родителя, маркетинг-лендинги, аналитика и админка с ролями.',
  },
  {
    src: '/pitch/pitch-dashboard.png',
    title: 'Кабинет ученика',
    caption:
      'Курсы 1–11 классов, прогресс, домашние задания, расписание и сертификаты в одном месте.',
  },
  {
    src: '/pitch/pitch-crm.png',
    title: 'Офис и CRM заявок',
    caption:
      'Воронка лидов, контакты, группы, оплаты, пробные уроки — операционный контур школы.',
  },
  {
    src: '/pitch/pitch-parent.png',
    title: 'Кабинет родителя',
    caption: 'Посещаемость, домашки и оплаты ребёнка — прозрачность для семьи без лишней нагрузки.',
  },
  {
    src: '/pitch/pitch-landing.png',
    title: 'Конструктор лендингов',
    caption:
      'Маркетолог собирает промо-страницы из блоков: темы, формы, опросы. Заявки сразу в CRM.',
  },
];

const MODULES = [
  {
    id: 'learn',
    title: 'Обучение',
    tag: 'Ученик / преподаватель',
    points: [
      'Каталог курсов с фильтром по классу (1–11) и категории',
      'Уроки: текст, код, видео, чеклисты; конструктор блоков урока',
      'Тесты с автооценкой, прогресс, сертификаты',
      'Дневник с формулами оценок и запросами на повышение',
      'Портфолио проектов ученика',
      'Share-ссылки на урок/блок (/s/:token)',
    ],
    routes: ['/courses', '/dashboard', '/diary', '/portfolio', '/teacher/builder/:id'],
  },
  {
    id: 'office',
    title: 'Офис школы',
    tag: 'Операции',
    points: [
      'CRM заявок + публичная форма /apply',
      'Пробные уроки из лидов',
      'Контакты ученик/родитель, группы',
      'Оплаты с CSV-экспортом',
      'Расписание и посещаемость',
      'Домашние задания и журнал оценок',
      'Материалы курсов, документы/файлы, объявления',
    ],
    routes: ['/office', '/office/leads', '/office/payments', '/office/attendance'],
  },
  {
    id: 'parent',
    title: 'Кабинет родителя',
    tag: 'Семья',
    points: [
      'Оплаты и статусы по ребёнку',
      'Посещаемость и домашние задания',
      'Сообщения со школой',
      'Доступ к дневнику (по правам роли)',
    ],
    routes: ['/parent', '/messages', '/diary'],
  },
  {
    id: 'marketing',
    title: 'Маркетинг и лендинги',
    tag: 'Рекламщик',
    points: [
      'Конструктор промо-страниц (темы, цвета, блоки)',
      'Опросы, геймификация, тизер пробного контента',
      'Публичные URL /l/:slug',
      'Аналитика воронки лендинга',
      'Лиды с атрибуцией → CRM',
    ],
    routes: ['/office/landings', '/l/python-leto'],
  },
  {
    id: 'analytics',
    title: 'Аналитика и отчёты',
    tag: 'Аналитик / руководство',
    points: [
      'Конструктор дашбордов: KPI, графики, таблицы',
      'Готовые шаблоны (воронка, финансы, пульс школы)',
      'Экспорт HTML / PDF / PPTX / CSV / JSON — удобно для презентаций заказчику',
    ],
    routes: ['/office/analytics'],
  },
  {
    id: 'admin',
    title: 'Роли и права (RBAC)',
    tag: 'Админ / HR',
    points: [
      'Роли из коробки: админ, преподаватель, методист, бухгалтер, HR, аналитик, рекламщик, ученик, родитель',
      'Гибкие права: меню офиса показывает только разрешённое',
      'Управление людьми: роли, пароль, блокировка',
    ],
    routes: ['/admin/users', '/admin/roles'],
  },
];

const ROLE_ROWS = [
  {
    key: 'admin',
    role: 'Администратор',
    sees: 'Всё: админка, офис, контент',
    forWhom: 'Владелец / директор IT-школы',
  },
  {
    key: 'teacher',
    role: 'Преподаватель',
    sees: 'Офис, конструктор курсов, дневник, группы',
    forWhom: 'Ведение занятий и контента',
  },
  {
    key: 'methodist',
    role: 'Методист',
    sees: 'Конструктор курсов, материалы, дневник',
    forWhom: 'Программы без финансов',
  },
  {
    key: 'accountant',
    role: 'Бухгалтер',
    sees: 'Оплаты, отчёты',
    forWhom: 'Финансовый контур',
  },
  {
    key: 'hr',
    role: 'HR',
    sees: 'Пользователи, контакты, группы',
    forWhom: 'Люди и оргструктура',
  },
  {
    key: 'analyst',
    role: 'Аналитик',
    sees: 'Аналитика, отчёты',
    forWhom: 'Дашборды и выгрузки',
  },
  {
    key: 'marketer',
    role: 'Рекламщик',
    sees: 'Лендинги, CRM, пробные',
    forWhom: 'Акции и лидогенерация',
  },
  {
    key: 'student',
    role: 'Ученик',
    sees: 'Курсы, кабинет, дневник, портфолио',
    forWhom: 'Обучение 1–11 класс',
  },
  {
    key: 'parent',
    role: 'Родитель',
    sees: 'Кабинет родителя, сообщения, дневник',
    forWhom: 'Контроль ребёнка',
  },
];

const JOURNEYS = [
  {
    title: 'От заявки до группы',
    steps: [
      'Родитель оставляет заявку на /apply или на лендинге /l/…',
      'Лид появляется в CRM офиса с источником',
      'Назначается пробный урок',
      'После конверсии — контакт, группа, оплаты и расписание',
    ],
  },
  {
    title: 'Учебный цикл',
    steps: [
      'Методист/преподаватель собирает курс из блоков',
      'Ученик проходит уроки и тесты',
      'Оценки в дневнике и журнале, ДЗ проверяются в офисе',
      'По завершении — сертификат и проект в портфолио',
    ],
  },
  {
    title: 'Маркетинг-кампания',
    steps: [
      'Рекламщик собирает лендинг в конструкторе',
      'Публикует /l/slug и запускает трафик',
      'Смотрит воронку на аналитике лендинга',
      'Выгружает отчёт PPTX/PDF для руководства',
    ],
  },
];

const DEMO = [
  { role: 'Админ', login: 'admin@itscool.local', pass: 'admin123' },
  { role: 'Рекламщик', login: 'marketer@itscool.local', pass: 'marketer123' },
  { role: 'Преподаватель', login: 'teacher@itscool.local', pass: 'teacher123' },
  { role: 'Ученик', login: 'student@itscool.local', pass: 'student123' },
  { role: 'Родитель', login: 'parent@itscool.local', pass: 'parent123' },
];

const TOC = [
  { key: 'overview', href: '#overview', title: 'О продукте' },
  { key: 'map', href: '#map', title: 'Карта' },
  { key: 'shots', href: '#shots', title: 'Скриншоты' },
  { key: 'modules', href: '#modules', title: 'Функционал' },
  { key: 'roles', href: '#roles', title: 'Роли' },
  { key: 'journeys', href: '#journeys', title: 'Сценарии' },
  { key: 'tech', href: '#tech', title: 'Технологии' },
  { key: 'demo', href: '#demo', title: 'Демо-доступ' },
];

function pitchPayload() {
  return {
    screenshots: SCREENSHOTS,
    modules: MODULES.map(({ title, tag, points }) => ({ title, tag, points })),
    roles: ROLE_ROWS.map(({ role, sees, forWhom }) => ({ role, sees, forWhom })),
    journeys: JOURNEYS,
    demo: DEMO,
  };
}

export default function ProductPitchPage() {
  const [downloading, setDownloading] = useState(false);

  async function download(fmt) {
    setDownloading(true);
    const hide = message.loading(
      fmt === 'pptx' ? 'Собираем PPTX…' : 'Собираем PDF…',
      0
    );
    try {
      const data = pitchPayload();
      if (fmt === 'pptx') await exportPitchPptx(data);
      else await exportPitchPdf(data);
      message.success(fmt === 'pptx' ? 'PPTX скачан' : 'PDF скачан');
    } catch (e) {
      console.error(e);
      message.error(e?.message || 'Не удалось скачать презентацию');
    } finally {
      hide();
      setDownloading(false);
    }
  }

  const downloadMenu = {
    items: [
      { key: 'pptx', label: 'Презентация PPTX (для показа)' },
      { key: 'pdf', label: 'Документ PDF' },
    ],
    onClick: ({ key }) => download(key),
  };

  return (
    <div className="pitch-page">
      <section className="pitch-hero">
        <div className="pitch-hero-inner">
          <p className="hero-brand">IT-Scool</p>
          <Title level={1} className="pitch-hero-title">
            Платформа IT-школы: обучение, офис, маркетинг и аналитика в одном продукте
          </Title>
          <Paragraph className="pitch-hero-lead">
            Портативное MVP для школ и кружков 1–11 классов. Ниже — подробная презентация для
            заказчика: карта модулей, скриншоты интерфейсов и список функций.
          </Paragraph>
          <Space wrap size="middle">
            <Dropdown menu={downloadMenu} placement="bottomLeft">
              <Button type="primary" size="large" icon={<DownloadOutlined />} loading={downloading}>
                Скачать презу
              </Button>
            </Dropdown>
            <a href="#map">
              <Button size="large">Смотреть карту</Button>
            </a>
            <Link to="/apply">
              <Button size="large">Оставить заявку</Button>
            </Link>
            <Link to="/login">
              <Button size="large" type="dashed">
                Войти в демо
              </Button>
            </Link>
          </Space>
        </div>
      </section>

      <div className="pitch-layout">
        <aside className="pitch-toc">
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Навигация
          </Text>
          <Anchor affix={false} items={TOC} />
        </aside>

        <div className="pitch-main">
          <section id="overview" className="pitch-section">
            <Title level={2}>Что это за продукт</Title>
            <Paragraph>
              <Text strong>IT-Scool</Text> — единая веб-платформа для IT-школы: ученики учатся,
              преподаватели ведут контент и группы, офис закрывает CRM и оплаты, родители видят
              прогресс ребёнка, маркетолог запускает лендинги, аналитик собирает отчёты.
            </Paragraph>
            <Paragraph type="secondary">
              Статус: <Tag color="purple">MVP</Tag> — рабочий контур «одна школа / один инстанс»,
              готовый к пилоту и демонстрации заказчику. Дальше расширяется без смены архитектуры
              кабинетов.
            </Paragraph>
            <ul className="pitch-bullets">
              <li>Курсы Scratch, Python, веб, алгоритмы, кибербезопасность — под классы 1–11</li>
              <li>Один вход — разные кабинеты по роли (RBAC)</li>
              <li>Светлая/тёмная тема, адаптив, крупный UI Ant Design</li>
              <li>Деплой: один процесс Node (API + фронт), SQLite, порт 3000</li>
            </ul>
          </section>

          <section id="map" className="pitch-section">
            <Title level={2}>Карта платформы</Title>
            <Paragraph>
              Центральный продукт и шесть контуров вокруг него. Каждый контур закрывает свою роль в
              школе — без «зоопарка» отдельных сервисов.
            </Paragraph>
            <figure className="pitch-shot">
              <img src="/pitch/pitch-map.png" alt="Карта модулей IT-Scool" />
              <figcaption>
                Карта: Обучение · Офис/CRM · Родитель · Маркетинг · Аналитика · Админ/RBAC
              </figcaption>
            </figure>
          </section>

          <section id="shots" className="pitch-section">
            <Title level={2}>Скриншоты интерфейсов</Title>
            <Paragraph type="secondary">
              Визуальный обзор ключевых экранов для презентации. В живой системе те же сценарии
              доступны под демо-аккаунтами (см. ниже).
            </Paragraph>
            <div className="pitch-gallery">
              {SCREENSHOTS.map((s) => (
                <figure key={s.src} className="pitch-shot">
                  <img src={s.src} alt={s.title} loading="lazy" />
                  <figcaption>
                    <Text strong>{s.title}.</Text> {s.caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section id="modules" className="pitch-section">
            <Title level={2}>Функционал по модулям</Title>
            <Paragraph>
              Подробный перечень возможностей — удобно листать на встрече с заказчиком.
            </Paragraph>
            <div className="pitch-modules">
              {MODULES.map((m) => (
                <article key={m.id} id={`module-${m.id}`} className="pitch-module">
                  <header>
                    <Title level={3} style={{ marginBottom: 4 }}>
                      {m.title}
                    </Title>
                    <Tag>{m.tag}</Tag>
                  </header>
                  <ul>
                    {m.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    Маршруты:{' '}
                    {m.routes.map((r, i) => (
                      <span key={r}>
                        {i > 0 ? ', ' : ''}
                        <Text code>{r}</Text>
                      </span>
                    ))}
                  </Paragraph>
                </article>
              ))}
            </div>
          </section>

          <section id="roles" className="pitch-section">
            <Title level={2}>Роли и кто что видит</Title>
            <Paragraph>
              Меню и разделы зависят от прав. Можно выдать «из коробки» или настроить свою роль в
              админке.
            </Paragraph>
            <Table
              pagination={false}
              size="middle"
              rowKey="key"
              dataSource={ROLE_ROWS}
              columns={[
                { title: 'Роль', dataIndex: 'role', width: 160 },
                { title: 'Доступ', dataIndex: 'sees' },
                { title: 'Для кого', dataIndex: 'forWhom', width: 220 },
              ]}
              scroll={{ x: true }}
            />
          </section>

          <section id="journeys" className="pitch-section">
            <Title level={2}>Сквозные сценарии</Title>
            <div className="pitch-journeys">
              {JOURNEYS.map((j) => (
                <article key={j.title} className="pitch-journey">
                  <Title level={4}>{j.title}</Title>
                  <ol>
                    {j.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </section>

          <section id="tech" className="pitch-section">
            <Title level={2}>Технологии и перенос</Title>
            <Paragraph>
              Стек: <Text strong>React (Vite) + Express + SQLite</Text> (`node:sqlite`). Один
              процесс отдаёт API и собранный фронт.
            </Paragraph>
            <ul className="pitch-bullets">
              <li>Требование: Node.js 22.5+</li>
              <li>
                Сборка релиза: <Text code>npm run setup</Text> → <Text code>npm run pack</Text>
              </li>
              <li>
                На сервере: <Text code>npm install --omit=dev</Text> → <Text code>npm start</Text>{' '}
                (порт 3000)
              </li>
              <li>Подходит VPS / сервер с Node; чистый shared-хостинг без Node — нет</li>
            </ul>
            <Paragraph type="secondary">
              Эта страница — отдельный публичный лендинг-презентация. Она не меняет офис, CRM и
              кабинеты: только рассказывает о возможностях.
            </Paragraph>
          </section>

          <section id="demo" className="pitch-section">
            <Title level={2}>Демо-доступ для показа заказчику</Title>
            <Paragraph>
              После <Text code>npm run seed</Text> (или полного setup) доступны учётки. Выйдите из
              текущей сессии и войдите под нужной ролью.
            </Paragraph>
            <Table
              pagination={false}
              size="small"
              rowKey="login"
              dataSource={DEMO}
              columns={[
                { title: 'Роль', dataIndex: 'role', width: 140 },
                {
                  title: 'Логин',
                  dataIndex: 'login',
                  render: (v) => <Text code>{v}</Text>,
                },
                {
                  title: 'Пароль',
                  dataIndex: 'pass',
                  render: (v) => <Text code>{v}</Text>,
                },
              ]}
            />
            <Paragraph style={{ marginTop: 16 }}>
              Полезные публичные URL без входа:{' '}
              <Link to="/courses">каталог</Link>, <Link to="/apply">заявка</Link>, демо-лендинг{' '}
              <Link to="/l/python-leto">/l/python-leto</Link>.
            </Paragraph>
            <Space wrap style={{ marginTop: 8 }}>
              <Dropdown menu={downloadMenu} placement="topLeft">
                <Button
                  type="primary"
                  size="large"
                  icon={<DownloadOutlined />}
                  loading={downloading}
                >
                  Скачать презу
                </Button>
              </Dropdown>
              <Link to="/login">
                <Button size="large">Открыть вход</Button>
              </Link>
              <Link to="/">
                <Button size="large">На главную школы</Button>
              </Link>
            </Space>
          </section>
        </div>
      </div>
    </div>
  );
}
