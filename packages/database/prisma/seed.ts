import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test signal groups
  const eveningTrader = await prisma.group.upsert({
    where: { telegramId: 'evening_trader_test' },
    update: {},
    create: {
      name: 'Evening Trader',
      telegramId: 'evening_trader_test',
      description: 'Best free crypto signal group with 92-95% win rate',
      status: 'TESTING',
      subscriberCount: 50000,
      isVerified: true,
      isPremium: false,
    },
  });

  const wolfOfTrading = await prisma.group.upsert({
    where: { telegramId: 'wolf_of_trading_test' },
    update: {},
    create: {
      name: 'Wolf of Trading',
      telegramId: 'wolf_of_trading_test',
      description: '200K+ subscribers, accurate and timely signals',
      status: 'TESTING',
      subscriberCount: 200000,
      isVerified: true,
      isPremium: false,
    },
  });

  const binanceKillers = await prisma.group.upsert({
    where: { telegramId: 'binance_killers_test' },
    update: {},
    create: {
      name: 'Binance Killers',
      telegramId: 'binance_killers_test',
      description: '250K+ subscribers, Binance-focused signals',
      status: 'TESTING',
      subscriberCount: 250000,
      isVerified: true,
      isPremium: false,
    },
  });

  console.log('✅ Seeded groups:', {
    eveningTrader,
    wolfOfTrading,
    binanceKillers,
  });
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
