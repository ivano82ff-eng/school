const TOUR_VERSION = 'v1';

function tourStorageKey(userId) {
  return `itscool_onboarding_${TOUR_VERSION}_${userId}`;
}

function isTourDone(userId, storage = globalThis.localStorage) {
  if (!storage || userId == null) return true;
  return storage.getItem(tourStorageKey(userId)) === 'done';
}

function markTourDone(userId, storage = globalThis.localStorage) {
  if (!storage || userId == null) return;
  storage.setItem(tourStorageKey(userId), 'done');
}

function resetTour(userId, storage = globalThis.localStorage) {
  if (!storage || userId == null) return;
  storage.removeItem(tourStorageKey(userId));
}

const COMMON_WELCOME = {
  id: 'welcome',
  selector: '[data-tour="brand"]',
  title: 'Добро пожаловать в IT-Scool!',
  body: 'Короткий гид покажет, где учиться и как пользоваться платформой. Можно пропустить и открыть снова позже.',
  placement: 'bottom',
};

function getTourSteps(role) {
  if (role === 'parent') {
    return [
      COMMON_WELCOME,
      {
        id: 'parent',
        selector: '[data-tour="nav-parent"]',
        title: 'Кабинет родителя',
        body: 'Здесь оплаты, расписание, посещаемость и домашние задания ваших детей.',
        placement: 'bottom',
      },
      {
        id: 'replay',
        selector: '[data-tour="tour-help"]',
        title: 'Подсказки всегда рядом',
        body: 'Кнопка «Гид» снова покажет эти подсказки.',
        placement: 'bottom',
      },
    ];
  }

  if (role === 'teacher' || role === 'admin') {
    return [
      COMMON_WELCOME,
      {
        id: 'courses',
        selector: '[data-tour="nav-courses"]',
        title: 'Каталог курсов',
        body: 'Здесь ученики выбирают программы. Фильтры — по классу и теме.',
        placement: 'bottom',
      },
      {
        id: 'office',
        selector: '[data-tour="nav-office"]',
        title: 'Офис школы',
        body: 'CRM, контакты, группы, оплаты, расписание, ДЗ и отчёты.',
        placement: 'bottom',
      },
      {
        id: 'content',
        selector: '[data-tour="nav-content"]',
        title: 'Контент курсов',
        body: 'Создавайте курсы и уроки с текстом и тестами.',
        placement: 'bottom',
      },
      {
        id: 'replay',
        selector: '[data-tour="tour-help"]',
        title: 'Подсказки всегда рядом',
        body: 'Если забудете — нажмите «Гид», и тур запустится снова.',
        placement: 'bottom',
      },
    ];
  }

  return [
    COMMON_WELCOME,
    {
      id: 'courses',
      selector: '[data-tour="nav-courses"]',
      title: 'Выбери курс',
      body: 'Открой каталог, найди курс по своему классу и запишись.',
      placement: 'bottom',
    },
    {
      id: 'dashboard',
      selector: '[data-tour="nav-dashboard"]',
      title: 'Моё обучение',
      body: 'Здесь прогресс по курсам, на которые ты записан.',
      placement: 'bottom',
    },
    {
      id: 'replay',
      selector: '[data-tour="tour-help"]',
      title: 'Нужна помощь?',
      body: 'Кнопка «Гид» снова покажет эти подсказки.',
      placement: 'bottom',
    },
  ];
}

module.exports = {
  TOUR_VERSION,
  tourStorageKey,
  isTourDone,
  markTourDone,
  resetTour,
  getTourSteps,
};
