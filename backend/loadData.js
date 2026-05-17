require('dotenv').config();
const { ensureData, stores, DATA_CSV_PATH } = require('./db');

async function main() {
  await ensureData();
  console.log(`Loaded ${stores.length} store rows from ${DATA_CSV_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
