// ═══════════════════════════════════════════════════════════════════
// Tesla Intelligence Hub — Cloudflare Worker v3.5 (v3.4 기반: /edgar 단독 분기 수정, /stock 날짜·주식수 수정, /robotaxi 시각 의미 정정, /trigger-robotaxi 인증)
// 패치 일자: 2026-07-22
// ─────────────────────────────────────────────────────────────────
// v3.3.1 → v3.4 수정:
//   · 뉴스 수집 파이프라인을 Worker 내장 Anthropic API 호출 방식에서
//     외부 헤드리스 클라우드 루틴(Claude 구독, Sonnet) 방식으로 전환
//   · 이유: Worker의 ANTHROPIC_API_KEY 계정 크레딧 소진 (news:lastError로 확인됨),
//     크레딧 충전 대신 구독 기반 클라우드 루틴이 RSS 수집·번역·분류를 전담
//   · 삭제: RSS_SOURCES, parseRSS(), processWithClaude(), collectAndStoreNews()
//     (더 이상 Worker가 RSS를 직접 수집하지 않음 — 클라우드 루틴이 담당)
//   · 삭제: scheduled()의 news Cron 분기 (0 0 * * *, 0 7 * * *)
//     → Cloudflare 대시보드 Triggers 탭에서 이 2개 Cron Trigger도 삭제할 것
//   · 신규: POST /news/ingest — 클라우드 루틴이 처리한 결과를 받아 저장
//     Authorization: Bearer <NEWS_INGEST_TOKEN> 헤더로 인증 (신규 Secret)
//     GET /news 응답 스키마는 기존과 100% 동일 → App.jsx 변경 불필요
// ─────────────────────────────────────────────────────────────────
// v3.3 → v3.3.1 수정:
//   · txDmvRegistered를 HTML 정규식 → /data/texas-dmv-summary.json 직접 fetch
//   · 초기 HTML엔 숫자 없음(JS 지연 로드) → null 나오던 문제 해결
//   · fetchTxDmvFleetCount(): providers.tesla.fleet_count (검증값 175)
//   · JSON 파싱이라 정규식보다 안정적, 실패해도 전체 수집 계속
// ─────────────────────────────────────────────────────────────────
// v3.2 → v3.3 수정:
//   · 로보택시 파서 전면 교체 (클로드 온 크롬 실측 검증)
//   · 기존: 범용 정규식 → Rider 오추출(10), 7D 누락
//   · 신규: 색상 클래스 앵커 방식 (emerald/gray-300/font-mono)
//   · 검증: 5개 지표 라이브 DOM 100% 일치
// ─────────────────────────────────────────────────────────────────
// v3.1 → v3.2 신규 추가:
//   ④ Robotaxi Tracker 데이터 자동 수집
//      · 소스: robotaxitracker.com (Ethan McKanna, @ethanmckanna)
//      · 방식: HTML 스크래핑 (다중 정규식, 견고성 확보)
//      · Cron: 매일 KST 08:00 (0 23 * * *) - Austin 지역만
//      · KV: robotaxi:latest / robotaxi:history:{date} / robotaxi:index / robotaxi:lastError
//      · UA: 연락처 포함 정중한 헤더
// ─────────────────────────────────────────────────────────────────
// 엔드포인트:
//   POST /                → Anthropic API 프록시
//   GET  /stock            → Yahoo Finance 주가 조회
//   GET  /edgar             → SEC EDGAR 분기 실적 조회
//   POST /count             → 방문자 카운터 (KV)
//   GET  /news               → 뉴스 조회 (KV 캐시)
//   POST /news/ingest        → 🆕 헤드리스 클라우드 루틴이 처리한 뉴스 수신 (토큰 인증)
//   GET  /robotaxi           → 로보택시 플릿 데이터 조회
//   GET  /trigger-robotaxi   → 로보택시 강제 트리거 (진단용)
//   GET  /health              → 헬스체크
// Cron:
//   0 22 * * *  → 주가 자동 갱신 (KST 07:00)
//   0 23 * * *  → 로보택시 데이터 수집 (KST 08:00)
//   (뉴스 Cron 삭제됨 — 클라우드 루틴이 KST 09:00/16:00에 직접 /news/ingest 호출)
// ═══════════════════════════════════════════════════════════════════

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ════════════════════════════════════════════════════════
// ① 뉴스 수집 — 헤드리스 클라우드 루틴(Claude 구독, Sonnet)이
//    RSS 수집·번역·분류를 전담하고, 처리된 결과만 이 엔드포인트로 POST함.
//    Worker는 저장·병합·중복제거만 담당 (Anthropic API 호출 없음).
// ════════════════════════════════════════════════════════

