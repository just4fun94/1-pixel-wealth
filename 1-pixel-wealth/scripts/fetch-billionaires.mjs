import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputPath = resolve(__dirname, "../data/billionaires.json");

const FORBES_ENDPOINT =
  "https://www.forbes.com/forbesapi/person/rtb/0/position/true.json?limit=200";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3_000;

function toUsd(finalWorthMillions) {
  return Math.round(Number(finalWorthMillions || 0) * 1_000_000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`Forbes request failed: ${response.status} ${response.statusText}`);
      }
      return response;
    } catch (err) {
      if (attempt < retries) {
        const wait = RETRY_DELAY_MS * (attempt + 1);
        process.stderr.write(`Attempt ${attempt + 1} failed (${err.message}), retrying in ${wait}ms…\n`);
        await delay(wait);
      } else {
        throw err;
      }
    }
  }
}

async function fetchTop200() {
  const response = await fetchWithRetry(FORBES_ENDPOINT, {
    headers: {
      "User-Agent": "1-pixel-wealth-global/1.0",
      Accept: "application/json",
    },
  });

  const payload = await response.json();

  if (
    !payload ||
    typeof payload !== "object" ||
    !payload.personList ||
    !Array.isArray(payload.personList.personsLists)
  ) {
    throw new Error(
      "Unexpected Forbes response structure: missing personList.personsLists array"
    );
  }

  const list = payload.personList.personsLists;

  if (list.length === 0) {
    throw new Error("Forbes response did not include a ranked person list");
  }

  const people = list
    .slice(0, 200)
    .map((item) => ({
      rank: Number(item.position || item.rank || 0),
      name: item.personName || item.person?.name || "Unknown",
      wealthUsd: toUsd(item.finalWorth),
      country: item.countryOfCitizenship || null,
      source: item.source || null,
      profileUrl: item.uri ? `https://www.forbes.com/profile/${item.uri}/` : null,
    }))
    .sort((a, b) => a.rank - b.rank);

  const totalWealthUsd = people.reduce((sum, p) => sum + p.wealthUsd, 0);

  return {
    source: "Forbes Real-Time Billionaires",
    sourceUrl: "https://www.forbes.com/real-time-billionaires/",
    fetchedAt: new Date().toISOString(),
    count: people.length,
    totalWealthUsd,
    people,
  };
}

async function main() {
  const data = await fetchTop200();
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Updated ${outputPath} with ${data.count} people and ${data.totalWealthUsd} USD total wealth.\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
