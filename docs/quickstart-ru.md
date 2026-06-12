# 🚀 Быстрый старт (для новичков)

> Время: ~5 минут. Никаких специальных знаний не нужно.

## Шаг 1. Создать сервисный аккаунт Google

1. Открой [Google Cloud Console](https://console.cloud.google.com/)
2. Создай проект — кнопка в верхней панели, название любое
3. В левом меню: **APIs & Services** → **Library**
4. Найди **Google Sheets API** → нажми **Enable**
5. В левом меню: **Credentials** → **Create Credentials** → **Service Account**
6. Назови, например, `mcp-bot` → **Create** → **Done**
7. Нажми на созданный аккаунт → вкладка **Keys** → **Add Key** → **Create New Key** → **JSON**
8. Скачается файл `*.json` — сохрани, не теряй
9. Открой свою Google Таблицу → **Share** → вставь email из JSON (поле `client_email`) → дай права **Редактор**

> 📺 Нужен видео-гайд? Поищи на YouTube: [«Google Service Account create JSON key»](https://www.youtube.com/results?search_query=google+service+account+create+json+key)

## Шаг 2. Открыть терминал

| Система | Как открыть |
|---------|-------------|
| **Mac** | `Cmd + Пробел` → введи «Terminal» → `Enter` |
| **Windows** | `Win + R` → введи `cmd` → `Enter` |
| **Linux** | `Ctrl + Alt + T` |

## Шаг 3. Установить и настроить

В терминале одна команда:

```bash
npx google-sheet-mcp init
```

Мастер задаст два вопроса:

| Вопрос | Что ввести |
|--------|-----------|
| **Google Sheet URL** | Ссылку на таблицу — скопируй из адресной строки браузера |
| **Path to credentials JSON** | Путь к скачанному JSON-файлу — перетащи файл в окно терминала |

Готово! Настройки сохранятся в файл `.google-sheet-mcp.json`.

## Шаг 4. Подключить к IDE

Создай файл в папке своего проекта:

**Cursor** → файл `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "npx",
      "args": ["google-sheet-mcp"]
    }
  }
}
```

**VS Code / Copilot** → файл `.vscode/mcp.json`:

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

## Шаг 5. Перезапустить IDE

Закрой и открой редактор. Готово! 🎉

## Как проверить

Напиши AI-агенту в чате:

- «Прочитай все строки из листа Отчёты»
- «Добавь новую строку: имя=Иван, сумма=500»
- «Какие листы есть в моей таблице?»

## Если что-то пошло не так

1. Проверь, что Google Sheets API включён — [APIs & Services](https://console.cloud.google.com/apis/dashboard)
2. Проверь, что таблица расшарена на email сервисного аккаунта с правами **Редактор**
3. Выполни проверку: `npx google-sheet-mcp test`
