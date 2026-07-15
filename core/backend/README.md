# DayOrder Backend

## Run

```powershell
cd backend
uvicorn app.main:app --reload
```

The API starts at `http://127.0.0.1:8000`.

The Web app is served by the same backend:

```text
http://127.0.0.1:8000/
```

## Initial Admin

```powershell
cd backend
python -m app.cli create-admin --email admin@example.com --password "change-me-now"
```

## Profile and Bazi

Registration requires profile fields:

- `nickname`
- `gender`
- `birth_date`
- `birth_time`
- `birth_timezone`
- `birth_place`

The backend calculates bazi with `lunar_python` and stores the structured result in `user_profiles.bazi_result_json`.

Useful endpoints:

```text
GET   /api/users/me/profile
PATCH /api/users/me/profile
POST  /api/users/me/recalculate-bazi
```

## Tags, Records, and Journals

Useful endpoints:

```text
GET    /api/tags
POST   /api/tags
PATCH  /api/tags/{tag_id}
DELETE /api/tags/{tag_id}

GET    /api/record-types
POST   /api/record-types
PATCH  /api/record-types/{record_type_id}
DELETE /api/record-types/{record_type_id}

GET    /api/records
POST   /api/records
GET    /api/records/{record_id}
PATCH  /api/records/{record_id}
DELETE /api/records/{record_id}

GET    /api/journals
POST   /api/journals
GET    /api/journals/{journal_id}
PATCH  /api/journals/{journal_id}
DELETE /api/journals/{journal_id}
GET    /api/journals/{journal_id}/versions
GET    /api/journals/{journal_id}/versions/{version_id}
```

Record type field definitions are passed as `schema` in the API and stored as JSON. Journal saves create timeline snapshots in `journal_entry_versions`.

## Reminders

Useful endpoints:

```text
GET    /api/daily-task-templates
POST   /api/daily-task-templates
PATCH  /api/daily-task-templates/{template_id}
DELETE /api/daily-task-templates/{template_id}

GET    /api/daily-tasks?date=2026-05-15
PATCH  /api/daily-tasks/{template_id}/{task_date}

GET    /api/range-reminders
POST   /api/range-reminders
GET    /api/range-reminders/{reminder_id}
PATCH  /api/range-reminders/{reminder_id}
DELETE /api/range-reminders/{reminder_id}

GET    /api/milestone-days
POST   /api/milestone-days
GET    /api/milestone-days/{milestone_id}
PATCH  /api/milestone-days/{milestone_id}
DELETE /api/milestone-days/{milestone_id}
```

Daily tasks are generated from templates when a date is requested; only completion state and notes are stored per day. Milestone days support yearly dates and one-time countdown dates.

## Calendar Aggregation

Useful endpoints:

```text
GET /api/calendar/month?year=2026&month=5
GET /api/calendar/day/2026-05-15
```

Both endpoints support filters such as `types`, `record_type_id`, `reminder_type`, `tag_id`, and `completion_status`. The month endpoint returns day-level counts and tag markers; the day endpoint returns the full records, journals, daily tasks, range reminders, and milestone days for that date.

## Migrations

```powershell
cd backend
alembic revision --autogenerate -m "initial auth schema"
alembic upgrade head
```

The app also creates tables on startup for local development, but Alembic is the intended migration system.
