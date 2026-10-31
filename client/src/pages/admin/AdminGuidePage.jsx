import { Navigate, Link } from 'react-router-dom';
import {
  Alert,
  Card,
  Collapse,
  Divider,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { useAuth } from '../../auth';

const { Title, Paragraph, Text } = Typography;

const MODULES = [
  {
    key: 'learn',
    label: 'Обучение',
    children: (
      <div>
        <Paragraph>
          Каталог курсов для 1–11 классов, запись, уроки, тесты, прогресс и сертификаты.
        </Paragraph>
        <ul>
          <li>
            <Text code>/courses</Text> — каталог с фильтром по классу и категории
          </li>
          <li>
            <Text code>/dashboard</Text> — кабинет ученика (ДЗ, расписание, сертификаты)
          </li>
          <li>
            <Text code>/lessons/:id</Text> — урок (Markdown / блоки конструктора)
          </li>
          <li>
            <Text code>/certificates/:id</Text> — печать сертификата
          </li>
          <li>
            <Text code>/portfolio</Text> — портфолио проектов ученика
          </li>
          <li>
            <Text code>/diary</Text> — дневник с формулами оценок и запросами на повышение
          </li>
        </ul>
      </div>
    ),
  },
  {
    key: 'content',
    label: 'Контент и конструктор курсов',
    children: (
      <div>
        <Paragraph>
          Преподаватель собирает курсы из блоков-виджетов (как конструктор страниц).
        </Paragraph>
        <ul>
          <li>
            <Text code>/teacher/blocks</Text> — один экран: курс из блоков «урок», «проверочная», «материал»
          </li>
          <li>
            <Text code>/teacher</Text> — кабинет контента, создание курсов/уроков
          </li>
          <li>
            <Text code>/teacher/builder/:courseId</Text> — редактор секций, уроков и блоков
          </li>
          <li>
            Типы блоков: heading, markdown, video, quiz, file, image, checklist и др.
          </li>
          <li>
            Share-ссылки: <Text code>/s/:token</Text> — ограниченный доступ к уроку/блоку
          </li>
        </ul>
      </div>
    ),
  },
  {
    key: 'office',
    label: 'Офис школы',
    children: (
      <div>
        <Paragraph>
          Операционный контур: CRM, группы, оплаты, расписание, ДЗ, посещаемость, документы.
          Меню офиса зависит от прав роли — лишнего не видно.
        </Paragraph>
        <ul>
          <li>
            <Text code>/office</Text> — обзор
          </li>
          <li>
            <Text code>/office/leads</Text> — CRM заявок; публичная форма{' '}
            <Text code>/apply</Text>
          </li>
          <li>
            <Text code>/office/trials</Text> — пробные уроки из заявок
          </li>
          <li>
            <Text code>/office/contacts</Text>, <Text code>/office/groups</Text> — люди и группы
          </li>
          <li>
            <Text code>/office/payments</Text> — оплаты + CSV
          </li>
          <li>
            <Text code>/office/schedule</Text>, <Text code>/office/attendance</Text> — занятия и
            отметки
          </li>
          <li>
            <Text code>/office/homework</Text>, <Text code>/office/gradebook</Text> — ДЗ и журнал
          </li>
          <li>
            <Text code>/office/materials</Text>, <Text code>/office/documents</Text> — материалы и
            файлы
          </li>
          <li>
            <Text code>/office/announcements</Text>, <Text code>/office/reports</Text> — объявления
            и сводка
          </li>
        </ul>
      </div>
    ),
  },
  {
    key: 'marketing',
    label: 'Лендинги и маркетинг',
    children: (
      <div>
        <Paragraph>
          Гибкий конструктор промо-страниц: темы/цвета, блоки, опросы, геймификация, пробный
          контент. Заявки уходят в CRM с атрибуцией лендинга.
        </Paragraph>
        <ul>
          <li>
            <Text code>/office/landings</Text> — список акций
          </li>
          <li>
            <Text code>/office/landings/:id/edit</Text> — редактор блоков и тем
          </li>
          <li>
            <Text code>/office/landings/:id/analytics</Text> — воронка и события
          </li>
          <li>
            Публично: <Text code>/l/:slug</Text> (демо после seed:{' '}
            <Text code>/l/python-leto</Text>)
          </li>
        </ul>
      </div>
    ),
  },
  {
    key: 'analytics',
    label: 'Аналитика и отчёты',
    children: (
      <div>
        <Paragraph>
          Конструктор отчётов: шаблоны, виджеты (графики/KPI/таблицы), сохранение досок, экспорт.
        </Paragraph>
        <ul>
          <li>
            <Text code>/office/analytics</Text> — собрать отчёт как нужно
          </li>
          <li>
            Экспорт: HTML, PDF, PPTX, CSV, JSON
          </li>
          <li>
            Шаблоны: маркетинг-воронка, сравнение лендингов, финансы, пульс школы
          </li>
        </ul>
      </div>
    ),
  },
  {
    key: 'comms',
    label: 'Коммуникации и кабинеты',
    children: (
      <div>
        <ul>
          <li>
            <Text code>/messages</Text> — переписка ученик/родитель ↔ школа
          </li>
          <li>
            <Text code>/parent</Text> — кабинет родителя (оплаты, ДЗ, посещаемость ребёнка)
          </li>
          <li>
            Уведомления — колокольчик в шапке; объявления из офиса
          </li>
          <li>
            Кнопка <Text strong>Гид</Text> — повтор обучающего тура
          </li>
        </ul>
      </div>
    ),
  },
  {
    key: 'admin',
    label: 'Админка и RBAC',
    children: (
      <div>
        <Paragraph>
          Работают администратор, преподаватель, методист, ученик и родитель. Методист входит
          только в конструктор курсов. Бухгалтер, HR, аналитик и рекламщик остаются в базе, но
          отключены: их нельзя назначить и под ними нельзя войти.
        </Paragraph>
        <ul>
          <li>
            <Text code>/admin/users</Text> — люди, роли, пароль, блокировка
          </li>
          <li>
            <Text code>/admin/roles</Text> — права действующих ролей
          </li>
          <li>Роли для входа: admin, teacher, methodist, student, parent</li>
        </ul>
      </div>
    ),
  },
];

const ROLE_ROWS = [
  { role: 'Админ', where: '/admin, /office, всё', how: 'Полный доступ, эта страница-гид' },
  {
    role: 'Преподаватель',
    where: '/office, /teacher, /diary',
    how: 'Обучение + офис + конструктор курсов',
  },
  {
    role: 'Методист',
    where: '/teacher/blocks',
    how: 'Только курсы, уроки, проверочные и материалы',
  },
  { role: 'Ученик', where: '/dashboard, /courses, /diary', how: 'Учёба и портфолио' },
  { role: 'Родитель', where: '/parent, /diary, /messages', how: 'Контроль ребёнка' },
];

const FAQ = [
  {
    key: 'mvp',
    label: 'Это уже готовый продукт?',
    children: (
      <Paragraph>
        Нет. IT-Scool сейчас — <Text strong>MVP</Text> (минимально жизнеспособный продукт): одна
        школа / один инстанс, SQLite, базовые сценарии обучения и офиса. Цель MVP — быстро запустить
        процессы и проверить гипотезы, а не закрыть все enterprise-кейсы сразу.
      </Paragraph>
    ),
  },
  {
    key: 'find',
    label: 'Где что искать в интерфейсе?',
    children: (
      <div>
        <Paragraph>
          Верхнее меню зависит от прав. Офисные разделы — в{' '}
          <Link to="/office">Офис</Link>. Админ-функции — в{' '}
          <Link to="/admin/users">Админ</Link>. Публичные страницы без логина: каталог, заявка{' '}
          <Text code>/apply</Text>, лендинги <Text code>/l/…</Text>.
        </Paragraph>
        <Paragraph type="secondary">
          Если пункта меню нет — роли не хватает права. Проверьте{' '}
          <Link to="/admin/roles">Роли и права</Link>.
        </Paragraph>
      </div>
    ),
  },
  {
    key: 'demo',
    label: 'Как смотреть демо под разными ролями?',
    children: (
      <Paragraph>
        После <Text code>npm run seed</Text> есть аккаунты{' '}
        <Text code>*@itscool.local</Text> (см. README). Выйдите и войдите под нужной ролью. Повторный
        seed очищает базу.
      </Paragraph>
    ),
  },
  {
    key: 'blocks',
    label: 'Чем отличаются блоки курса и блоки лендинга?',
    children: (
      <Paragraph>
        Это разные конструкторы с общей идеей «страница = список виджетов». Курсовые блоки живут в
        уроках и связаны с прогрессом/дневником. Лендинговые — публичные промо-страницы, лиды и
        геймификация. Дальше планируется общий registry блоков и переиспользование.
      </Paragraph>
    ),
  },
  {
    key: 'export',
    label: 'Как выгрузить отчёт для презентации?',
    children: (
      <Paragraph>
        Откройте <Link to="/office/analytics">Аналитика</Link> → шаблон или свои виджеты →{' '}
        <Text strong>Экспорт</Text> → PPTX / PDF / HTML. Для одного лендинга тот же экспорт есть на
        странице аналитики лендинга.
      </Paragraph>
    ),
  },
  {
    key: 'rights',
    label: 'Кто ведёт лендинги?',
    children: (
      <Paragraph>
        Отдельная роль маркетолога отключена. Лендинги и CRM открыты администратору и
        преподавателю — у них уже есть <Text code>marketing.landings</Text> и{' '}
        <Text code>office.leads</Text>.
      </Paragraph>
    ),
  },
];

export default function AdminGuidePage() {
  const { user } = useAuth();

  if (!user || user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Внутренний гид платформы (только роль admin)"
        description="Описание MVP, карта разделов, FAQ и стратегия развития. Не показывается другим ролям."
      />

      <Title level={2} style={{ marginBottom: 4 }}>
        IT-Scool: что есть и как пользоваться
      </Title>
      <Paragraph type="secondary">
        Портативная обучающая платформа IT-курсов для школьников 1–11 классов. Стек: React + Express
        + SQLite, один процесс Node на порту 3000.
      </Paragraph>

      <Card title="Статус: MVP" style={{ marginBottom: 16 }}>
        <Paragraph>
          Текущая версия — <Text strong>MVP</Text>: закрывает учебный цикл, офис школы, маркетинг
          лендингов и гибкие роли. Это фундамент для роста, а не финальная «коробка навсегда».
        </Paragraph>
        <Paragraph style={{ marginBottom: 0 }}>
          Принцип MVP: каждый модуль должен быть полезен уже сейчас, но спроектирован так, чтобы
          наращивать блоки, дизайн-систему и интеграции без переписывания с нуля.
        </Paragraph>
      </Card>

      <Card title="Быстрый старт для администратора" style={{ marginBottom: 16 }}>
        <Timeline
          items={[
            {
              children: (
                <>
                  Войдите как <Text code>admin@itscool.local</Text> / <Text code>admin123</Text>
                </>
              ),
            },
            {
              children: (
                <>
                  Создайте сотрудников в <Link to="/admin/users">Пользователи</Link> и проверьте права в{' '}
                  <Link to="/admin/roles">Роли</Link>
                </>
              ),
            },
            {
              children: (
                <>
                  Настройте контент в <Link to="/teacher">Контент</Link> / конструкторе курсов
                </>
              ),
            },
            {
              children: (
                <>
                  Заведите группы, расписание и оплаты в <Link to="/office">Офисе</Link>
                </>
              ),
            },
            {
              children: (
                <>
                  Лендинги — в <Link to="/office/landings">Лендинги</Link>, сводка — в{' '}
                  <Link to="/office/analytics">Аналитика</Link>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Title level={3}>Карта функционала</Title>
      <Collapse accordion items={MODULES} style={{ marginBottom: 24 }} />

      <Title level={3}>Роли: где работать</Title>
      <Card style={{ marginBottom: 24 }}>
        <Table
          size="small"
          pagination={false}
          rowKey="role"
          dataSource={ROLE_ROWS}
          columns={[
            { title: 'Роль', dataIndex: 'role', width: 140 },
            { title: 'Где искать', dataIndex: 'where' },
            { title: 'Зачем', dataIndex: 'how' },
          ]}
        />
      </Card>

      <Title level={3}>FAQ</Title>
      <Collapse items={FAQ} style={{ marginBottom: 24 }} />

      <Title level={3}>Стратегия развития</Title>
      <Card style={{ marginBottom: 16 }}>
        <Title level={5}>1. Блоки (единый конструктор)</Title>
        <Paragraph>
          Сейчас два семейства виджетов: уроки и лендинги. Дальше — общий registry типов блоков
          (схема props, превью, валидация), версии блоков, marketplace школьных шаблонов, A/B-варианты
          секций на лендингах, условная видимость («показать блок, если набрано N очков»).
        </Paragraph>

        <Title level={5}>2. Дизайн-система</Title>
        <Paragraph>
          База уже в <Text code>client/src/theme/colors.js</Text> (акцент, светлая/тёмная тема).
          Развитие: токены типографики и отступов, библиотека UI-паттернов школы (карточка курса,
          hero, CTA), визуальный редактор темы лендинга без JSON, бренд-пакеты под франшизы/филиалы,
          accessibility (контраст, фокус, крупные зоны клика для младших классов).
        </Paragraph>

        <Title level={5}>3. Обучение и дневник</Title>
        <Paragraph>
          Адаптивные траектории, больше интерактивных блоков (код в браузере, симуляторы), рубрики
          оценивания, экспорт дневника для школы/родителя, мобильное приложение ученика.
        </Paragraph>

        <Title level={5}>4. Офис и операции</Title>
        <Paragraph>
          Повторяющиеся платежи и чеки, напоминания, календарь с конфликтами преподавателей,
          импорт/экспорт 1С/банковских выписок (по мере спроса), автоматизации «заявка → пробный →
          группа».
        </Paragraph>

        <Title level={5}>5. Маркетинг и аналитика</Title>
        <Paragraph>
          Шаблоны лендингов «под ключ», UTM-конструктор, когорты и LTV, дашборды по филиалам,
          scheduled-рассылки отчётов на почту, встраивание виджетов записи на сайт школы.
        </Paragraph>

        <Title level={5}>6. Платформа</Title>
        <Paragraph style={{ marginBottom: 0 }}>
          Мультишкольность (tenant), бэкапы/миграции одной кнопкой, аудит действий админа, API для
          интеграций, вынос медиа в объектное хранилище, ужесточение безопасности (2FA для staff).
        </Paragraph>
      </Card>

      <Card>
        <Space direction="vertical" size={4}>
          <Text type="secondary">Полезные ссылки внутри продукта</Text>
          <Space wrap>
            <Tag>
              <Link to="/admin/users">Пользователи</Link>
            </Tag>
            <Tag>
              <Link to="/admin/roles">Роли</Link>
            </Tag>
            <Tag>
              <Link to="/office">Офис</Link>
            </Tag>
            <Tag>
              <Link to="/office/landings">Лендинги</Link>
            </Tag>
            <Tag>
              <Link to="/office/analytics">Аналитика</Link>
            </Tag>
            <Tag>
              <Link to="/teacher">Контент</Link>
            </Tag>
            <Tag>
              <Link to="/l/python-leto">Демо-лендинг</Link>
            </Tag>
          </Space>
          <Divider style={{ margin: '12px 0' }} />
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Технический README проекта — в корне репозитория. Эта страница — продуктовый гид для
            администратора школы.
          </Paragraph>
        </Space>
      </Card>
    </div>
  );
}
