const bcrypt = require('bcryptjs');
const db = require('./db');

function clear() {
  db.exec(`
    DELETE FROM report_boards;
    DELETE FROM landing_events;
    DELETE FROM landing_game_states;
    DELETE FROM landing_survey_answers;
    DELETE FROM landing_blocks;
    DELETE FROM landing_pages;
    DELETE FROM share_links;
    DELETE FROM block_quiz_attempts;
    DELETE FROM lesson_blocks;
    DELETE FROM course_sections;
    DELETE FROM documents;
    DELETE FROM files;
    DELETE FROM portfolio_projects;
    DELETE FROM trial_lessons;
    DELETE FROM diary_feedback;
    DELETE FROM diary_raise_requests;
    DELETE FROM diary_entries;
    DELETE FROM diary_scheme_parts;
    DELETE FROM diary_schemes;
    DELETE FROM diary_criteria;
    DELETE FROM messages;
    DELETE FROM message_participants;
    DELETE FROM message_threads;
    DELETE FROM course_materials;
    DELETE FROM certificates;
    DELETE FROM notifications;
    DELETE FROM announcements;
    DELETE FROM homework_submissions;
    DELETE FROM homework;
    DELETE FROM attendance;
    DELETE FROM leads;
    DELETE FROM schedule_sessions;
    DELETE FROM payments;
    DELETE FROM group_members;
    DELETE FROM groups;
    DELETE FROM contact_links;
    DELETE FROM contacts;
    DELETE FROM quiz_attempts;
    DELETE FROM quiz_questions;
    DELETE FROM quizzes;
    DELETE FROM lesson_progress;
    DELETE FROM enrollments;
    DELETE FROM lessons;
    DELETE FROM courses;
    DELETE FROM users;
  `);
  try {
    require('./services/rbac').resetDefaultRolePermissions();
  } catch {
    // ignore if RBAC not ready
  }
}

function addUser({ email, password, name, role, grade = null }) {
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      'INSERT INTO users (email, password, name, role, grade) VALUES (?, ?, ?, ?, ?)'
    )
    .run(email, hash, name, role, grade);
  return info.lastInsertRowid;
}

function addCourse(course) {
  const info = db
    .prepare(
      `INSERT INTO courses (title, description, grade_min, grade_max, category, cover_color, icon, teacher_id)
       VALUES (@title, @description, @grade_min, @grade_max, @category, @cover_color, @icon, @teacher_id)`
    )
    .run(course);
  return info.lastInsertRowid;
}

function addLesson(lesson) {
  const info = db
    .prepare(
      `INSERT INTO lessons (course_id, title, content, sort_order, duration_min)
       VALUES (@course_id, @title, @content, @sort_order, @duration_min)`
    )
    .run(lesson);
  return info.lastInsertRowid;
}

function addQuiz(lessonId, title, questions) {
  const quizId = db
    .prepare('INSERT INTO quizzes (lesson_id, title) VALUES (?, ?)')
    .run(lessonId, title).lastInsertRowid;
  const stmt = db.prepare(
    'INSERT INTO quiz_questions (quiz_id, question, options, correct_index) VALUES (?, ?, ?, ?)'
  );
  for (const q of questions) {
    stmt.run(quizId, q.question, JSON.stringify(q.options), q.correct_index);
  }
}

clear();

const adminId = addUser({
  email: 'admin@itscool.local',
  password: 'admin123',
  name: 'Администратор',
  role: 'admin',
});

const teacherId = addUser({
  email: 'teacher@itscool.local',
  password: 'teacher123',
  name: 'Анна Преподаватель',
  role: 'teacher',
});

addUser({
  email: 'methodist@itscool.local',
  password: 'methodist123',
  name: 'Мария Методист',
  role: 'methodist',
});
addUser({
  email: 'accountant@itscool.local',
  password: 'accountant123',
  name: 'Ольга Бухгалтер',
  role: 'accountant',
});
addUser({
  email: 'hr@itscool.local',
  password: 'hr1234',
  name: 'Ирина HR',
  role: 'hr',
});
addUser({
  email: 'analyst@itscool.local',
  password: 'analyst123',
  name: 'Павел Аналитик',
  role: 'analyst',
});
addUser({
  email: 'marketer@itscool.local',
  password: 'marketer123',
  name: 'Дарья Реклама',
  role: 'marketer',
});
const marketerId = db.prepare(`SELECT id FROM users WHERE email = 'marketer@itscool.local'`).get().id;

const parentUserId = addUser({
  email: 'parent@itscool.local',
  password: 'parent123',
  name: 'Елена Ученикова',
  role: 'parent',
});

const studentUserId = addUser({
  email: 'student@itscool.local',
  password: 'student123',
  name: 'Максим Ученик',
  role: 'student',
  grade: 7,
});

