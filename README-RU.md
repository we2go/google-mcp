Optimized tool selectionВот короткая инструкция для новичка. Можно разместить в README.md или в `docs/quickstart-ru.md`.

---

## 🚀 Быстрый старт (для новичков)

### Шаг 1. Создать сервисный аккаунт Google (3 минуты)

1. Открой [Google Cloud Console](https://console.cloud.google.com/)
2. Создай проект (кнопка вверху) → назови как угодно
3. В левом меню: **APIs & Services** → **Library** → найди «Google Sheets API» → **Enable**
4. В левом меню: **Credentials** → **Create Credentials** → **Service Account**
5. Назови, например, `mcp-bot` → **Create** → **Done**
6. Нажми на созданный аккаунт → вкладка **Keys** → **Add Key** → **Create New Key** → **JSON** → скачается файл
7. Открой свою Google Таблицу → **Share** → вставь email из скачанного JSON (поле `client_email`) → дай права **Редактор**

📺 Видео: [How to create a Google Service Account](https://www.youtube.com/results?search_query=google+service+account+create+json+key)

### Шаг 2. Открой терминал

- **Mac:** `Cmd+Пробел` → «Terminal»
- **Windows:** `Win+R` → `cmd`

### Шаг 3. Установи и настрой

В терминале одна команда:

```bash
npx google-sheet-mcp init
```

Она спросит:
- **Ссылку на Google Таблицу** — скопируй из адресной строки браузера
- **Путь к JSON-ключу** — перетащи скачанный файл в терминал

### Шаг 4. Подключи к IDE

Создай файл в папке проекта:

**Cursor** — `.cursor/mcp.json`
**VS Code** — mcp.json

```json
{
  "servers": {
    "google-sheets": {
      "type": "stdio",
      "command": "npx",
      "args": ["google-sheet-mcp"]
    }
  }
}
```

### Шаг 5. Перезапусти IDE

Готово. Можешь написать агенту: «Прочитай мою таблицу» или «Добавь строку в лист Отчёты».

---

Хочешь, чтобы я добавил это в репозиторий как `docs/quickstart-ru.md` или в README.md?