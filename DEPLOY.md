# Перенос IT-Scool на хост (собрал локально → скопировал → запустил)

Именно так платформа и задумана: **один процесс Node** отдаёт и сайт, и API. На сервере не нужно собирать React заново, если вы уже сделали билд дома.

## Что нужно на хосте

- **Node.js 22.5+** (обязательно; без Node папка с файлами «сама» не заработает)
- Возможность запустить команду `node server/index.js` (VPS, облако, Beget **VPS**, любой Linux с Node)

Обычный shared-хостинг, где есть только `public_html` и PHP **без** запуска Node — для этого проекта не подходит. Нужен хост, где можно держать процесс Node (или pm2).

---

## Шаг 1. Собрать у себя (Windows / локалка)

В корне проекта:

```bash
npm run setup
```

Это: зависимости + демо-база (`data/itscool.db`) + сборка фронта в `client/dist`.

Либо по шагам:

```bash
npm run install:all
npm run seed
npm run build
```

Проверка локально:

```bash
npm start
```

Открыть http://localhost:3000 — всё должно работать.

---

## Шаг 2. Упаковать релиз для переноса

```bash
npm run pack
```

Появится папка **`release/it-scool/`** — только то, что нужно на сервере:

- `server/`
- `client/dist/` (готовый фронт)
- `data/` (база и uploads, если были)
- `package.json`, `package-lock.json`
- `README.md`

**Не копируйте** с Windows папку `node_modules` на Linux — модули ставятся на сервере одной командой.

Можно заархивировать `release/it-scool` в zip и залить по SFTP/FTP в любое место на VPS (например `/home/you/it-scool` или `/var/www/it-scool`).

---

## Шаг 3. На сервере

```bash
cd /путь/к/it-scool
npm install --omit=dev
```

Запуск:

```bash
# Windows-сервер / простой тест:
set JWT_SECRET=длинная-случайная-строка
set PORT=3000
npm start

# Linux:
export JWT_SECRET=длинная-случайная-строка
export PORT=3000
npm start
```

Сайт: `http://IP:3000` (или домен через Nginx — см. ниже).

### Чтобы работало постоянно (Linux)

```bash
npm install -g pm2
pm2 start server/index.js --name it-scool
pm2 save
pm2 startup
```

### Домен на 80/443 (Nginx)

```nginx
server {
  listen 80;
  server_name your-domain.ru;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

---

## Обновление позже

1. Дома снова `npm run build` (и seed только если хотите сбросить демо-данные).
2. `npm run pack`
3. На сервер скопировать новые `client/dist` и при необходимости `server/`
4. `pm2 restart it-scool`  
   Базу `data/itscool.db` **не затирайте**, если там уже боевые данные.

---

## Beget

| Тариф | Как жить с «собрал → перенёс» |
|--------|-------------------------------|
| **VPS Beget** | Да: залили `release/it-scool`, `npm install --omit=dev`, `npm start` / pm2 |
| **Обычный shared + только public_html** | Нет: там не крутится ваш `npm start` |

Если остаётесь на shared Beget с Passenger — это уже другая схема (см. старые гайды Beget по Node). Для вашей задачи «перенёс файлы и запустил» берите **VPS**.

---

## Частые ошибки

- На сервере Node старше/младше требования → поставьте **22.5+**
- Скопировали Windows-`node_modules` на Linux → удалите и сделайте `npm install --omit=dev` на сервере
- Нет папки `client/dist` → дома не сделали `npm run build` / `npm run setup`
- Нет прав на запись в `data/` → SQLite не сможет писать БД
