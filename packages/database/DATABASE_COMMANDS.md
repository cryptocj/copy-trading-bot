# Database Commands

Quick reference for database operations and checks.

## Check Database

### Check Groups
```bash
psql postgresql://postgres:postgres@localhost:5434/signal_tracker -c "SELECT name, \"telegramId\", status FROM \"Group\";"
```

### Check All Signals
```bash
psql postgresql://postgres:postgres@localhost:5434/signal_tracker -c "SELECT s.id, g.name as group_name, s.symbol, s.direction, s.status, s.timestamp FROM \"Signal\" s JOIN \"Group\" g ON s.\"groupId\" = g.id ORDER BY s.timestamp DESC LIMIT 20;"
```

### Count Records
```bash
# Count groups
psql postgresql://postgres:postgres@localhost:5434/signal_tracker -c "SELECT COUNT(*) FROM \"Group\";"

# Count signals
psql postgresql://postgres:postgres@localhost:5434/signal_tracker -c "SELECT COUNT(*) FROM \"Signal\";"
```

## Interactive psql Session

Connect to database:
```bash
psql postgresql://postgres:postgres@localhost:5434/signal_tracker
```

Useful commands inside psql:
- `\dt` - List all tables
- `\d "Group"` - Describe Group table structure
- `\x` - Toggle expanded display
- `\q` - Quit

## Update Group Chat IDs

After adding bot to new groups, update their Chat IDs:
```bash
psql postgresql://postgres:postgres@localhost:5434/signal_tracker -c "UPDATE \"Group\" SET \"telegramId\" = '-1234567890' WHERE name = 'Group Name';"
```

## Prisma Studio (GUI)

Open visual database browser:
```bash
pnpm --filter @signal-tracker/database db:studio
```

Then visit: http://localhost:5555

## Docker Commands

### Start database
```bash
docker compose up -d
```

### Stop database
```bash
docker compose down
```

### View logs
```bash
docker logs signal_tracker_postgres
```

### Restart database
```bash
docker compose restart
```
