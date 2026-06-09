---
id: AREA-NN            # напр. SC-05, AG-07, FE-02
title: Короткое название задачи
status: todo           # todo → ready → in_review → approved → done | changes_requested | blocked
owner: planner         # кто сейчас отвечает: planner | coder | reviewer | human
area: SC               # SC | AG | FE | BE | INFRA | CHAIN | AI
priority: P1           # P0 (критпуть демо) | P1 | P2
branch:                # feat/<id>-<slug> — заполняет coder
pr:                    # ссылка на PR — заполняет coder
depends_on: []         # список id-тасков
created: YYYY-MM-DD
---

# AREA-NN — <Название>

## Контекст
Зачем эта задача, как связана с критическим путём демо. 2–4 строки.

## Acceptance criteria
- [ ] Конкретный проверяемый критерий 1
- [ ] Конкретный проверяемый критерий 2
- [ ] Тесты на критичную логику присутствуют и проходят

## Scope
**В scope:**
- что именно делаем

**НЕ в scope (явно):**
- что НЕ трогаем в этой задаче (выносится в отдельный таск)

## Затронутые файлы (план)
- `path/to/file.ts` — что меняем
- ...

## Зависимости / блокеры
- depends_on: ...
- внешние (ключи, аккаунты, H-таски человека): ...

## Notes / лог
- (planning) ...
- (coding) ветка, ключевые решения
- (review) вердикт и замечания