const courses = [
  {
    title: 'Компьютер для самых маленьких',
    description:
      'Знакомимся с компьютером, мышкой, клавиатурой и безопасным интернетом. Идеально для 1–4 классов.',
    grade_min: 1,
    grade_max: 4,
    category: 'Основы',
    cover_color: '#0d9488',
    icon: '🖥️',
    teacher_id: teacherId,
    lessons: [
      {
        title: 'Что такое компьютер?',
        duration_min: 15,
        content: `# Что такое компьютер?

Компьютер — это умный помощник. Он помогает учиться, рисовать, смотреть видео и писать сообщения.

## Главные части
- **Монитор** — «глаза» компьютера, на нём картинка
- **Клавиатура** — для набора текста
- **Мышь** — для выбора объектов на экране
- **Системный блок** — «мозг» компьютера

## Задание
Попроси взрослого показать тебе эти части на настоящем компьютере или ноутбуке.`,
        quiz: {
          title: 'Проверка: компьютер',
          questions: [
            {
              question: 'Чем мы набираем текст?',
              options: ['Мышью', 'Клавиатурой', 'Монитором'],
              correct_index: 1,
            },
            {
              question: 'Где «думает» компьютер?',
              options: ['В системном блоке', 'В мышке', 'В колонках'],
              correct_index: 0,
            },
          ],
        },
      },
      {
        title: 'Безопасность в интернете',
        duration_min: 20,
        content: `# Безопасность в интернете

Интернет — большой город. В нём есть полезные места и опасные.

## Правила
1. Не сообщай пароли и адрес незнакомым
2. Не скачивай файлы без разрешения взрослых
3. Если что-то пугает — расскажи родителям или учителю
4. Общайся вежливо, как в реальной жизни

Интернет помогает учиться, но всегда с умом!`,
        quiz: {
          title: 'Безопасность',
          questions: [
            {
              question: 'Можно ли говорить пароль в чате?',
              options: ['Да', 'Нет', 'Только друзьям'],
              correct_index: 1,
            },
          ],
        },
      },
    ],
  },
  {
    title: 'Scratch: первые программы',
    description:
      'Создаём игры и анимации блоками Scratch. Логика программирования без сложного синтаксиса.',
    grade_min: 2,
    grade_max: 6,
    category: 'Программирование',
    cover_color: '#f59e0b',
    icon: '🐱',
    teacher_id: teacherId,
    lessons: [
      {
        title: 'Сцена, спрайты и блоки',
        duration_min: 25,
        content: `# Scratch: сцена и спрайты

В Scratch программа собирается из **цветных блоков**, как конструктор.

## Понятия
- **Спрайт** — герой (кот, мяч, персонаж)
- **Сцена** — фон и мир игры
- **Скрипт** — цепочка блоков

## Первый скрипт
1. Возьми блок «когда щёлкнут по флажку»
2. Добавь «идти 10 шагов»
3. Нажми зелёный флажок

Кот начнёт двигаться — ты уже программист!`,
        quiz: {
          title: 'Scratch старт',
          questions: [
            {
              question: 'Как называется герой в Scratch?',
              options: ['Спрайт', 'Пиксель', 'Сервер'],
              correct_index: 0,
            },
          ],
        },
      },
      {
        title: 'Циклы и условия',
        duration_min: 30,
        content: `# Циклы и условия

**Цикл** повторяет действия. **Условие** выбирает: делать или нет.

Примеры:
- «повторить 10 раз» — кот крутится
- «если касаюсь края» — отскок

Так работают почти все игры: персонаж двигается по правилам.`,
      },
    ],
  },
  {
    title: 'Python: старт для школьников',
    description:
      'Переменные, условия, циклы и первые мини-проекты на Python. Для 5–9 классов.',
    grade_min: 5,
    grade_max: 9,
    category: 'Программирование',
    cover_color: '#3776ab',
    icon: '🐍',
    teacher_id: teacherId,
    lessons: [
      {
        title: 'Переменные и print',
        duration_min: 30,
        content: `# Python: переменные

Python — язык, на котором пишут сайты, боты и игры.

\`\`\`python
name = "Максим"
age = 12
print("Привет,", name)
print("Тебе", age, "лет")
\`\`\`

## Что запомнить
- Переменная хранит значение
- \`print\` выводит текст
- Имена переменных пишут латиницей без пробелов`,
        quiz: {
          title: 'Python основы',
          questions: [
            {
              question: 'Что делает print?',
              options: ['Удаляет файл', 'Выводит текст', 'Рисует картинку'],
              correct_index: 1,
            },
            {
              question: 'Как назвать переменную с возрастом?',
              options: ['мой возраст', 'age', '123age'],
              correct_index: 1,
            },
          ],
        },
      },
      {
        title: 'Условия if / else',
        duration_min: 35,
        content: `# Условия

\`\`\`python
score = 85
if score >= 80:
    print("Отлично!")
else:
    print("Можно лучше")
\`\`\`

Компьютер проверяет условие и выбирает ветку кода.`,
      },
      {
        title: 'Цикл for',
        duration_min: 35,
        content: `# Цикл for

\`\`\`python
for i in range(5):
    print("Шаг", i)
\`\`\`

Цикл экономит время: одно правило — много повторений.`,
      },
    ],
  },
  {
    title: 'Веб: HTML и CSS',
    description:
      'Создаём первые веб-страницы: структура HTML и оформление CSS. Для 6–10 классов.',
    grade_min: 6,
    grade_max: 10,
    category: 'Веб',
    cover_color: '#e34c26',
    icon: '🌐',
    teacher_id: teacherId,
    lessons: [
      {
        title: 'Каркас HTML-страницы',
        duration_min: 30,
        content: `# HTML

HTML описывает структуру страницы.

\`\`\`html
<!DOCTYPE html>
<html>
  <head>
    <title>Моя страница</title>
  </head>
  <body>
    <h1>Привет, мир!</h1>
    <p>Это мой первый сайт.</p>
  </body>
</html>
\`\`\`

Теги \`h1\` — заголовок, \`p\` — абзац.`,
        quiz: {
          title: 'HTML',
          questions: [
            {
              question: 'Какой тег делает заголовок?',
              options: ['<p>', '<h1>', '<img>'],
              correct_index: 1,
            },
          ],
        },
      },
      {
        title: 'Красим страницу CSS',
        duration_min: 30,
        content: `# CSS

CSS отвечает за цвет, шрифт и расположение.

\`\`\`css
body {
  background: #f0f9ff;
  font-family: Arial, sans-serif;
}
h1 {
  color: #0369a1;
}
\`\`\``,
      },
    ],
  },
  {
    title: 'Алгоритмы и логика',
    description:
      'Учимся думать как программист: алгоритмы, схемы, сложность задач. Для 7–11 классов.',
    grade_min: 7,
    grade_max: 11,
    category: 'Алгоритмы',
    cover_color: '#7c3aed',
    icon: '🧩',
    teacher_id: teacherId,
    lessons: [
      {
        title: 'Что такое алгоритм?',
        duration_min: 25,
        content: `# Алгоритм

Алгоритм — понятная последовательность шагов для решения задачи.

Пример: «как заварить чай»
1. Вскипятить воду
2. Положить чайный пакетик
3. Залить воду
4. Подождать 3 минуты

В программировании алгоритм превращается в код.`,
        quiz: {
          title: 'Алгоритмы',
          questions: [
            {
              question: 'Алгоритм — это...',
              options: ['Случайный набор действий', 'Последовательность шагов', 'Только код на Python'],
              correct_index: 1,
            },
          ],
        },
      },
      {
        title: 'Поиск и сортировка (обзор)',
        duration_min: 40,
        content: `# Поиск и сортировка

- **Линейный поиск** — проверяем элементы по одному
- **Бинарный поиск** — делим пополам отсортированный список
- **Сортировка** — упорядочивание данных

Эти идеи встречаются в играх, картах и поисковиках.`,
      },
    ],
  },
  {
    title: 'JavaScript для начинающих',
    description:
      'Интерактивность в браузере: переменные, функции, события. Для 8–11 классов.',
    grade_min: 8,
    grade_max: 11,
    category: 'Веб',
    cover_color: '#f7df1e',
    icon: '⚡',
    teacher_id: teacherId,
    lessons: [
      {
        title: 'JS в браузере',
        duration_min: 35,
        content: `# JavaScript

JavaScript оживляет страницы: кнопки, анимации, формы.

\`\`\`javascript
const btn = document.querySelector('button');
btn.addEventListener('click', () => {
  alert('Кнопка нажата!');
});
\`\`\``,
        quiz: {
          title: 'JS',
          questions: [
            {
              question: 'Зачем нужен JavaScript на сайте?',
              options: ['Только для картинок', 'Для интерактивности', 'Вместо HTML'],
              correct_index: 1,
            },
          ],
        },
      },
    ],
  },
  {
    title: 'Кибербезопасность: база',
    description:
      'Пароли, фишинг, приватность данных. Практичные навыки для 9–11 классов.',
    grade_min: 9,
    grade_max: 11,
    category: 'Безопасность',
    cover_color: '#dc2626',
    icon: '🛡️',
    teacher_id: teacherId,
    lessons: [
      {
        title: 'Сильные пароли и 2FA',
        duration_min: 30,
        content: `# Пароли и двухфакторная защита

Хороший пароль:
- длинный (от 12 символов)
- уникальный для каждого сайта
- лучше хранить в менеджере паролей

**2FA** — второй фактор (код из приложения/SMS). Даже если пароль узнают, войти сложнее.`,
        quiz: {
          title: 'Безопасность',
          questions: [
            {
              question: 'Какой пароль лучше?',
              options: ['123456', 'qwerty', 'длинная уникальная фраза'],
              correct_index: 2,
            },
          ],
        },
      },
      {
        title: 'Фишинг: как не попасться',
        duration_min: 30,
        content: `# Фишинг

Фишинг — обманные письма и сайты, которые выманивают данные.

Признаки:
- срочность («аккаунт заблокируют через час»)
- странный адрес отправителя
- ссылки на подозрительные домены

Правило: сомневаешься — проверь через официальный сайт, не по ссылке из письма.`,
      },
    ],
  },
  {
    title: 'Мини-проект: портфолио разработчика',
    description:
      'Соберём личную страницу-портфолио: HTML, CSS и немного JS. Для 10–11 классов.',
    grade_min: 10,
    grade_max: 11,
    category: 'Проекты',
    cover_color: '#0ea5e9',
    icon: '🚀',
    teacher_id: teacherId,
    lessons: [
      {
        title: 'Структура портфолио',
        duration_min: 40,
        content: `# Портфолио

Разделы страницы:
1. Имя и краткое «о себе»
2. Навыки
3. Проекты
4. Контакты

Сделай простой, понятный дизайн. Лучше меньше блоков, но аккуратно.`,
      },
      {
        title: 'Публикация и презентация',
        duration_min: 30,
        content: `# Как показать работу

- Сохрани код на GitHub
- Можно выложить на бесплатный хостинг (GitHub Pages, Netlify)
- Подготовь 1-минутный рассказ: задача → решение → чему научился`,
      },
    ],
  },
];