const NEWS_CATEGORIES = ["FSD", "로보택시", "실적", "Optimus", "에너지", "규제", "머스크발언", "주가", "기타"];

async function handleNewsIngest(request, env) {
  const auth  = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!env.NEWS_INGEST_TOKEN || token !== env.NEWS_INGEST_TOKEN) {
    return json({ error: "unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "invalid JSON body" }, 400);
  }

  const items = Array.isArray(body) ? body : body?.articles;
  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: "articles 배열이 비어있음" }, 400);
  }

  const today = new Date().toISOString().split("T")[0];
  const now   = new Date().toISOString();

  const newItems = items
    .filter((p) => p && typeof p.titleKo === "string" && p.titleKo.length > 2 && p.titleEn)
    .slice(0, 50)
    .map((p, i) => ({
      id:          `news_${today}_${Date.now()}_${i}`,
      collectedAt: now,
      date:        today,
      source:      p.source    || "Unknown",
      sourceUrl:   p.sourceUrl || "",
      titleEn:     p.titleEn,
      titleKo:     p.titleKo,
      summaryKo:   p.summaryKo || "",
      category:    NEWS_CATEGORIES.includes(p.category) ? p.category : "기타",
      impact:      Number.isInteger(p.impact) && p.impact >= 1 && p.impact <= 5 ? p.impact : 3,
      sentiment:   ["bullish", "bearish", "neutral"].includes(p.sentiment) ? p.sentiment : "neutral",
    }));

  if (newItems.length === 0) {
    return json({ error: "유효한 기사 없음 (titleKo/titleEn 필수)" }, 400);
  }

  // 기존 오늘 뉴스 읽기 + 병합 (중복 제거, titleEn 기준)
  const existing    = (await env.VISITORS_KV.get(`news:${today}`, "json")) || [];
  const existTitles = new Set(existing.map((n) => n.titleEn));
  const deduped     = newItems.filter((n) => !existTitles.has(n.titleEn));
  const merged      = [...deduped, ...existing]
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 15);

  await env.VISITORS_KV.put(`news:${today}`, JSON.stringify(merged), {
    expirationTtl: 2592000, // 30일
  });

  const idx = (await env.VISITORS_KV.get("news:index", "json")) || [];
  if (!idx.includes(today)) {
    const newIdx = [today, ...idx].slice(0, 30);
    await env.VISITORS_KV.put("news:index", JSON.stringify(newIdx), {
      expirationTtl: 2592000,
    });
  }

  // 성공 시 이전 lastError 클리어
  await env.VISITORS_KV.delete("news:lastError").catch(() => {});

  console.log(`뉴스 ingest 완료: ${today} — 신규 ${deduped.length}건 / 총 ${merged.length}건`);
  return json({ status: "success", date: today, added: deduped.length, total: merged.length });
}

async function handleNews(request, env) {
  const url      = new URL(request.url);
  const days     = Math.min(parseInt(url.searchParams.get("days") || "7"), 30);
  const category = url.searchParams.get("category") || "all";

  const dateIndex = (await env.VISITORS_KV.get("news:index", "json")) || [];
  const dates     = dateIndex.slice(0, days);

  const allNews = [];
  for (const date of dates) {
    const dayNews = (await env.VISITORS_KV.get(`news:${date}`, "json")) || [];
    allNews.push(...dayNews.map((n) => ({ ...n, date })));
  }

  const filtered = category === "all"
    ? allNews
    : allNews.filter((n) => n.category === category);

  const breaking = filtered.filter((n) => n.impact === 5).slice(0, 3);

  const lastError = await env.VISITORS_KV.get("news:lastError", "json");

  return new Response(
    JSON.stringify({
      news:      filtered,
      breaking,
      dates,
      total:     filtered.length,
      updatedAt: new Date().toISOString(),
      ...(lastError && { lastError }),
    }),
    {
      headers: {
        "Content-Type":                "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":               "public, max-age=300",
      },
    }
  );
}

