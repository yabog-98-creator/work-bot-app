# V28 Premium Business Dashboard

Что добавлено:
- роли через Google Sheets: лист `roles`
- роли: owner / admin / employee
- owner получает доступ к бизнес-панели и админке
- сотрудникам напоминание о смене на завтра в 18:00
- собственникам и админам сводка на завтра в 20:00
- контроль неподтверждённых смен в 21:00
- API /api/owner/{telegram_id}
- Mini App: премиальная бизнес-панель

Лист roles:
telegram_id | name | role

Пример:
5689888528 | Влад | owner
123456789 | Иван | admin
987654321 | Анна | employee