function insertCourse(courseData) {
  const { lessons, ...course } = courseData;
  db.exec('BEGIN');
  try {
    const courseId = addCourse(course);
    lessons.forEach((lesson, index) => {
      const lessonId = addLesson({
        course_id: courseId,
        title: lesson.title,
        content: lesson.content,
        sort_order: index + 1,
        duration_min: lesson.duration_min || 20,
      });
      if (lesson.quiz) {
        addQuiz(lessonId, lesson.quiz.title, lesson.quiz.questions);
      }
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

for (const c of courses) {
  insertCourse(c);
}

// --- MVP: contacts, groups, payments, schedule ---
const pythonCourse = db.prepare(`SELECT id FROM courses WHERE title LIKE 'Python%'`).get();
const scratchCourse = db.prepare(`SELECT id FROM courses WHERE title LIKE 'Scratch%'`).get();

const parentId = db
  .prepare(
    `INSERT INTO contacts (type, name, phone, email, notes, user_id)
     VALUES ('parent', 'Елена Ученикова', '+7 900 111-22-33', 'parent@itscool.local', 'Мама Максима', ?)`
  )
  .run(parentUserId).lastInsertRowid;

const studentContactId = db
  .prepare(
    `INSERT INTO contacts (type, name, phone, email, grade, user_id, notes)
     VALUES ('student', 'Максим Ученик', '+7 900 111-22-34', 'student@itscool.local', 7, ?, 'Демо-ученик')`
  )
  .run(studentUserId).lastInsertRowid;

const student2Id = db
  .prepare(
    `INSERT INTO contacts (type, name, phone, email, grade, notes)
     VALUES ('student', 'София Код', '+7 900 222-33-44', 'sofia@example.com', 5, 'Группа Scratch')`
  )
  .run().lastInsertRowid;

const parent2Id = db
  .prepare(
    `INSERT INTO contacts (type, name, phone, email)
     VALUES ('parent', 'Игорь Код', '+7 900 222-33-45', 'igor@example.com')`
  )
  .run().lastInsertRowid;

db.prepare('INSERT INTO contact_links (parent_id, student_id) VALUES (?, ?)').run(
  parentId,
  studentContactId
);
db.prepare('INSERT INTO contact_links (parent_id, student_id) VALUES (?, ?)').run(
  parent2Id,
  student2Id
);

const groupPyId = db
  .prepare(
    `INSERT INTO groups (name, course_id, teacher_id, max_students)
     VALUES ('Python 7кл · Пн/Ср', ?, ?, 10)`
  )
  .run(pythonCourse?.id || null, teacherId).lastInsertRowid;

const groupScId = db
  .prepare(
    `INSERT INTO groups (name, course_id, teacher_id, max_students)
     VALUES ('Scratch 5кл · Сб', ?, ?, 8)`
  )
  .run(scratchCourse?.id || null, teacherId).lastInsertRowid;

db.prepare(
  `INSERT INTO group_members (group_id, contact_id) VALUES (?, ?), (?, ?)`
).run(groupPyId, studentContactId, groupScId, student2Id);

if (pythonCourse?.id) {
  db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)').run(
    studentUserId,
    pythonCourse.id
  );
}

db.prepare(
  `INSERT INTO payments (contact_id, group_id, amount, due_date, status, description)
   VALUES
   (?, ?, 4500, date('now', '+5 days'), 'pending', 'Абонемент март'),
   (?, ?, 4500, date('now', '-3 days'), 'overdue', 'Абонемент февраль'),
   (?, ?, 3500, date('now', '-10 days'), 'paid', 'Абонемент январь')`
).run(studentContactId, groupPyId, studentContactId, groupPyId, student2Id, groupScId);

db.prepare(
  `UPDATE payments SET paid_at = datetime('now', '-10 days') WHERE status = 'paid'`
).run();

db.prepare(
  `INSERT INTO schedule_sessions (group_id, teacher_id, title, starts_at, ends_at, location, status)
   VALUES
   (?, ?, 'Переменные и типы', datetime('now', '+1 day', 'start of day', '+16 hours'), datetime('now', '+1 day', 'start of day', '+17 hours', '+30 minutes'), 'Zoom / ауд. 3', 'planned'),
   (?, ?, 'Циклы for', datetime('now', '+3 days', 'start of day', '+16 hours'), datetime('now', '+3 days', 'start of day', '+17 hours', '+30 minutes'), 'Zoom / ауд. 3', 'planned'),
   (?, ?, 'Первый спрайт', datetime('now', '+2 days', 'start of day', '+11 hours'), datetime('now', '+2 days', 'start of day', '+12 hours'), 'Очно, каб. 12', 'planned'),
   (?, ?, 'Вводный урок (прошёл)', datetime('now', '-5 days', 'start of day', '+16 hours'), datetime('now', '-5 days', 'start of day', '+17 hours', '+30 minutes'), 'Zoom', 'done')`
).run(groupPyId, teacherId, groupPyId, teacherId, groupScId, teacherId, groupPyId, teacherId);

const pastSessionId = db
  .prepare(`SELECT id FROM schedule_sessions WHERE status = 'done' ORDER BY id DESC LIMIT 1`)
  .get().id;

db.prepare(
  `INSERT INTO attendance (session_id, contact_id, status) VALUES (?, ?, 'present')`
).run(pastSessionId, studentContactId);

db.prepare(
  `INSERT INTO leads (name, phone, email, child_name, child_grade, interest, source, status)
   VALUES
   ('Мария Нова', '+7 900 555-01-01', 'maria@example.com', 'Артём Нова', 6, 'Python', 'website', 'new'),
   ('Павел Старт', '+7 900 555-02-02', 'pavel@example.com', 'Кира Старт', 4, 'Scratch', 'website', 'contacted'),
   ('Ольга Пробная', '+7 900 555-03-03', 'olga@example.com', 'Лев Пробный', 8, 'Веб', 'ads', 'trial')`
).run();

const hwId = db
  .prepare(
    `INSERT INTO homework (group_id, title, description, due_date, created_by)
     VALUES (?, 'Домашка: переменные', 'Напиши программу с 3 переменными и пришли скрин.', date('now', '+4 days'), ?)`
  )
  .run(groupPyId, teacherId).lastInsertRowid;

db.prepare(
  `INSERT INTO homework_submissions (homework_id, contact_id, status) VALUES (?, ?, 'assigned')`
).run(hwId, studentContactId);

db.prepare(
  `INSERT INTO announcements (title, body, audience, author_id)
   VALUES
   ('Старт нового модуля Python', 'На этой неделе начинаем циклы. Не забудьте домашку!', 'all', ?),
   ('Родительское собрание онлайн', 'В субботу в 12:00 короткий созвон по прогрессу.', 'parents', ?)`
).run(teacherId, teacherId);

db.prepare(
  `INSERT INTO notifications (user_id, title, body, link, type)
   VALUES
   (?, 'Добро пожаловать!', 'Открой «Моё обучение» — там курсы, ДЗ и расписание.', '/dashboard', 'info'),
   (?, 'Новая заявка в CRM', 'Проверь раздел CRM в офисе.', '/office/leads', 'lead'),
   (?, 'Кабинет родителя готов', 'Следи за оплатами и домашкой Максима.', '/parent', 'info')`
).run(studentUserId, teacherId, parentUserId);

// Wave 4: materials, messages, graded HW, quiz attempt, certificate
const pyCourse = db.prepare(`SELECT id, title FROM courses WHERE title LIKE 'Python%' LIMIT 1`).get();
if (pyCourse) {
  db.prepare(
    `INSERT INTO course_materials (course_id, title, url, description, sort_order, created_by)
     VALUES
     (?, 'Шпаргалка по переменным', 'https://docs.python.org/3/tutorial/introduction.html', 'Официальный туториал', 1, ?),
     (?, 'Практика: print и input', 'https://www.w3schools.com/python/python_variables.asp', 'Короткие примеры', 2, ?)`
  ).run(pyCourse.id, teacherId, pyCourse.id, teacherId);

  db.prepare(
    `INSERT INTO certificates (user_id, course_id, title)
     VALUES (?, ?, ?)`
  ).run(studentUserId, pyCourse.id, `Сертификат: ${pyCourse.title}`);
}

const quiz = db
  .prepare(
    `SELECT q.id FROM quizzes q
     JOIN lessons l ON l.id = q.lesson_id
     JOIN courses c ON c.id = l.course_id
     WHERE c.title LIKE 'Python%'
     LIMIT 1`
  )
  .get();
if (quiz) {
  db.prepare(
    `INSERT INTO quiz_attempts (user_id, quiz_id, score, total) VALUES (?, ?, 2, 3)`
  ).run(studentUserId, quiz.id);
}

db.prepare(
  `UPDATE homework_submissions
   SET status = 'done', answer = 'a=1; b=2; c=a+b', grade = '5', teacher_note = 'Отлично!',
       submitted_at = datetime('now')
   WHERE homework_id = ? AND contact_id = ?`
).run(hwId, studentContactId);

const hw2Id = db
  .prepare(
    `INSERT INTO homework (group_id, title, description, due_date, created_by)
     VALUES (?, 'Домашка: циклы', 'Напиши цикл for на 5 итераций.', date('now', '+7 days'), ?)`
  )
  .run(groupPyId, teacherId).lastInsertRowid;

db.prepare(
  `INSERT INTO homework_submissions (homework_id, contact_id, status) VALUES (?, ?, 'assigned')`
).run(hw2Id, studentContactId);

const threadId = db
  .prepare(
    `INSERT INTO message_threads (subject, created_by, related_contact_id, group_id)
     VALUES ('Вопрос по домашке Python', ?, ?, ?)`
  )
  .run(parentUserId, studentContactId, groupPyId).lastInsertRowid;

db.prepare(
  `INSERT INTO message_participants (thread_id, user_id, last_read_at) VALUES (?, ?, datetime('now')), (?, ?, NULL)`
).run(threadId, parentUserId, threadId, teacherId);

db.prepare(
  `INSERT INTO messages (thread_id, sender_id, body) VALUES
   (?, ?, 'Здравствуйте! Максим уже сдал домашку — когда будет оценка?'),
   (?, ?, 'Уже проверил — пятёрка. Молодцы!')`
).run(threadId, parentUserId, threadId, teacherId);

// Wave 5: transparent diary
const { ensureSystemCriteria, defaultPeriodKey } = require('./services/diary');
ensureSystemCriteria();
const period = defaultPeriodKey();
const crit = Object.fromEntries(
  db.prepare('SELECT code, id, default_max_score FROM diary_criteria').all().map((c) => [c.code, c])
);

const schemeId = db
  .prepare(
    `INSERT INTO diary_schemes (group_id, name, scale_max, description, created_by)
     VALUES (?, 'Формула Python (прозрачная)', 5,
       'Итог = 35% ДЗ + 25% ответ на уроке + 20% тест + 10% доп.задания + 10% опоздания(инверсия)', ?)`
  )
  .run(groupPyId, teacherId).lastInsertRowid;

const schemeParts = [
  [crit.homework.id, 35, 'avg', 'Домашка'],
  [crit.oral.id, 25, 'avg', 'Ответ на уроке'],
  [crit.quiz.id, 20, 'avg', 'Тесты'],
  [crit.extra.id, 10, 'avg', 'Допы'],
  [crit.late.id, 10, 'avg', 'Опоздания'],
];
const insPart = db.prepare(
  `INSERT INTO diary_scheme_parts (scheme_id, criteria_id, weight, aggregation, label_override, sort_order)
   VALUES (?, ?, ?, ?, ?, ?)`
);
schemeParts.forEach((p, i) => insPart.run(schemeId, p[0], p[1], p[2], p[3], i));

const insEntry = db.prepare(
  `INSERT INTO diary_entries
   (group_id, contact_id, criteria_id, score, max_score, title, detail, comment, period_key, homework_id, created_by)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
insEntry.run(
  groupPyId,
  studentContactId,
  crit.homework.id,
  5,
  5,
  'ДЗ: переменные',
  'Программа с тремя переменными и сложением; код читаемый, без ошибок.',
  'Отлично',
  period,
  hwId,
  teacherId
);
insEntry.run(
  groupPyId,
  studentContactId,
  crit.oral.id,
  4,
  5,
  'Ответ: что такое переменная',
  'Устно объяснил понятие переменной на примере name/age; небольшая путаница с типами.',
  '',
  period,
  null,
  teacherId
);
insEntry.run(
  groupPyId,
  studentContactId,
  crit.quiz.id,
  4,
  5,
  'Мини-тест по вводу-выводу',
  '2 из 3 верных ответов в тесте урока Python (нормализовано к 5).',
  '',
  period,
  null,
  teacherId
);
insEntry.run(
  groupPyId,
  studentContactId,
  crit.late.id,
  1,
  5,
  'Опоздание 08.03',
  'Опоздал на 7 минут на занятие Python (1 штрафной балл из 5).',
  'Предупреждение',
  period,
  null,
  teacherId
);
insEntry.run(
  groupPyId,
  studentContactId,
  crit.extra.id,
  5,
  5,
  'Доп: мини-игра угадай число',
  'Сам сделал доп.задачу с циклом while и условием; показал на уроке.',
  'Молодец',
  period,
  null,
  teacherId
);

const oralEntry = db
  .prepare(
    `SELECT id, score FROM diary_entries WHERE title LIKE 'Ответ:%' AND contact_id = ? LIMIT 1`
  )
  .get(studentContactId);

db.prepare(
  `INSERT INTO diary_raise_requests
   (entry_id, group_id, contact_id, requested_by, current_score, requested_score, reason, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
).run(
  oralEntry.id,
  groupPyId,
  studentContactId,
  studentUserId,
  oralEntry.score,
  5,
  'Прошу повысить устный ответ: после урока повторил типы данных и могу объяснить без ошибок.'
);

db.prepare(
  `INSERT INTO diary_feedback (group_id, contact_id, from_user_id, to_user_id, body, related_entry_id)
   VALUES (?, ?, ?, ?, ?, ?)`
).run(
  groupPyId,
  studentContactId,
  parentUserId,
  teacherId,
  'Спасибо за подробную расшифровку оценок — так понятно, над чем работать.',
  oralEntry.id
);

// Wave 6: trials + portfolio
const trialLead = db
  .prepare(`SELECT id FROM leads WHERE status = 'trial' ORDER BY id DESC LIMIT 1`)
  .get();
if (trialLead) {
  db.prepare(
    `INSERT INTO trial_lessons
     (lead_id, teacher_id, course_id, title, starts_at, ends_at, location, status, created_by)
     VALUES (?, ?, ?, 'Пробный Python', datetime('now', '+2 days'), datetime('now', '+2 days', '+1 hour'),
             'Кабинет 1', 'scheduled', ?)`
  ).run(trialLead.id, teacherId, pythonCourse?.id || null, teacherId);
}

db.prepare(
  `INSERT INTO portfolio_projects
   (user_id, contact_id, course_id, title, description, url, tech_stack, visibility, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'school', 'published')`
).run(
  studentUserId,
  studentContactId,
  pythonCourse?.id || null,
  'Калькулятор на Python',
  'Консольный калькулятор с функциями +, -, *, / и проверкой деления на ноль.',
  'https://github.com/example/python-calc',
  'Python'
);

// Wave 7: documents + flexible lesson blocks
const fs = require('fs');
const path = require('path');
const { ensureUploadsDir, uploadsRoot, uniqueSlug } = require('./services/content');
ensureUploadsDir();
const demoKey = `seed-demo-${Date.now()}.txt`;
fs.writeFileSync(
  path.join(uploadsRoot, demoKey),
  'IT-Scool demo file: договор / ДЗ / презентация (текст).'
);
const demoFileId = db
  .prepare(
    `INSERT INTO files (storage_key, original_name, mime, size, uploaded_by)
     VALUES (?, 'dogovor-demo.txt', 'text/plain', ?, ?)`
  )
  .run(demoKey, fs.statSync(path.join(uploadsRoot, demoKey)).size, teacherId).lastInsertRowid;

db.prepare(
  `INSERT INTO documents (file_id, title, doc_type, contact_id, notes, created_by)
   VALUES (?, 'Договор на обучение (демо)', 'contract', ?, 'Подписан родителем', ?)`
).run(demoFileId, studentContactId, teacherId);

db.prepare(
  `INSERT INTO documents (file_id, title, doc_type, entity_type, entity_id, contact_id, notes, created_by)
   VALUES (?, 'Скрин ДЗ переменные', 'homework', 'homework', ?, ?, 'Приложение к домашке', ?)`
).run(demoFileId, hwId, studentContactId, studentUserId);

if (pythonCourse?.id) {
  db.prepare(`UPDATE courses SET slug = ? WHERE id = ? AND (slug IS NULL OR slug = '')`).run(
    uniqueSlug('python-osnovy', (s) =>
      db.prepare('SELECT 1 FROM courses WHERE slug = ? AND id != ?').get(s, pythonCourse.id)
    ),
    pythonCourse.id
  );

  const sectionId = db
    .prepare(
      `INSERT INTO course_sections (course_id, title, slug, description, sort_order)
       VALUES (?, 'Старт', 'start', 'Вводный модуль', 0)`
    )
    .run(pythonCourse.id).lastInsertRowid;

  const firstLesson = db
    .prepare(`SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order, id LIMIT 1`)
    .get(pythonCourse.id);

  if (firstLesson) {
    db.prepare(
      `UPDATE lessons SET slug = ?, section_id = ?, summary = ? WHERE id = ?`
    ).run('urok-1', sectionId, 'Гибкий урок с блоками конструктора', firstLesson.id);

    const quizCrit = db.prepare(`SELECT id FROM diary_criteria WHERE code = 'quiz'`).get();
    db.prepare(
      `INSERT INTO lesson_blocks
       (lesson_id, type, title, slug, content, config_json, file_id, criteria_id, sort_order)
       VALUES
       (?, 'section', 'Введение', 'intro', 'Цели урока', '{}', NULL, NULL, 0),
       (?, 'markdown', 'Теория', 'theory', ?, '{}', NULL, NULL, 1),
       (?, 'callout', 'Важно', 'note', 'Сохраняй код в отдельный файл.', '{"tone":"warning"}', NULL, NULL, 2),
       (?, 'file', 'Раздатка', 'handout', 'Скачай демо-файл', '{}', ?, NULL, 3),
       (?, 'quiz', 'Мини-тест блока', 'block-quiz', 'Проверь себя', ?, NULL, ?, 4),
       (?, 'grade_info', 'Как считается оценка', 'grades', 'Тест блока может писать балл в дневник по критерию «Тест».', '{}', NULL, ?, 5)`
    ).run(
      firstLesson.id,
      firstLesson.id,
      firstLesson.content || '## Теория\n\nПеременные хранят данные.',
      firstLesson.id,
      firstLesson.id,
      demoFileId,
      firstLesson.id,
      JSON.stringify({
        auto_grade: true,
        max_score: 5,
        complete_lesson: false,
        questions: [
          {
            id: 1,
            question: 'Что такое переменная?',
            options: ['Имя для значения в памяти', 'Ошибка синтаксиса', 'Только число'],
            correct_index: 0,
          },
        ],
      }),
      quizCrit?.id || null,
      firstLesson.id,
      quizCrit?.id || null
    );

    db.prepare(
      `INSERT INTO share_links (token, target_type, target_id, label, created_by)
       VALUES ('demo-lesson-share', 'lesson', ?, 'Демо ссылка на урок', ?)`
    ).run(firstLesson.id, teacherId);
  }
}

// Wave 9: marketing landing
(() => {
  const theme = db.prepare(`SELECT id FROM landing_themes WHERE code = 'violet-school'`).get();
  const pageId = db
    .prepare(
      `INSERT INTO landing_pages (slug, title, status, theme_id, settings_json, published_at, created_by)
       VALUES ('python-leto', 'Лето с Python', 'published', ?, '{}', datetime('now'), ?)`
    )
    .run(theme?.id || null, marketerId).lastInsertRowid;

  const blocks = [
    [
      'hero',
      'Лето с Python',
      'hero',
      'Интенсив для 5–9 класса: игры, проекты и портфолио за 4 недели',
      {
        subtitle: '',
        ctaLabel: 'Записаться на пробный',
        ctaTarget: 'form',
        ctaAnchor: 'zayavka',
      },
      0,
    ],
    [
      'features',
      'Почему мы',
      'preimushchestva',
      '',
      {
        items: [
          { title: 'Геймификация', text: 'Очки, квизы и рейтинг прямо на лендинге' },
          { title: 'Пробный урок', text: 'Откройте фрагмент курса бесплатно' },
          { title: 'Для родителей', text: 'Понятная заявка → CRM школы' },
        ],
      },
      10,
    ],
    [
      'countdown',
      'Акция до конца недели',
      'timer',
      '−20% на первый месяц',
      { until: new Date(Date.now() + 5 * 86400000).toISOString() },
      20,
    ],
    [
      'quiz_game',
      'Мини-квиз: проверь себя',
      'kviz',
      'Наберите очки и попадите в рейтинг',
      {
        questions: [
          {
            id: 'q1',
            text: 'Что делает print()?',
            options: [
              { value: 'a', label: 'Печатает текст' },
              { value: 'b', label: 'Удаляет файл' },
            ],
            correct: 'a',
          },
          {
            id: 'q2',
            text: 'Python — это…',
            options: [
              { value: 'a', label: 'Язык программирования' },
              { value: 'b', label: 'Браузер' },
            ],
            correct: 'a',
          },
        ],
      },
      30,
    ],
    [
      'trial_teaser',
      'Пробный контент',
      'probnyj',
      'Урок 1. Переменные: name = "Максим"; print(name)',
      {
        unlockHint: 'Откройте фрагмент (+20 очков), затем оставьте заявку',
        buttonLabel: 'Открыть фрагмент',
        points: 20,
      },
      40,
    ],
    [
      'pricing',
      'Тарифы акции',
      'tarify',
      '',
      {
        plans: [
          {
            name: 'Пробный',
            price: '0 ₽',
            desc: '1 занятие + диагностика',
            cta: 'Записаться',
            highlight: true,
          },
          { name: 'Лето', price: '9 900 ₽', desc: '8 занятий + проект', cta: 'Хочу лето' },
        ],
      },
      50,
    ],
    [
      'cta_form',
      'Заявка на интенсив',
      'zayavka',
      '',
      {
        interestDefault: 'Python лето',
        gamifyPoints: 50,
        successText: 'Спасибо! Маркетолог и менеджер увидят заявку в CRM.',
        submitLabel: 'Отправить',
      },
      60,
    ],
    [
      'leaderboard',
      'Рейтинг игроков',
      'rating',
      '',
      {},
      70,
    ],
    [
      'faq',
      'Вопросы',
      'faq',
      '',
      {
        items: [
          { q: 'Нужен ли опыт?', a: 'Нет, начинаем с нуля.' },
          { q: 'Онлайн?', a: 'Да, Zoom/аналог + платформа IT-Scool.' },
        ],
      },
      80,
    ],
  ];

  const ins = db.prepare(
    `INSERT INTO landing_blocks (page_id, type, title, slug, content, config_json, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const [type, title, slug, content, config, order] of blocks) {
    ins.run(pageId, type, title, slug, content, JSON.stringify(config), order);
  }

  db.prepare(
    `INSERT INTO landing_events (page_id, event_type, session_id, meta_json)
     VALUES (?, 'view', 'seed-demo', '{}')`
  ).run(pageId);
  db.prepare(
    `INSERT INTO landing_events (page_id, event_type, session_id, meta_json)
     VALUES (?, 'view', 'seed-demo-2', '{}')`
  ).run(pageId);

  const marketer = db.prepare(`SELECT id FROM users WHERE email = 'marketer@itscool.local'`).get();
  db.prepare(
    `INSERT INTO report_boards (title, description, preset_code, layout_json, created_by, shared)
     VALUES (?, ?, 'marketing_funnel', ?, ?, 1)`
  ).run(
    'Демо: маркетинг-воронка',
    'Преднастроенный отчёт из шаблона',
    JSON.stringify({
      widgets: [
        { id: 'w1', type: 'kpi', dataset: 'landing_funnel', title: 'KPI воронки', span: 24 },
        { id: 'w2', type: 'chart', chartType: 'bar', dataset: 'landing_funnel', title: 'Воронка', span: 12 },
        { id: 'w3', type: 'chart', chartType: 'pie', dataset: 'leads_by_source', title: 'Источники', span: 12 },
      ],
    }),
    marketer?.id || null
  );
})();

console.log('База заполнена.');
console.log('Аккаунты (вход):');
console.log('  admin@itscool.local / admin123');
console.log('  teacher@itscool.local / teacher123');
console.log('  student@itscool.local / student123');
console.log('  parent@itscool.local / parent123');
console.log('  methodist@itscool.local / methodist123  (только конструктор курсов)');
console.log('В базе, вход отключён: accountant, hr, analyst, marketer');
console.log(`Курсов: ${courses.length}, admin id=${adminId}`);
console.log('Wave9: лендинги /office/landings · публично /l/python-leto');
console.log('Wave10: аналитика /office/analytics · экспорт HTML/PDF/PPTX');