// ════════════════════════════════════════════════════════
// ④ Robotaxi Tracker 데이터 수집 (기존 — 변경 없음)
//    출처: robotaxitracker.com by Ethan McKanna (@ethanmckanna)
//    스크래핑 예의: 하루 1회, 정중한 User-Agent, 연락처 명시
// ════════════════════════════════════════════════════════

const ROBOTAXI_URL = "https://robotaxitracker.com/?provider=tesla&area=austin";
const ROBOTAXI_UA  = "TeslaHub/3.2 (daybridge2025@gmail.com; personal dashboard use)";

// 색상 클래스 앵커 기반 파서 (2026-07-05 클로드 온 크롬 실측 검증 완료)
// 사이트 구조: 각 KPI가 고유 Tailwind 색상 클래스로 감싸여 SSR HTML에 인라인됨
// 검증: Rider 34 / Unsup 17 / Inactive 71 / Cybercabs 42 / 7D 60.0%(3 of 5) 라이브 DOM 100% 일치
function parseRobotaxiHtml(html) {
  const out = {
    riderVehicles:   null,
    unsupervised:    null,
    inactive:        null,
    cybercabs:       null,
    unsupRate7D:     null,
    unsupRatio7D:    null,
  };

  // 1) Rider Vehicles: 라벨 뒤 1500자 내 첫 >숫자< (툴팁 SVG 건너뜀)
  const rIdx = html.indexOf("Rider Vehicles");
  if (rIdx >= 0) {
    const m = html.slice(rIdx, rIdx + 1500).match(/>\s*(\d+)\s*</);
    if (m) out.riderVehicles = parseInt(m[1]);
  }

  // 2) Unsupervised: emerald 색상 클래스 앵커
  let m = html.match(/Unsupervised<\/span>[\s\S]{0,150}?text-emerald-300\/90[^>]*>(\d+)</);
  if (m) out.unsupervised = parseInt(m[1]);

  // 3) Inactive: gray-300 색상 클래스 앵커
  m = html.match(/>Inactive<\/span>[\s\S]{0,150}?text-gray-300[^>]*>(\d+)</);
  if (m) out.inactive = parseInt(m[1]);

  // 4) Cybercabs: 라벨 뒤 font-mono 첫 숫자
  const cIdx = html.search(/>Cybercabs<\/span>/i);
  if (cIdx >= 0) {
    const mm = html.slice(cIdx, cIdx + 250).match(/font-mono[^>]*>(\d+)</);
    if (mm) out.cybercabs = parseInt(mm[1]);
  }

  // 5) 7D rate + ratio: "Last 7 days" 뒤 1600자 (SVG 툴팁 뒤에 값 위치)
  const l7 = html.indexOf("Last 7 days");
  if (l7 >= 0) {
    const seg   = html.slice(l7, l7 + 1600);
    const rate  = seg.match(/(\d+(?:\.\d+)?)\s*%/);
    const ratio = seg.match(/(\d+)\s+of\s+(\d+)\s+rides/);
    if (rate)  out.unsupRate7D  = parseFloat(rate[1]);
    if (ratio) out.unsupRatio7D = { num: parseInt(ratio[1]), den: parseInt(ratio[2]) };
  }

  // 참고: txDmvRegistered는 초기 HTML에 없고 /data/texas-dmv-summary.json에서 별도 로드됨
  //       → collectRobotaxiData에서 fetchTxDmvFleetCount()로 처리

  return out;
}

