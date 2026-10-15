# General English · Intermediate

Интерактивная рабочая тетрадь для индивидуальных занятий по общему английскому (уровень Intermediate).
Сайт на GitHub Pages, данные студентов и ключи — в Firebase. Оформление в цветах и с символикой канала
«Чердак» (t.me/engattic), устройство страниц — как в курсе English for Administrators.
Устройство и логика безопасности — в [ARCHITECTURE.md](ARCHITECTURE.md).

## Структура

- `docs/` — публичный сайт: `index.html` (тетрадь студента), `teacher.html` (Teacher's Edition),
  `css/course.css` (стили), `css/fonts.css` и `fonts/` (шрифты Onest, Literata, JetBrains Mono с лицензиями OFL),
  `img/` (логотип «Чердака»), `js/` (код), `data/vocab-levels.json` (уровни слов), `media/u1/` (картинки и аудио юнита).
- `content-private/` — содержание курса с ключами (`course.json`) и сценарии аудио. В репозиторий не попадает
  (строка в `.gitignore`, не удалять).
- `firestore.rules` — правила базы данных (вставляются в консоль Firebase).
- `tests/` — автоматические тесты.

## Настройка Firebase (один раз, около 30 минут)

### Шаг 1. Новый проект
1. Открыть https://console.firebase.google.com и нажать **Create a new Firebase project**.
   Название, например, `english-intermediate`. Google Analytics можно выключить. Тариф Spark (бесплатный).
2. На главной странице проекта нажать значок **`</>`** (Web). Название приложения любое,
   галочку Firebase Hosting **не** ставить. Нажать **Register app**.
3. Скопировать весь фрагмент с `const firebaseConfig = { … }` и прислать Claude
   (или вставить вместо заглушки в `docs/js/firebase-config.js`, строки `apiKey`… `appId`).

### Шаг 2. Вход по почте и паролю
1. Слева **Build**, затем **Authentication**, кнопка **Get started**.
2. Вкладка **Sign-in method**, строка **Email/Password**: включить **только первый** переключатель, **Save**.
3. По желанию: вкладка **Templates**, значок карандаша внизу, язык *Russian* (письма о сбросе пароля будут на русском).

### Шаг 3. База данных
1. **Build**, затем **Firestore Database**, **Create database**.
2. Edition: **Standard**. Регион: `europe-west3 (Frankfurt)`. Режим: **Start in production mode**. **Create**.
3. Вкладка **Rules**: в VS Code открыть `firestore.rules`, Cmd+A, Cmd+C; в консоли выделить всё, Cmd+V, **Publish**.
   Первая строка `rules_version = '2';` — это версия синтаксиса, а не номер наших правил.

### Шаг 4. Аккаунт преподавателя
1. **Authentication**, вкладка **Users**, **Add user**: своя почта и пароль. Скопировать **User UID**.
2. **Firestore Database**, вкладка **Data**, **+ Start collection**. Collection ID: `teachers`, **Next**.
3. Document ID: вставить UID. Поле: `name`, тип `string`, значение — своё имя. **Save**.

### Шаг 5. Публикация на GitHub (VS Code)
1. Открыть папку курса в VS Code (File, Open Folder), слева **Source Control**, кнопка **Initialize Repository**.
2. Ввести сообщение (например, `Start`), **Commit**, затем **Publish Branch**, выбрать **public repository**,
   имя `English-Intermediate`.
3. Перед публикацией проверить, что в списке файлов **нет** `content-private`.

### Шаг 6. GitHub Pages
1. На GitHub в репозитории: **Settings**, слева **Pages**.
2. Source: **Deploy from a branch**, Branch: `main`, папка `/docs`, **Save**.
3. Через 2–3 минуты сайт будет по адресу `https://oletol.github.io/English-Intermediate/`.

### Шаг 7. Разрешить вход с сайта
**Authentication**, вкладка **Settings**, **Authorized domains**, **Add domain**: `oletol.github.io`.

### Шаг 8. Первый запуск
1. Открыть `…/English-Intermediate/teacher.html`, войти.
2. **Groups & students**: создать группу. Для индивидуальных занятий удобно завести отдельную группу
   на каждого студента (например, `Anna`), тогда юниты и результаты открываются каждому отдельно.
   Код группы сообщить студенту — он вводит его при регистрации.
3. **Course content**: **Import**, выбрать `content-private/course.json`.
4. **Access & results**: открыть Unit 1 для группы.

## Как обновлять

- Изменился код или файлы в `docs/`: Source Control, сообщение, **Commit**, **Sync Changes**.
- Изменился `content-private/course.json`: подождать 2–3 минуты после Sync, в Teacher's Edition Cmd+Shift+R,
  **Course content**, выбрать `content-private/course.json`, **Import**.
- Изменился `firestore.rules`: вставить в Firebase, вкладка Rules, **Publish**.
- Студентам: Cmd+Shift+R, чтобы увидеть новое.

## Лимиты бесплатного тарифа

Firestore: 50 000 чтений и 20 000 записей в день, 1 ГБ. Юнит — до 1 МБ текста (картинки лежат отдельно в `docs/media`).
Файлы на GitHub Pages публичны: до 100 МБ на файл, до 1 ГБ на сайт.

## Локальный запуск и тесты

`python3 -m http.server 5055 -d docs`, затем `node tests/ui.e2e.mjs` (Playwright, Firebase подменяется заглушкой).
Тесты правил запускаются на GitHub Actions.

## Лицензии

Шрифты Onest, Literata, JetBrains Mono — SIL Open Font License 1.1 (тексты лицензий в `docs/fonts/<шрифт>/LICENSE`).