// TxDMV 등록 대수는 별도 JSON 파일에서 (JSON 파싱 = 정규식보다 안정적)
// 검증: providers.tesla.fleet_count = 175 (2026-07-06 실측)
async function fetchTxDmvFleetCount() {
  try {
    const r = await fetch("https://robotaxitracker.com/data/texas-dmv-summary.json", {
      headers: { "User-Agent": ROBOTAXI_UA, "Accept": "application/json" },
      cf: { cacheTtl: 3600 },
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.providers?.tesla?.fleet_count ?? null;
  } catch (e) {
    console.error("TxDMV JSON 실패:", e.message);
    return null; // TxDMV는 보조 지표 - 실패해도 전체 수집은 계속
  }
}

async function collectRobotaxiData(env) {
  const today = new Date().toISOString().split("T")[0];

  // 1. HTML fetch (정중한 헤더)
  const res = await fetch(ROBOTAXI_URL, {
    headers: {
      "User-Agent": ROBOTAXI_UA,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
    },
    cf: { cacheTtl: 60 },
  });

  if (!res.ok) {
    throw new Error(`robotaxitracker HTTP ${res.status}`);
  }

  const html = await res.text();

  if (!html || html.length < 1000) {
    throw new Error(`robotaxitracker HTML too short: ${html.length} bytes`);
  }

  // 2. 지표 추출 (검증된 클래스 앵커 파서)
  const p = parseRobotaxiHtml(html);
  const { riderVehicles, unsupervised, inactive, cybercabs, unsupRate7D, unsupRatio7D } = p;

  // 2-b. TxDMV 등록 대수는 별도 JSON에서 (병렬 아님, 보조 지표)
  const txDmvRegistered = await fetchTxDmvFleetCount();

  // 최소 3개 이상 추출되지 않으면 실패로 간주 (사이트 구조 변경 감지)
  const gotCount = [riderVehicles, unsupervised, inactive, cybercabs].filter(v => v !== null).length;
  if (gotCount < 3) {
    throw new Error(`지표 추출 실패 (${gotCount}/4). 사이트 구조 변경 가능성. head: ${html.slice(0, 500)}`);
  }

  // 3. 스냅샷 조립
  const snapshot = {
    date:            today,
    collectedAt:     new Date().toISOString(),
    area:            "austin",
    provider:        "tesla",
    riderVehicles,
    unsupervised,
    inactive,
    cybercabs,
    unsupRate7D,
    unsupRatio7D,
    txDmvRegistered,
    source:          "robotaxitracker.com",
    sourceCredit:    "Ethan McKanna (@ethanmckanna)",
  };

  // 4. KV 저장
  await env.VISITORS_KV.put("robotaxi:latest", JSON.stringify(snapshot));
  await env.VISITORS_KV.put(`robotaxi:history:${today}`, JSON.stringify(snapshot), {
    expirationTtl: 2592000 * 3, // 90일
  });

  // 5. 날짜 인덱스 업데이트 (최근 90개)
  const idx = (await env.VISITORS_KV.get("robotaxi:index", "json")) || [];
  if (!idx.includes(today)) {
    const newIdx = [today, ...idx].slice(0, 90);
    await env.VISITORS_KV.put("robotaxi:index", JSON.stringify(newIdx), {
      expirationTtl: 2592000 * 3,
    });
  }

  // 6. 성공 시 lastError 클리어
  await env.VISITORS_KV.delete("robotaxi:lastError").catch(() => {});

  console.log(`Robotaxi 수집 완료: ${today} — R:${riderVehicles} U:${unsupervised} I:${inactive} C:${cybercabs} 7D:${unsupRate7D}% DMV:${txDmvRegistered}`);
}

async function handleRobotaxi(request, env) {
  const days = 90;

  const latest    = (await env.VISITORS_KV.get("robotaxi:latest", "json")) || null;
  const dateIndex = (await env.VISITORS_KV.get("robotaxi:index", "json")) || [];
  const dates     = dateIndex.slice(0, days);

  const history = [];
  for (const date of dates) {
    const snap = await env.VISITORS_KV.get(`robotaxi:history:${date}`, "json");
    if (snap) history.push(snap);
  }
  // 오름차순 (오래된 것 → 최신) — 차트 그리기 편의
  history.sort((a, b) => a.date.localeCompare(b.date));

  const lastError = await env.VISITORS_KV.get("robotaxi:lastError", "json");

  return new Response(
    JSON.stringify({
      latest,
      history,
      count:      history.length,
      updatedAt:  latest && latest.collectedAt ? latest.collectedAt : null,
      servedAt:   new Date().toISOString(),
      stale:      latest && latest.collectedAt ? (Date.now() - new Date(latest.collectedAt).getTime()) > 36 * 3600 * 1000 : true,
      ...(lastError && { lastError }),
    }),
    {
      headers: {
        "Content-Type":                "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":               "public, max-age=600",
      },
    }
  );
}

// ════════════════════════════════════════════════════════
// ⑤ Yahoo Finance 주가 파싱 (기존 — 변경 없음)
// ════════════════════════════════════════════════════════

async function fetchStock() {
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/TSLA?interval=1d&range=5d&includePrePost=false";
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Yahoo Finance HTTP " + res.status);
  const data = await res.json();

  const meta       = data.chart.result[0].meta;
  const quotes     = data.chart.result[0].indicators.quote[0];
  const timestamps = data.chart.result[0].timestamp;

  // v3.5: 최신 종가와 이전 종가의 인덱스를 함께 기록해 날짜가 어긋나지 않게 함 (휴장·결측 대응)
  const closeArr = quotes.close;
  let latestIdx = -1;
  let prevIdx   = -1;
  for (let i = closeArr.length - 1; i >= 0; i--) {
    if (closeArr[i] != null) {
      if (latestIdx < 0)     latestIdx = i;
      else if (prevIdx < 0) { prevIdx = i; break; }
    }
  }
  if (latestIdx < 0) throw new Error("종가 데이터 없음");

  const latestClose = closeArr[latestIdx];
  const prevClose   = prevIdx >= 0 ? closeArr[prevIdx] : meta.previousClose;
  const dateStr     = new Date(timestamps[latestIdx] * 1000).toISOString().slice(0, 10);

  return {
    price:     Math.round(latestClose * 100) / 100,
    prevClose: Math.round(prevClose * 100) / 100,
    high52w:   Math.round(meta.fiftyTwoWeekHigh * 100) / 100,
    low52w:    Math.round(meta.fiftyTwoWeekLow  * 100) / 100,
    volume:    meta.regularMarketVolume
      ? (meta.regularMarketVolume / 1e6).toFixed(1) + "M"
      : "—",
    date:        dateStr,
    shares:      3.9495,          // 10-Q 표지 2026-07-16 기준 보통주 3,949,547,394주
    sharesAsOf:  "2026-07-16",
  };
}

// ════════════════════════════════════════════════════════
// ③ SEC EDGAR 분기 실적 파싱 (기존 — 변경 없음)
// ════════════════════════════════════════════════════════

async function fetchEdgar() {
  const CIK = "0001318605";
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${CIK}.json`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "TeslaHub/3.5 daybridge2025@gmail.com",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error("EDGAR HTTP " + res.status);
  const facts = await res.json();
  const gaap  = facts.facts["us-gaap"];

  // v3.5: 기간 길이로 단독 분기(80~100일)와 누적(YTD)을 구분하고, 최신 10-Q(accn) 하나로 맞춘다.
  const daysOf = (e) => (new Date(e.end) - new Date(e.start)) / 86400000;
  const isSingleQ = (e) => !!(e.start && e.end) && daysOf(e) >= 80 && daysOf(e) <= 100;
  const entriesOf = (tag, unit) => ((gaap[tag] && gaap[tag].units && gaap[tag].units[unit]) || []);

  // 기준 분기: 매출 단독 분기 중 가장 최근 종료일의 10-Q
  const revList = entriesOf("Revenues", "USD").filter((e) => e.form === "10-Q" && isSingleQ(e));
  if (!revList.length) throw new Error("단독 분기 매출 없음");
  revList.sort((a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed));
  const base = revList[0];

  // 같은 제출본(accn)·같은 종료일의 단독 분기 항목
  const pickSingle = (tag, unit) => {
    const list = entriesOf(tag, unit).filter((e) => e.form === "10-Q" && isSingleQ(e) && e.end === base.end && e.accn === base.accn);
    list.sort((a, b) => b.filed.localeCompare(a.filed));
    return list[0] || null;
  };

  // 누적(YTD) 항목을 단독 분기로 환산: 같은 제출본의 누적값 − 직전 분기 단독 값
  const pickFromYtd = (tag) => {
    const ytd = entriesOf(tag, "USD").filter((e) => e.form === "10-Q" && e.accn === base.accn && e.end === base.end && e.start && daysOf(e) > 100);
    // 1분기는 누적=단독이므로 단독 항목을 그대로 사용
    if (!ytd.length) {
      const s = pickSingle(tag, "USD");
      return s ? { val: s.val, method: "single" } : null;
    }
    const y = ytd.sort((a, b) => b.filed.localeCompare(a.filed))[0];
    // 직전 누적(같은 회계연도 시작일, 가장 최근 종료일): Q2=Q1 단독, Q3=상반기(6개월) 누적. 단독 Q2만 빼면 Q1+Q3가 되는 오류가 있었음
    const prior = entriesOf(tag, "USD").filter((e) => e.form === "10-Q" && e.start === y.start && e.end < base.end);
    if (!prior.length) return null;
    prior.sort((a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed));
    // 직전 누적 종료일이 기준 분기 시작 직전(80~100일 전)이 아니면 계산하지 않음
    const gap = (new Date(base.end) - new Date(prior[0].end)) / 86400000;
    if (gap < 80 || gap > 100) return null;
    return { val: y.val - prior[0].val, method: "ytd-delta" };
  };

  const rev = base;
  const op  = pickSingle("OperatingIncomeLoss", "USD");
  const rd  = pickSingle("ResearchAndDevelopmentExpense", "USD");
  const gp  = pickSingle("GrossProfit", "USD");
  const eps = pickSingle("EarningsPerShareDiluted", "USD/shares") || pickSingle("EarningsPerShareDiluted", "USD");
  const capexQ = pickFromYtd("PaymentsToAcquirePropertyPlantAndEquipment");
  const ocfQ   = pickFromYtd("NetCashProvidedByUsedInOperatingActivities");

  const d = new Date(rev.end);
  const qNum = Math.ceil((d.getMonth() + 1) / 3);
  const yr = String(d.getFullYear()).slice(2);
  const toM = (v) => (v == null ? null : Math.round(v / 1e6));

  const capex = capexQ ? toM(capexQ.val) : null;
  const ocf   = ocfQ ? toM(ocfQ.val) : null;
  const fcf   = ocf != null && capex != null ? ocf - capex : null;
  const total = toM(rev.val);
  const gross = gp ? toM(gp.val) : null;

  return {
    apiVersion: "3.5",
    q: `Q${qNum}'${yr}`,
    date: rev.end,
    periodStart: rev.start,
    periodMonths: 3,
    accn: rev.accn,
    filed: rev.filed,
    total,
    gm: total && gross != null ? Math.round((gross / total) * 1000) / 10 : null,
    opInc: op ? toM(op.val) : null,
    eps: eps ? Math.round(eps.val * 100) / 100 : null,
    rd: rd ? toM(rd.val) : null,
    capex,
    fcf,
    auto: null,
    energy: null,
    services: null,
    methods: { capex: capexQ ? capexQ.method : "missing", fcf: fcf != null ? "ocf-minus-capex(ytd-delta)" : "missing" },
    source: "SEC EDGAR XBRL (단독 분기, 제출본 일치)",
  };
}

// ════════════════════════════════════════════════════════
// ④ Cron: 주가 자동 업데이트 (기존 — 변경 없음)
// ════════════════════════════════════════════════════════

async function cronUpdateStock(env) {
  try {
    const stock = await fetchStock();
    await env.VISITORS_KV.put("stock:latest",  JSON.stringify(stock));
    await env.VISITORS_KV.put("stock:updated", new Date().toISOString());
    console.log("Cron stock updated:", stock.price, stock.date);
  } catch (e) {
    console.error("Cron stock error:", e.message);
  }
}

// ════════════════════════════════════════════════════════
// ⑤ 메인 핸들러 (fetch + scheduled)
// ════════════════════════════════════════════════════════

export default {
  // ── Cron Trigger 핸들러 ─────────────────────────────
  async scheduled(event, env, ctx) {
    if (event.cron === "0 22 * * *") {
      // KST 07:00 — 주가 자동 갱신
      ctx.waitUntil(cronUpdateStock(env));
    } else if (event.cron === "0 23 * * *") {
      // KST 08:00 — 로보택시 데이터 수집
      ctx.waitUntil(
        collectRobotaxiData(env).catch(async (e) => {
          console.error("로보택시 수집 실패:", e.message, e.stack);
          await env.VISITORS_KV.put(
            "robotaxi:lastError",
            JSON.stringify({
              time:    new Date().toISOString(),
              cron:    event.cron,
              message: e.message,
              stack:   (e.stack || "").slice(0, 500),
            }),
            { expirationTtl: 604800 } // 7일
          );
        })
      );
    }
    // 뉴스 수집: 헤드리스 클라우드 루틴(Sonnet)이 KST 09:00/16:00에
    // RSS 수집·번역·분류 후 POST /news/ingest로 직접 전송함.
    // → 이 Worker의 Cron Trigger 목록에서 0 0 * * * / 0 7 * * * 는 삭제할 것.
  },

  // ── fetch 핸들러 ────────────────────────────────────
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    // 헬스체크
    if (path === "/health") {
      return json({ status: "ok", time: new Date().toISOString() });
    }

    // 뉴스 조회
    if (path === "/news") {
      return handleNews(request, env);
    }

    // 🆕 뉴스 ingest — 헤드리스 클라우드 루틴 전용 (토큰 인증)
    if (path === "/news/ingest" && request.method === "POST") {
      return handleNewsIngest(request, env);
    }

    // 로보택시 조회
    if (path === "/robotaxi") {
      return handleRobotaxi(request, env);
    }

    // 로보택시 강제 트리거 (진단용) - 즉시 실행
    if (path === "/trigger-robotaxi") {
      const tok = (request.headers.get("Authorization") || "").replace(/^Bearer /, "");
      if (!env.TRIGGER_TOKEN || tok !== env.TRIGGER_TOKEN) return json({ error: "unauthorized" }, 401);
      try {
        await collectRobotaxiData(env);
        const latest = await env.VISITORS_KV.get("robotaxi:latest", "json");
        return json({ status: "success", latest });
      } catch (e) {
        await env.VISITORS_KV.put(
          "robotaxi:lastError",
          JSON.stringify({
            time: new Date().toISOString(),
            cron: "manual-trigger",
            message: e.message,
            stack: (e.stack || "").slice(0, 500),
          }),
          { expirationTtl: 604800 }
        );
        return json({ status: "error", message: e.message }, 500);
      }
    }

    // 주가 조회
    if (path === "/stock") {
      try {
        const cached    = await env.VISITORS_KV.get("stock:latest");
        const updatedAt = await env.VISITORS_KV.get("stock:updated");
        if (cached && updatedAt) {
          const age = Date.now() - new Date(updatedAt).getTime();
          if (age < 3600 * 1000) {
            return json({ ...JSON.parse(cached), cached: true });
          }
        }
        const stock = await fetchStock();
        await env.VISITORS_KV.put("stock:latest",  JSON.stringify(stock));
        await env.VISITORS_KV.put("stock:updated", new Date().toISOString());
        return json({ ...stock, cached: false });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // EDGAR 분기 실적
    if (path === "/edgar") {
      try {
        return json(await fetchEdgar());
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // 방문자 카운터
    if (path === "/count") {
      const today = new Date().toISOString().slice(0, 10);
      let newVisit = false;
      try {
        const b  = await request.json();
        newVisit = b.newVisit === true;
      } catch (e) {}

      let total      = parseInt((await env.VISITORS_KV.get("total"))        || "0");
      let todayCount = parseInt((await env.VISITORS_KV.get("day:" + today)) || "0");
      if (newVisit) {
        total++;
        todayCount++;
        await env.VISITORS_KV.put("total",          String(total));
        await env.VISITORS_KV.put("day:" + today,   String(todayCount));
      }
      return json({ total, today: todayCount });
    }

    // Anthropic API 프록시
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    try {
      const body = await request.json();
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type":       "application/json",
          "x-api-key":          env.ANTHROPIC_API_KEY,
          "anthropic-version":  "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      return json(await resp.json());
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};
