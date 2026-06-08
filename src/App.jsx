import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell
} from "recharts";

/* ═══════════════════════════════════════
   STORAGE ADAPTER
   Claude.ai 아티팩트: window.storage 사용
   GitHub Pages: localStorage 사용
   → 환경 자동 감지
═══════════════════════════════════════ */
const LS = {
  get: async (key) => {
    if (typeof window !== "undefined" && window.storage) {
      const r = await LS.get(key);
      return r;
    }
    const v = localStorage.getItem(key);
    return v ? { value: v } : null;
  },
  getShared: async (key) => {
    if (typeof window !== "undefined" && window.storage) {
      return LS.getShared(key);
    }
    const v = localStorage.getItem("shared_"+key);
    return v ? { value: v } : null;
  },
  set: async (key, value) => {
    if (typeof window !== "undefined" && window.storage) {
      return LS.set(key, value).catch(() => null);
    }
    localStorage.setItem(key, value); return true;
  },
  setShared: async (key, value) => {
    if (typeof window !== "undefined" && window.storage) {
      return LS.set(key, value, true).catch(() => null);
    }
    localStorage.setItem("shared_"+key, value); return true;
  },
  delete: async (key) => {
    if (typeof window !== "undefined" && window.storage) {
      return window.storage.delete(key).catch(() => null); // artifact env only
    }
    localStorage.removeItem(key); return true;
  },
};

/* ═══════════════════════════════════════
   AUTH
═══════════════════════════════════════ */
const PW_HASH = "06aa279b45a379ec5a8956b477106a79acd1f5feeb4464b7b25819437f0678fe";
const MAX_ATTEMPTS = 5;
const LOCKOUT_SEC  = 60;

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

/* ═══════════════════════════════════════
   AI ENGINE
═══════════════════════════════════════ */
async function callClaude(system, user) {
  const apiUrl = (typeof window !== "undefined" && window.__PROXY_URL__)
    ? window.__PROXY_URL__
    : "https://api.anthropic.com/v1/messages";
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1000,
      system, messages: [{ role: "user", content: user }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  if (!res.ok) throw new Error("API " + res.status);
  const data = await res.json();
  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
  const m = text.replace(/```json|```/g, "").match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) throw new Error("JSON not found");
  return JSON.parse(m[0]);
}

const SYS = {
  quarterly: `Return ONLY valid JSON for Tesla's latest quarterly earnings:
{"q":"Q2'26","auto":00000,"energy":0000,"services":0000,"total":00000,"gm":00.0,"opInc":0000,"eps":0.00,"fcf":0000,"rd":0000,"capex":0000}
All values millions USD. No markdown.`,
  earnings: `Return ONLY valid JSON for Tesla's latest earnings call:
{"q":"Q2'26","date":"YYYY-MM-DD","sentiment":"positive","headline":"한국어 헤드라인","quotes":[{"s":"Elon Musk","t":"발언"}],"m":{"rev":"$XB","eps":"$X","gm":"X%","op":"$XB","rd":"$XB","capex":"$XB"},"tags":["tag"],"highlight":"요약"}`,
  xpost: `Return ONLY valid JSON for Elon Musk's latest Tesla-related X post:
{"date":"YYYY-MM-DD","cat":"Tesla전략","likes":"XXK","reposts":"XXK","impact":"high","en":"text","ko":"번역","ctx":"맥락"}`,
  ownership: `Return ONLY valid JSON for latest Tesla institutional investor activity:
{"date":"YYYY-MM","inst":"Name","action":"BUY","amt":"$XXM","shares":"XXK주","note":"한국어","sent":"bullish"}`,
  fsd: `Search Tesla's official safety page (tesla.com/VehicleSafetyReport) or latest news for Tesla FSD cumulative miles data. Return ONLY valid JSON:
{"totalMiles":10010684206,"cityMiles":3761203620,"dailyMiles":28800000,"updatedDate":"YYYY-MM-DD","collisionPer":5300000,"vsHuman":660000}
totalMiles/cityMiles in actual miles (integer). dailyMiles = current daily rate. collisionPer = miles per major collision on FSD. vsHuman = miles per collision for avg US driver. Return ONLY JSON.`,

  stock: `Return ONLY valid JSON for Tesla (TSLA) current stock price:
{"price":000.00,"prevClose":000.00,"high52w":000.00,"low52w":000.00,"volume":"XXM","date":"YYYY-MM-DD","shares":3.76}
All USD. shares in billions.`,
};

/* ═══════════════════════════════════════
   BASE DATA
═══════════════════════════════════════ */
const BASE_Q = [
  {q:"Q2'19",auto:5376,energy:369,services:605,total:6350,gm:14.5,opInc:-167,eps:-2.31,fcf:null,rd:334,capex:null},
  {q:"Q3'19",auto:5353,energy:402,services:548,total:6303,gm:18.9,opInc:261,eps:0.78,fcf:null,rd:334,capex:null},
  {q:"Q4'19",auto:6368,energy:436,services:580,total:7384,gm:18.8,opInc:359,eps:0.56,fcf:null,rd:345,capex:null},
  {q:"Q1'20",auto:5132,energy:293,services:560,total:5985,gm:20.6,opInc:283,eps:0.08,fcf:null,rd:324,capex:null},
  {q:"Q2'20",auto:5179,energy:370,services:487,total:6036,gm:21.0,opInc:327,eps:0.50,fcf:null,rd:279,capex:null},
  {q:"Q3'20",auto:7680,energy:579,services:648,total:8771,gm:23.7,opInc:809,eps:0.76,fcf:null,rd:366,capex:null},
  {q:"Q4'20",auto:9314,energy:752,services:611,total:10744,gm:24.1,opInc:575,eps:0.27,fcf:null,rd:522,capex:null},
  {q:"Q1'21",auto:9015,energy:594,services:750,total:10389,gm:26.5,opInc:594,eps:0.39,fcf:null,rd:666,capex:null},
  {q:"Q2'21",auto:11758,energy:801,services:951,total:11958,gm:28.4,opInc:1312,eps:0.62,fcf:null,rd:576,capex:null},
  {q:"Q3'21",auto:12458,energy:806,services:894,total:13757,gm:30.5,opInc:2000,eps:0.62,fcf:null,rd:611,capex:null},
  {q:"Q4'21",auto:14001,energy:688,services:1207,total:17719,gm:29.2,opInc:2617,eps:0.73,fcf:null,rd:718,capex:null},
  {q:"Q1'22",auto:13489,energy:616,services:1279,total:18756,gm:29.1,opInc:3603,eps:0.95,fcf:2900,rd:865,capex:1833},
  {q:"Q2'22",auto:14602,energy:866,services:1466,total:16934,gm:25.0,opInc:2464,eps:0.65,fcf:621,rd:967,capex:1730},
  {q:"Q3'22",auto:18692,energy:1117,services:1645,total:21454,gm:25.1,opInc:3688,eps:0.95,fcf:3297,rd:733,capex:1803},
  {q:"Q4'22",auto:21307,energy:1310,services:1701,total:24318,gm:23.8,opInc:3901,eps:1.07,fcf:1420,rd:810,capex:1858},
  {q:"Q1'23",auto:19963,energy:1529,services:1837,total:23329,gm:19.3,opInc:2664,eps:0.73,fcf:441,rd:771,capex:2072},
  {q:"Q2'23",auto:21268,energy:1509,services:2150,total:24927,gm:18.2,opInc:2399,eps:0.78,fcf:1005,rd:943,capex:2060},
  {q:"Q3'23",auto:19625,energy:1559,services:2166,total:23350,gm:17.9,opInc:1764,eps:0.53,fcf:848,rd:1161,capex:2460},
  {q:"Q4'23",auto:21563,energy:1438,services:2166,total:25167,gm:17.6,opInc:2064,eps:2.27,fcf:2064,rd:1073,capex:2306},
  {q:"Q1'24",auto:17378,energy:1635,services:2288,total:21301,gm:17.4,opInc:1171,eps:0.34,fcf:-2531,rd:1151,capex:2777},
  {q:"Q2'24",auto:19878,energy:3014,services:2608,total:25500,gm:18.0,opInc:1605,eps:0.40,fcf:1340,rd:1085,capex:2272},
  {q:"Q3'24",auto:20016,energy:2376,services:2790,total:25182,gm:19.8,opInc:2717,eps:0.62,fcf:2742,rd:1333,capex:3513},
  {q:"Q4'24",auto:19798,energy:3061,services:2848,total:25707,gm:16.3,opInc:1583,eps:0.60,fcf:2031,rd:1444,capex:2780},
  {q:"Q1'25",auto:13967,energy:2730,services:2638,total:19335,gm:16.3,opInc:399,eps:0.12,fcf:664,rd:1409,capex:1492},
  {q:"Q2'25",auto:16661,energy:2789,services:3046,total:22496,gm:17.2,opInc:923,eps:0.33,fcf:146,rd:1510,capex:2394},
  {q:"Q3'25",auto:21205,energy:3415,services:3475,total:28095,gm:18.0,opInc:1624,eps:0.39,fcf:3990,rd:1780,capex:2248},
  {q:"Q4'25",auto:17693,energy:3837,services:3371,total:24901,gm:20.1,opInc:1409,eps:0.24,fcf:1420,rd:2040,capex:2393},
  {q:"Q1'26",auto:16234,energy:2408,services:3745,total:22387,gm:21.1,opInc:941,eps:0.41,fcf:1444,rd:1946,capex:2493},
];

const ANNUAL = [
  {y:"2019",auto:20821,energy:1531,services:2226,total:24578,gm:16.6,opInc:-69,netInc:-862,rd:1343,capex:1327},
  {y:"2020",auto:27236,energy:1994,services:2306,total:31536,gm:21.0,opInc:1994,netInc:721,rd:1491,capex:1651},
  {y:"2021",auto:47232,energy:2789,services:3802,total:53823,gm:25.3,opInc:6523,netInc:5519,rd:2593,capex:6515},
  {y:"2022",auto:71462,energy:3909,services:6091,total:81462,gm:25.6,opInc:13656,netInc:12556,rd:3075,capex:7157},
  {y:"2023",auto:82419,energy:6035,services:8319,total:96773,gm:18.2,opInc:8891,netInc:14997,rd:3969,capex:8898},
  {y:"2024",auto:77070,energy:10086,services:10534,total:97690,gm:17.9,opInc:7076,netInc:7091,rd:4622,capex:11036},
  {y:"2025",auto:69526,energy:12771,services:12530,total:94827,gm:18.0,opInc:4355,netInc:3794,rd:6739,capex:8527},
];

const FSD_SUBS = [
  {q:"Q4'24",subs:0.80},{q:"Q1'25",subs:0.85},{q:"Q2'25",subs:0.95},
  {q:"Q3'25",subs:1.04},{q:"Q4'25",subs:1.10},{q:"Q1'26",subs:1.28},
];

const BASE_CALLS = [
  {id:1,q:"Q1'26",date:"2026-04-22",sentiment:"positive",
   headline:"CapEx $25B+ 선언 · Terafab 착공 · AI 전환 가속",
   quotes:[
     {s:"Elon Musk",t:"우리는 매우 큰 자본 투자 단계에 진입했습니다. 2026년 CapEx는 $250억 이상이 될 것입니다."},
     {s:"Elon Musk",t:"Terafab — Giga Texas에 반도체 R&D 팹을 $30억에 짓습니다. Intel 14A 공정을 활용합니다."},
     {s:"Elon Musk",t:"Optimus는 역사상 가장 큰 제품이 될 것입니다."},
     {s:"Vaibhav Taneja (CFO)",t:"AI 관련 지출이 연간 내내 높은 수준을 유지할 것입니다."},
   ],
   m:{rev:"$22.4B",eps:"$0.41",gm:"21.1%",op:"$941M",rd:"$1.95B",capex:"$2.49B"},
   tags:["Terafab","CapEx$25B","Optimus","FSD","Cybercab"],
   highlight:"🔴 CapEx $25B 쇼크 · Terafab $3B 착공"},
  {id:2,q:"Q4'25",date:"2026-01-29",sentiment:"mixed",
   headline:"Model S·X 단종 선언 · Fremont Optimus 전환 · FSD 구독자 공개",
   quotes:[
     {s:"Elon Musk",t:"이제 Model S와 X를 명예로운 퇴역(honorable discharge)으로 종료할 시간입니다."},
     {s:"Elon Musk",t:"Fremont의 Model S·X 라인을 Optimus 100만대/년 라인으로 전환합니다."},
     {s:"Elon Musk",t:"차량은 더 이상 Tesla의 핵심 제품이 아닙니다. Optimus가 다음 성장의 중심입니다."},
   ],
   m:{rev:"$24.9B",eps:"$0.50",gm:"20.1%",op:"$1.41B",rd:"$2.04B",capex:"$2.39B"},
   tags:["ModelS·X단종","Optimus100만대","Fremont전환"],
   highlight:"🔴 Model S·X 2026 Q2 생산 종료 공식 발표"},
  {id:3,q:"Q3'25",date:"2025-10-22",sentiment:"positive",
   headline:"분기 최대 $28.1B · Robotaxi 오스틴 런칭 · Optimus 공장 투입",
   quotes:[
     {s:"Elon Musk",t:"로보택시 서비스를 오스틴에서 론칭했습니다. 테슬라 역사상 가장 중요한 제품 발매일입니다."},
     {s:"Elon Musk",t:"Optimus는 현재 Gigafactory 내부 작업에 투입. 내년에는 수천 대를 생산할 것입니다."},
   ],
   m:{rev:"$28.1B",eps:"$0.50",gm:"18.0%",op:"$1.62B",rd:"$1.78B",capex:"$2.25B"},
   tags:["Robotaxi","Optimus","Energy"],highlight:"✅ 로보택시 오스틴 정식 런칭"},
  {id:4,q:"Q2'25",date:"2025-07-23",sentiment:"mixed",
   headline:"$22.5B · DOGE 퇴임 후 Tesla 복귀 · FSD 중국 전망",
   quotes:[
     {s:"Elon Musk",t:"정부 업무에서 물러나 Tesla에 더 집중합니다."},
     {s:"Elon Musk",t:"FSD는 지금 인간보다 훨씬 안전합니다. 중국 전면 승인을 3분기 내로 기대합니다."},
   ],
   m:{rev:"$22.5B",eps:"$0.40",gm:"17.2%",op:"$923M",rd:"$1.51B",capex:"$2.39B"},
   tags:["DOGE복귀","FSD중국"],highlight:"⚠️ DOGE 퇴임 · Tesla 집중 선언"},
  {id:5,q:"Q1'25",date:"2025-04-22",sentiment:"negative",
   headline:"$19.3B YoY-9% · DOGE 여파 · 유럽 -39% · Robotaxi 6월 예고",
   quotes:[
     {s:"Elon Musk",t:"테슬라가 오스틴에서 6월에 아무도 없이 도로를 달릴 것입니다."},
   ],
   m:{rev:"$19.3B",eps:"$0.12",gm:"16.3%",op:"$399M",rd:"$1.41B",capex:"$1.49B"},
   tags:["DOGE여파","유럽-39%"],highlight:"🔴 분기 최저 영업이익 $399M"},
  {id:6,q:"Q3'24",date:"2024-10-23",sentiment:"positive",
   headline:"영업이익 $2.72B 연중 최고 · Cybercab 공개 · FSD v12",
   quotes:[
     {s:"Elon Musk",t:"We Build The Future. Cybercab과 Robovan을 공개했습니다."},
     {s:"Elon Musk",t:"FSD v12는 신경망이 스스로 학습하고 있습니다."},
   ],
   m:{rev:"$25.2B",eps:"$0.72",gm:"19.8%",op:"$2.72B",rd:"$1.33B",capex:"$3.51B"},
   tags:["Cybercab","FSDv12"],highlight:"✅ Cybercab 세계 최초 공개"},
];

const BASE_POSTS = [
  {id:1,date:"2026-06-05",cat:"DOGE·정치",likes:"2.1M",reposts:"512K",impact:"high",
   en:"Time to drop the really big bomb: @realDonaldTrump is in the Epstein files. That is the real reason they have not been made public.",
   ko:"진짜 큰 폭탄을 투하할 시간: 트럼프는 엡스타인 파일에 있습니다. 그것이 공개되지 않는 진짜 이유입니다.",
   ctx:"트럼프와의 공개 갈등. 이후 삭제. 당일 Tesla 주가 최대 -14.3% 급락. JPMorgan 업그레이드 당일"},
  {id:2,date:"2026-06-05",cat:"DOGE·정치",likes:"890K",reposts:"198K",impact:"high",
   en:"Without me, Trump would have lost the election, Dems would control the House.",
   ko:"나 없이는 트럼프가 선거에서 졌을 것이고, 민주당이 하원을 장악했을 것입니다.",
   ctx:"트럼프-머스크 갈등 당일. Trump 정부 계약 취소 검토 반발. 이후 머스크 사과"},
  {id:3,date:"2026-05-27",cat:"Tesla전략",likes:"445K",reposts:"112K",impact:"high",
   en:"My companies are, surprisingly in some ways, trending towards convergence.",
   ko:"저의 회사들이 놀랍게도 수렴(통합) 방향으로 나아가고 있습니다.",
   ctx:"SpaceX-Tesla 합병 논의(CNBC 5/27 보도) 이후 재조명. Wedbush 합병 확률 80~90% 전망"},
  {id:4,date:"2026-05-18",cat:"AI·Dojo",likes:"387K",reposts:"89K",impact:"high",
   en:"This is just one battle in a much longer war. The mission to ensure AI is safe continues.",
   ko:"이것은 더 긴 전쟁의 하나의 전투일 뿐입니다. AI를 안전하게 하는 사명은 계속됩니다.",
   ctx:"OpenAI 소송 배심원 패소(5/18) 직후. 법원: 소송 시효 초과. 항소 예정"},
  {id:5,date:"2026-05-06",cat:"Tesla전략",likes:"521K",reposts:"134K",impact:"high",
   en:"SpaceX, Tesla, and xAI are building the physical AI infrastructure of Earth and Mars. The convergence is necessary.",
   ko:"SpaceX, Tesla, xAI는 지구와 화성의 물리적 AI 인프라를 구축하고 있습니다. 통합은 필수적입니다.",
   ctx:"Terafab 1단계 비용 $55B 공개 직후. SpaceX·xAI·Tesla 삼각 통합 전략 공식화"},
  {id:6,date:"2026-04-22",cat:"Terafab",likes:"167K",reposts:"44K",impact:"high",
   en:"Tesla breaking ground on Terafab at Giga Texas today. $3B semiconductor R&D facility. Intel 14A process.",
   ko:"오늘 Giga Texas에서 Terafab 착공. $30억 규모 반도체 R&D 시설. Intel 14A 공정.",
   ctx:"Q1'26 어닝콜 당일 착공. AI 컴퓨팅 독립 확보 목표"},
  {id:7,date:"2026-04-22",cat:"Robotaxi",likes:"128K",reposts:"31K",impact:"high",
   en:"Robotaxi in Dallas and Houston — zero incidents to date. FSD v14.3 has 20% lower inference latency.",
   ko:"달라스·휴스턴 로보택시 — 현재까지 무사고. FSD v14.3 추론 지연 20% 감소.",
   ctx:"Q1'26 어닝콜 후"},
  {id:8,date:"2026-01-29",cat:"Optimus",likes:"312K",reposts:"78K",impact:"high",
   en:"It's time to give the Model S and X an honorable discharge. Converting Fremont space to 1 million unit/year Optimus line.",
   ko:"Model S와 X에 명예로운 퇴역을 줄 시간입니다. Fremont 공간을 연간 100만 대 Optimus 라인으로 전환합니다.",
   ctx:"Q4'25 어닝콜 — Model S·X 단종 발표"},
  {id:9,date:"2026-01-08",cat:"FSD",likes:"98K",reposts:"26K",impact:"high",
   en:"Roughly 10 billion miles of training data is needed to achieve safe unsupervised self-driving.",
   ko:"안전한 무감독 자율주행을 위해 약 100억 마일의 훈련 데이터가 필요합니다. (현재 71억 마일 달성)",
   ctx:"무감독 FSD 목표 마일리지 공표"},
  {id:10,date:"2025-12-30",cat:"Cybercab",likes:"94K",reposts:"24K",impact:"high",
   en:"Just testing the production system. Real production ramp starts in April.",
   ko:"생산 시스템 테스트 중. 실제 생산 램프는 4월에 시작됩니다.",
   ctx:"Cybercab 파일럿 영상 답변"},
  {id:11,date:"2025-11-07",cat:"Tesla전략",likes:"205K",reposts:"51K",impact:"high",
   en:"Three major products go into production in 2026: Cybercab, Tesla Semi, and Optimus.",
   ko:"2026년 세 제품 생산 돌입: Cybercab, Tesla Semi, Optimus.",
   ctx:"2025 주주총회"},
  {id:12,date:"2025-05-28",cat:"DOGE·정치",likes:"342K",reposts:"89K",impact:"high",
   en:"As my scheduled time as a Special Government Employee comes to an end, I thank President Trump. The DOGE mission continues.",
   ko:"특별 정부 직원 임기 종료. 트럼프 대통령께 감사. DOGE 미션은 계속됩니다.",
   ctx:"DOGE 수장직 퇴임 공식 선언"},
  {id:13,date:"2025-01-29",cat:"Robotaxi",likes:"198K",reposts:"47K",impact:"high",
   en:"Teslas will be in the wild with no one in them, in Austin in June.",
   ko:"올해 6월 오스틴에서 아무도 없는 테슬라가 도로를 달릴 것입니다.",
   ctx:"Q4'24 어닝콜"},
  {id:14,date:"2024-10-10",cat:"Cybercab",likes:"312K",reposts:"78K",impact:"high",
   en:"Cybercab is the future. No steering wheel, no pedals. Pure autonomy. Coming in 2026.",
   ko:"Cybercab이 미래입니다. 핸들도 페달도 없습니다. 2026년 출시.",
   ctx:"We, Robot 이벤트"},
  {id:15,date:"2024-07-15",cat:"FSD",likes:"167K",reposts:"42K",impact:"medium",
   en:"FSD v12 is end-to-end neural net — learns from every Tesla on the road.",
   ko:"FSD v12는 엔드투엔드 신경망 — 도로 위 모든 테슬라에서 학습합니다.",
   ctx:"FSD v12 업데이트 후"},
  {id:16,date:"2022-10-27",cat:"X·기술",likes:"892K",reposts:"234K",impact:"high",
   en:"the bird is freed",
   ko:"새는 자유를 얻었습니다",
   ctx:"Twitter $44B 인수 완료"},
  {id:17,date:"2020-05-01",cat:"Tesla전략",likes:"412K",reposts:"98K",impact:"high",
   en:"Tesla stock price is too high imo",
   ko:"제 생각에 테슬라 주가는 너무 높습니다",
   ctx:"COVID 봉쇄 비판 후 — 주가 10% 급락"},
];

const BASE_INST = [
  {id:1,date:"2026-04-06~08",inst:"ARK Invest (Cathie Wood)",action:"BUY",amt:"$28M",shares:"81K주",note:"저점 매수. 목표가 $4,600",sent:"bullish"},
  {id:2,date:"2026-01",inst:"ARK Invest",action:"SELL",amt:"$44M",shares:"132K주",note:"차익실현, 목표가 상향 직전",sent:"neutral"},
  {id:3,date:"2025-12-22",inst:"ARK Invest",action:"SELL",amt:"$29M",shares:"60.7K주",note:"4주 연속 매도 트렌드",sent:"neutral"},
  {id:4,date:"2025-11-06",inst:"ARK Invest",action:"SELL",amt:"$87M",shares:"181K주",note:"차익실현, Mag7 다른 종목 매수",sent:"neutral"},
  {id:5,date:"2025-Q3",inst:"Vanguard Group",action:"HOLD",amt:"~$94B",shares:"229.8M주",note:"S&P500 지수추종 자동 보유",sent:"neutral"},
  {id:6,date:"2025-Q3",inst:"JPMorgan (R. Brinkman)",action:"RATE",amt:"목표 $145",shares:"—",note:"Underweight 유지. EPS $0.30 하향 (구 애널리스트)",sent:"bearish"},
  {id:7,date:"2026-06-05",inst:"JPMorgan (Rajat Gupta)",action:"RATE",amt:"목표 $475",shares:"—",note:"Underweight→Neutral. $145→$475 (+228%). 수직통합 재평가",sent:"bullish"},
  {id:8,date:"2025-Q2",inst:"Wedbush (Dan Ives)",action:"RATE",amt:"목표 $600",shares:"—",note:"Outperform. AI 전환 역사적 규모. 로보택시 30개 도시",sent:"bullish"},
];

const OWNERSHIP = [
  {name:"일론 머스크",value:13.8,color:"#E31937",shares:"717M주"},
  {name:"Vanguard",value:7.3,color:"#00d4ff",shares:"229.8M주"},
  {name:"BlackRock",value:5.8,color:"#00e676",shares:"188.8M주"},
  {name:"State Street",value:3.4,color:"#ffd600",shares:"114.7M주"},
  {name:"Geode Capital",value:1.7,color:"#a78bfa",shares:"~55M주"},
  {name:"Larry Ellison",value:1.4,color:"#f97316",shares:"~46M주"},
  {name:"기타 기관",value:24.5,color:"#334155",shares:"~815M주"},
  {name:"리테일",value:35.1,color:"#1e3a5f",shares:"~1.17B주"},
  {name:"기타 내부자",value:7.0,color:"#5b21b6",shares:"~233M주"},
];

const CEO_TL = [
  {y:"1971",t:"남아공 프리토리아 출생",d:"아버지 엔지니어, 어머니 캐나다 출신. 어린 시절 왕따 경험하며 독서와 컴퓨터에 몰두."},
  {y:"1983",t:"게임 'Blastar' 판매",d:"12세에 BASIC으로 우주 슈팅 게임 제작. 잡지사에 $500 판매."},
  {y:"1995",t:"Zip2 창업",d:"스탠퍼드 박사 과정 이틀 만에 자퇴. 1999년 Compaq에 $307M 매각."},
  {y:"1999",t:"X.com → PayPal",d:"X.com 설립, 합병 후 PayPal. 2002년 eBay가 $1.5B에 인수."},
  {y:"2002",t:"SpaceX 창립",d:"Mars 이주 목표. 제1원칙 사고로 로켓 비용 99% 절감 목표."},
  {y:"2004",t:"Tesla 투자 참여",d:"시리즈 A 최대 투자자로 참여. 이사회 의장 역임."},
  {y:"2008",t:"Tesla CEO 취임 & 위기",d:"금융위기 속 개인 전 재산 투입, Tesla·SpaceX 동시 구해냄."},
  {y:"2010",t:"Tesla NASDAQ 상장",d:"공모가 $17 → 현재 $391 (2,200%+)."},
  {y:"2021",t:"세계 최고 부자 등극",d:"Tesla 시총 $1조 돌파. Time 올해의 인물 선정."},
  {y:"2022",t:"Twitter $44B 인수 → X",d:"언론 자유 명분으로 인수. X Corp 리브랜딩."},
  {y:"2025",t:"DOGE 수장 → 5월 퇴임",d:"트럼프 2기 DOGE 수장 합류 → 4개월 만에 퇴임, Tesla CEO 복귀."},
  {y:"2026",t:"순자산 $834B · 물리적 AI 전환",d:"Terafab 착공, Model S·X 단종, Robotaxi 달라스·휴스턴 확장."},
];

const CEO_MILESTONES = [
  {n:"차량 2,000만대 인도",cur:"920만대",pct:46},
  {n:"FSD 구독자 1,000만명",cur:"128만명 (12.8%)",pct:13},
  {n:"Optimus 100만대 인도",cur:"파일럿 단계",pct:2},
  {n:"Robotaxi 100만대 상업 운행",cur:"소규모 운행 중",pct:1},
  {n:"조정 EBITDA $500억",cur:"$58.4억 (12%)",pct:12},
];

const VALUES = [
  {icon:"🔬",t:"제1원칙 사고",d:"모든 문제를 근본 진실로 분해 후 재구성. '로켓 원료비 확인 → 직접 만들자.'"},
  {icon:"🚀",t:"문명적 사명",d:"개인 이익보다 인류 생존·문명 지속 최우선. 지속 가능 에너지, 다행성 문명."},
  {icon:"⚡",t:"실패 = 학습",d:"Falcon 1 세 번 폭발 후 네 번째 성공. '실패가 없으면 혁신도 없다.'"},
  {icon:"🎯",t:"극단적 집중력",d:"80~100시간/주 근무. 여러 기업 동시 운영하며 엔지니어링 세부까지 개입."},
  {icon:"📢",t:"피드백 루프",d:"부정적 피드백 특히 중시. '지인들에게 솔직한 비판을 적극 요청하라.'"},
  {icon:"🌍",t:"정보 자유",d:"표현의 자유를 절대 가치로 여김. Twitter 인수의 핵심 동기."},
];

const XCATS = ["ALL","Tesla전략","FSD","Robotaxi","Cybercab","Optimus","AI·Dojo","Terafab","DOGE·정치","X·기술"];

const ANALYST_TARGETS = [
  {date:"2026.06.05",inst:"JPMorgan",analyst:"Rajat Gupta",rating:"Neutral",tp:475,color:"#00d4ff",reason:"수직 통합 재평가. EPS 2030 $7.50 전망. 11년 약세론 종료.",badge:"🔥"},
  {date:"2026.01.10",inst:"Wedbush",analyst:"Dan Ives",rating:"Outperform",tp:600,color:"#00e676",reason:"AI 전환 역사적 변곡점. 로보택시 30개 도시 가속.",badge:null},
  {date:"2026.01.08",inst:"TD Cowen",analyst:"—",rating:"Buy",tp:519,color:"#00e676",reason:"Cybercab $0.30/마일 — 라이드셰어 구조적 파괴.",badge:null},
  {date:"2026.01.05",inst:"Stifel",analyst:"—",rating:"Buy",tp:508,color:"#00e676",reason:"로보택시 7개 도시 확장. Optimus V3 공급망 주목.",badge:null},
  {date:"2025.12.15",inst:"Piper Sandler",analyst:"Alex Potter",rating:"Overweight",tp:500,color:"#00e676",reason:"에너지·소프트웨어 스케일링 지속.",badge:null},
  {date:"2025.12.11",inst:"Morgan Stanley",analyst:"Adam Jonas",rating:"Equal-Weight",tp:425,color:"#ffd600",reason:"AI·Optimus 가치 인정. EV 경쟁·실행 리스크 병존.",badge:null},
  {date:"2026.01.29",inst:"Goldman Sachs",analyst:"Mark Delaney",rating:"Neutral",tp:405,color:"#ffd600",reason:"CapEx $25B → FCF 음전환. 실행 리스크 높음.",badge:null},
  {date:"2026.01.15",inst:"RBC Capital",analyst:"Tom Narayan",rating:"Outperform",tp:320,color:"#ffd600",reason:"전통 EV 경쟁 심화. 자율주행 타임라인 불확실.",badge:null},
  {date:"2026.04.01",inst:"Wells Fargo",analyst:"Colin Langan",rating:"Underweight",tp:125,color:"#E31937",reason:"EV 수요 구조적 둔화. 밸류에이션 현실과 괴리.",badge:null},
  {date:"2025.01.01",inst:"ARK Invest",analyst:"Cathie Wood",rating:"—",tp:4600,color:"#a78bfa",reason:"로보택시+Optimus 대량생산 DCF. 2029 불마켓 가정.",badge:"⚠극단값"},
];

/* ═══════════════════════════════════════
   STYLES
═══════════════════════════════════════ */
const R="#E31937",AC="#00d4ff",GR="#00e676",YL="#ffd600",MU="#7070a0",TX="#e8e8f0",DK="#050508",SF="#141420",BD="rgba(227,25,55,0.22)";

const card = {background:SF,border:"1px solid "+BD,borderRadius:4,padding:"18px 20px"};
const lbl  = {fontFamily:"'Space Mono',monospace",fontSize:9,letterSpacing:3,color:R,textTransform:"uppercase",marginBottom:5};
const ttl  = {fontFamily:"'Orbitron',monospace",fontSize:18,fontWeight:700,color:"#fff",marginBottom:16};
const fb   = a => ({fontFamily:"'Space Mono',monospace",fontSize:9,padding:"5px 11px",borderRadius:2,cursor:"pointer",
                    border:a?"1px solid "+R:"1px solid rgba(255,255,255,0.1)",
                    background:a?"rgba(227,25,55,0.15)":"transparent",color:a?R:MU,letterSpacing:1});
const inp  = {background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:3,
              color:TX,padding:"7px 11px",fontFamily:"'Noto Sans KR',sans-serif",fontSize:12,outline:"none"};

const SENT_ST = {
  positive:{br:"rgba(0,230,118,.3)",c:GR},
  mixed:   {br:"rgba(255,214,0,.3)", c:YL},
  negative:{br:"rgba(227,25,55,.3)", c:R},
};
const ACT_C  = {BUY:GR,SELL:R,HOLD:MU,RATE:AC};
const SENT_C = {bullish:GR,bearish:R,neutral:YL};
const IMP_C  = {high:R,medium:YL,low:MU};

/* ─── 재사용 컴포넌트 ─────────────────── */
function KPI({label,value,sub,color,badge}) {
  return (
    <div style={{...card,flex:1,minWidth:120,position:"relative"}}>
      {badge && (
        <div style={{position:"absolute",top:8,right:8,background:badge==="NEW"?"rgba(0,212,255,.2)":"rgba(227,25,55,.2)",
          border:"1px solid "+(badge==="NEW"?AC:R),color:badge==="NEW"?AC:R,
          fontFamily:"'Space Mono',monospace",fontSize:7,padding:"1px 5px",borderRadius:2}}>{badge}</div>
      )}
      <div style={lbl}>{label}</div>
      <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,fontWeight:700,color:color||"#fff",lineHeight:1.1}}>{value}</div>
      {sub && <div style={{fontSize:10,color:MU,marginTop:4}}>{sub}</div>}
    </div>
  );
}

function RevTip({active,payload,label}) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"#1a1a28",border:"1px solid rgba(227,25,55,.4)",borderRadius:4,padding:"8px 12px",fontFamily:"'Space Mono',monospace",fontSize:10}}>
      <div style={{color:R,marginBottom:4}}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{color:p.color,marginBottom:2}}>{p.name}: <b>{"$"}{(p.value/1000).toFixed(1)}B</b></div>
      ))}
    </div>
  );
}

function AIBtn({onUpdate,loading,label}) {
  return (
    <button onClick={onUpdate} disabled={loading}
      style={{display:"flex",alignItems:"center",gap:6,
        background:loading?"rgba(0,212,255,0.05)":"rgba(0,212,255,0.12)",
        border:"1px solid "+(loading?"rgba(0,212,255,0.2)":"rgba(0,212,255,0.5)"),
        color:loading?MU:AC,fontFamily:"'Space Mono',monospace",fontSize:9,letterSpacing:1,
        padding:"6px 14px",borderRadius:3,cursor:loading?"not-allowed":"pointer",whiteSpace:"nowrap"}}>
      {loading ? <><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>◌</span>{" 검색 중..."}</> : <><span>✦</span>{" "}{label||"AI 업데이트"}</>}
    </button>
  );
}

function LogBadge({log}) {
  if (!log) return null;
  return (
    <div style={{background:log.ok?"rgba(0,230,118,0.1)":"rgba(227,25,55,0.1)",
      border:"1px solid "+(log.ok?"rgba(0,230,118,0.3)":"rgba(227,25,55,0.3)"),
      color:log.ok?GR:R,fontFamily:"'Space Mono',monospace",fontSize:9,padding:"4px 10px",borderRadius:3}}>
      {log.ok ? "✓ "+log.msg : "✗ "+log.msg}
    </div>
  );
}

function SHdr({sub,title,children}) {
  return (
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <div><div style={lbl}>{sub}</div><div style={ttl}>{title}</div></div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN APP
═══════════════════════════════════════ */
export default function App() {
  /* ── tabs ── */
  const [mainTab, setMainTab]   = useState("company");
  const [perfSub, setPerfSub]   = useState("quarterly");
  const [perfView, setPerfView] = useState("revenue");
  const [annView, setAnnView]   = useState("revenue");

  /* ── auth ── */
  const [authUnlocked, setAuthUnlocked] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pwInput, setPwInput]   = useState("");
  const [authError, setAuthError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [lockRemain, setLockRemain] = useState(0);
  const pendingRef = useRef(null);

  /* ── stock state ── */
  const [stock, setStock] = useState({
    price:391.00, prevClose:418.45, high52w:498.83, low52w:273.21,
    volume:"63.4M", date:"2026-06-05", shares:3.76,
  });
  const [ldStock, setLdStock] = useState(false);
  const [fsdMiles, setFsdMiles] = useState({
    totalMiles: 10010684206,
    cityMiles:  3761203620,
    dailyMiles: 28800000,
    updatedDate: "2026-05-03",
    collisionPer: 5300000,
    vsHuman: 660000,
  });
  const [ldFsd, setLdFsd] = useState(false);

  // ── VISITOR COUNTER ──────────────────────────────────────────────
  const [visitors, setVisitors] = useState({total:0, today:0, date:""});

  /* ── data states ── */
  const [quarterly, setQuarterly] = useState(BASE_Q);
  const [calls,     setCalls]     = useState(BASE_CALLS);
  const [posts,     setPosts]     = useState(BASE_POSTS);
  const [instActs,  setInstActs]  = useState(BASE_INST);

  /* ── loading/log states ── */
  const [ld,   setLd]   = useState({perf:false,earnings:false,xpost:false,ownership:false});
  const [logs, setLogs] = useState({perf:null,earnings:null,xpost:null,ownership:null,stock:null,fsd:null});
  const [updateHistory, setUpdateHistory] = useState([]);

  /* ── storage ── */
  const [storageReady, setStorageReady] = useState(false);
  const [saveToast, setSaveToast] = useState(null);

  /* ── ui states ── */
  const [yearFil,  setYearFil]  = useState("ALL");
  const [annV,     setAnnV]     = useState("revenue");
  const [openCall, setOpenCall] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [nc, setNc] = useState({q:"",date:"",sentiment:"positive",headline:"",q1:"",s1:"Elon Musk",r:"",e:"",g:"",o:"",rd:"",capex:"",tags:""});
  const [eSearch, setESearch]   = useState("");
  const [xCat,  setXCat]       = useState("ALL");
  const [xSrch, setXSrch]      = useState("");
  const [xLang, setXLang]      = useState("ko");
  const [instFil, setInstFil]  = useState("ALL");
  const [hdrH, setHdrH]        = useState(60);
  const hdrRef = useCallback(node => { if (node) setHdrH(node.offsetHeight); }, []);

  /* ── lockout countdown ── */
  useEffect(() => {
    if (!lockoutUntil) return;
    const iv = setInterval(() => {
      const rem = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (rem <= 0) { setLockoutUntil(null); setLockRemain(0); setAttempts(0); clearInterval(iv); }
      else setLockRemain(rem);
    }, 500);
    return () => clearInterval(iv);
  }, [lockoutUntil]);

  /* ── storage load ── */
  useEffect(() => {
    (async () => {
      try {
        const keys = ["tsla:quarterly","tsla:calls","tsla:posts","tsla:inst","tsla:stock","tsla:fsd"];
        const [q,c,p,i,s] = await Promise.all(keys.map(k => LS.get(k)));
        if (q?.value) setQuarterly(JSON.parse(q.value));
        if (c?.value) setCalls(JSON.parse(c.value));
        if (p?.value) setPosts(JSON.parse(p.value));
        if (i?.value) setInstActs(JSON.parse(i.value));
        if (s?.value) setStock(JSON.parse(s.value));
        const fsdVal = await LS.get("tsla:fsd");
        if (fsdVal?.value) setFsdMiles(JSON.parse(fsdVal.value));
      } catch(e) { /* storage unavailable, use defaults */ }
      // ── 방문자 카운팅 (shared storage) ───────────────────────────
      try {
        const today = new Date().toISOString().slice(0,10);
        const alreadyCounted = typeof sessionStorage !== "undefined" && sessionStorage.getItem("tsla_visited");
        let totalRes    = await LS.getShared("visitors:total");
        let todayRes    = await LS.getShared("visitors:"+today);
        let total      = totalRes?.value  ? parseInt(totalRes.value)  : 0;
        let todayCount = todayRes?.value  ? parseInt(todayRes.value)  : 0;
        if (!alreadyCounted) {
          total++;
          todayCount++;
          await LS.set("visitors:total",  String(total),      true).catch(() => {});
          await LS.setShared("visitors:"+today, String(todayCount));
          if (typeof sessionStorage !== "undefined") sessionStorage.setItem("tsla_visited", "1");
        }
        setVisitors({total, today:todayCount, date:today});
      } catch(e2) { /* shared storage 불가 시 무시 */ }
      setStorageReady(true);
    })();
  }, []);

  /* ── save helper ── */
  const save = useCallback(async (key, value) => {
    try {
      await LS.set(key, JSON.stringify(value));
      setSaveToast({ok:true,msg:"저장 완료"});
      setTimeout(() => setSaveToast(null), 2000);
    } catch(e) {
      setSaveToast({ok:false,msg:"저장 실패: "+e.message});
      setTimeout(() => setSaveToast(null), 3000);
    }
  }, []);

  /* ── derived values ── */
  const mktCap = useMemo(() => {
    const cap = stock.price * stock.shares;
    return cap >= 1000 ? "$"+(cap/1000).toFixed(2)+"T" : "$"+cap.toFixed(0)+"B";
  }, [stock]);

  const priceDiff = useMemo(() => {
    const d = (stock.price - stock.prevClose).toFixed(2);
    const p = ((stock.price / stock.prevClose - 1) * 100).toFixed(2);
    const up = stock.price >= stock.prevClose;
    return {d, p, up};
  }, [stock]);

  const vsHigh = useMemo(() => ((stock.price / stock.high52w - 1) * 100).toFixed(1), [stock]);

  const latestAnnual = ANNUAL[ANNUAL.length - 1];
  const prevAnnual   = ANNUAL[ANNUAL.length - 2];

  /* ── record log ── */
  const recordLog = (key, ok, msg) => {
    const e = {time: new Date().toLocaleString("ko-KR"), key, ok, msg};
    setLogs(l => ({...l, [key]: {ok,msg}}));
    setUpdateHistory(h => [e, ...h.slice(0, 19)]);
  };

  /* ── auth ── */
  const verifyPw = useCallback(async () => {
    if (lockoutUntil && Date.now() < lockoutUntil) return;
    const hash = await sha256(pwInput);
    if (hash === PW_HASH) {
      setAuthUnlocked(true); setShowAuthModal(false); setPwInput(""); setAuthError(""); setAttempts(0);
      if (pendingRef.current) { pendingRef.current(); pendingRef.current = null; }
    } else {
      const next = attempts + 1; setAttempts(next); setPwInput("");
      if (next >= MAX_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_SEC * 1000);
        setAuthError("비밀번호 "+MAX_ATTEMPTS+"회 오류 — "+LOCKOUT_SEC+"초 잠금");
      } else {
        setAuthError("비밀번호가 올바르지 않습니다 ("+next+"/"+MAX_ATTEMPTS+")");
      }
    }
  }, [pwInput, attempts, lockoutUntil]);

  const guard = useCallback((action) => {
    if (authUnlocked) { action(); return; }
    pendingRef.current = action;
    setShowAuthModal(true); setAuthError(""); setPwInput("");
  }, [authUnlocked]);

  /* ── AI update handlers ── */
  const updateFsd = useCallback(async () => {
    setLdFsd(true);
    try {
      const d = await callClaude(SYS.fsd, "Search Tesla official safety report page or latest news for the current FSD cumulative miles, daily rate, and collision statistics. Return JSON.");
      if (d && d.totalMiles) {
        setFsdMiles(prev => ({...prev, ...d}));
        await save("tsla:fsd", {...fsdMiles, ...d});
        recordLog("fsd", true, "FSD 누적 " + (d.totalMiles/1e9).toFixed(2) + "B 마일 업데이트");
      } else throw new Error("구조 오류");
    } catch(e) { recordLog("fsd", false, e.message); }
    setLdFsd(false);
  }, [fsdMiles, save]);

  const updateStock = useCallback(async () => {
    setLdStock(true);
    try {
      const d = await callClaude(SYS.stock, "Find Tesla TSLA current stock price and 52-week range. Return JSON.");
      if (d && d.price) {
        const updated = {...stock, ...d};
        setStock(updated);
        await save("tsla:stock", updated);
        recordLog("stock", true, "주가 $"+d.price+" 업데이트");
      } else throw new Error("구조 오류");
    } catch(e) { recordLog("stock", false, e.message); }
    setLdStock(false);
  }, [stock, save]);

  const updatePerf = useCallback(async () => {
    setLd(l => ({...l, perf:true}));
    try {
      const d = await callClaude(SYS.quarterly, "Find Tesla latest quarterly earnings. Return JSON.");
      if (d && d.q && d.total) {
        const exists = quarterly.some(q => q.q === d.q);
        if (!exists) {
          setQuarterly(prev => { const n = [...prev, d]; save("tsla:quarterly", n); return n; });
          recordLog("perf", true, d.q+" 추가 — $"+(d.total/1000).toFixed(1)+"B");
        } else recordLog("perf", false, d.q+" 이미 존재");
      } else throw new Error("구조 오류");
    } catch(e) { recordLog("perf", false, e.message); }
    setLd(l => ({...l, perf:false}));
  }, [quarterly, save]);

  const updateEarnings = useCallback(async () => {
    setLd(l => ({...l, earnings:true}));
    try {
      const d = await callClaude(SYS.earnings, "Find Tesla latest earnings call highlights. Return JSON.");
      if (d && d.q && d.headline) {
        const exists = calls.some(c => c.q === d.q);
        if (!exists) {
          setCalls(prev => { const n = [{...d, id:prev.length+1}, ...prev]; save("tsla:calls", n); return n; });
          recordLog("earnings", true, d.q+" 어닝콜 추가");
        } else recordLog("earnings", false, d.q+" 이미 존재");
      } else throw new Error("구조 오류");
    } catch(e) { recordLog("earnings", false, e.message); }
    setLd(l => ({...l, earnings:false}));
  }, [calls, save]);

  const updateXPost = useCallback(async () => {
    setLd(l => ({...l, xpost:true}));
    try {
      const d = await callClaude(SYS.xpost, "Find Elon Musk's latest Tesla-related X post. Return JSON.");
      if (d && d.date && d.ko) {
        const exists = posts.some(p => p.date === d.date && p.ko === d.ko);
        if (!exists) {
          setPosts(prev => { const n = [{...d, id:prev.length+1}, ...prev]; save("tsla:posts", n); return n; });
          recordLog("xpost", true, d.date+" ["+d.cat+"] 추가");
        } else recordLog("xpost", false, "동일 발언 존재");
      } else throw new Error("구조 오류");
    } catch(e) { recordLog("xpost", false, e.message); }
    setLd(l => ({...l, xpost:false}));
  }, [posts, save]);

  const updateOwnership = useCallback(async () => {
    setLd(l => ({...l, ownership:true}));
    try {
      const d = await callClaude(SYS.ownership, "Find latest Tesla institutional investor activity. Return JSON.");
      if (d && d.inst && d.action) {
        setInstActs(prev => { const n = [{...d, id:prev.length+1}, ...prev]; save("tsla:inst", n); return n; });
        recordLog("ownership", true, d.inst+" "+d.action+" "+d.amt);
      } else throw new Error("구조 오류");
    } catch(e) { recordLog("ownership", false, e.message); }
    setLd(l => ({...l, ownership:false}));
  }, [save]);

  const updateAll = useCallback(async () => {
    await updateFsd(); await updateStock(); await updatePerf(); await updateEarnings(); await updateXPost(); await updateOwnership();
  }, [updateStock, updatePerf, updateEarnings, updateXPost, updateOwnership]);

  const resetStorage = useCallback(async () => {
    if (!window.confirm("모든 업데이트 데이터를 초기화합니다. 계속하시겠습니까?")) return;
    try {
      await Promise.all(["tsla:quarterly","tsla:calls","tsla:posts","tsla:inst","tsla:stock"].map(k => LS.delete(k)));
      setQuarterly(BASE_Q); setCalls(BASE_CALLS); setPosts(BASE_POSTS); setInstActs(BASE_INST);
      setStock({price:391.00,prevClose:418.45,high52w:498.83,low52w:273.21,volume:"63.4M",date:"2026-06-05",shares:3.76});
      setUpdateHistory([]); setSaveToast({ok:true,msg:"초기화 완료"});
      setTimeout(() => setSaveToast(null), 2500);
    } catch(e) { setSaveToast({ok:false,msg:"초기화 실패: "+e.message}); }
  }, []);

  const addCall = () => {
    if (!nc.q || !nc.headline) return;
    setCalls(prev => {
      const n = [{id:prev.length+1,q:nc.q,date:nc.date,sentiment:nc.sentiment,headline:nc.headline,
        quotes:nc.q1?[{s:nc.s1,t:nc.q1}]:[],m:{rev:nc.r,eps:nc.e,gm:nc.g,op:nc.o,rd:nc.rd,capex:nc.capex},
        tags:nc.tags.split(",").map(t=>t.trim()).filter(Boolean),highlight:""}, ...prev];
      save("tsla:calls", n); return n;
    });
    setNc({q:"",date:"",sentiment:"positive",headline:"",q1:"",s1:"Elon Musk",r:"",e:"",g:"",o:"",rd:"",capex:"",tags:""});
    setShowForm(false);
  };

  /* ── filtered data ── */
  const filtQ     = useMemo(() => yearFil === "ALL" ? quarterly : quarterly.filter(d => d.q.includes(yearFil.slice(2))), [quarterly, yearFil]);
  const filtCalls = useMemo(() => { const q = eSearch.toLowerCase(); return calls.filter(c => c.headline.toLowerCase().includes(q) || c.q.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q))); }, [calls, eSearch]);
  const filtPosts = useMemo(() => { const q = xSrch.toLowerCase(); return posts.filter(p => (xCat === "ALL" || p.cat === xCat) && (p.en.toLowerCase().includes(q) || p.ko.toLowerCase().includes(q))); }, [posts, xCat, xSrch]);
  const filtInst  = useMemo(() => instFil === "ALL" ? instActs : instActs.filter(d => d.action === instFil), [instActs, instFil]);

  const capexFcfData = useMemo(() => BASE_Q.slice(-8).map(d => ({q:d.q,capex:d.capex,fcf:d.fcf})), []);

  /* ══════════════════════════════════════
     TAB RENDERERS
  ══════════════════════════════════════ */

  /* ── COMPANY ── */
  const CompanyTab = () => {
    const priceStr   = "$"+stock.price.toFixed(2);
    const diffStr    = (priceDiff.up ? "▲" : "▼") + " $"+Math.abs(priceDiff.d) + " (" + (priceDiff.up?"+":"") + priceDiff.p + "%)";
    const highStr    = "52주 고점 $"+stock.high52w+" 대비 "+vsHigh+"%";
    const rangeVal   = "$"+Math.round(stock.low52w)+"~"+Math.round(stock.high52w);
    const rangeSub   = "저점 $"+stock.low52w+" · 고점 $"+stock.high52w;

    const autoYoy  = ((latestAnnual.auto    / prevAnnual.auto    - 1) * 100).toFixed(1);
    const enYoy    = ((latestAnnual.energy  / prevAnnual.energy  - 1) * 100).toFixed(1);
    const svcYoy   = ((latestAnnual.services/ prevAnnual.services- 1) * 100).toFixed(1);
    const segItems = [
      {n:"자동차 판매",    v:latestAnnual.auto,     c:R,  yoy:autoYoy},
      {n:"에너지 & 스토리지",v:latestAnnual.energy, c:AC, yoy:enYoy},
      {n:"서비스 & FSD",  v:latestAnnual.services,  c:GR, yoy:svcYoy},
    ];

    return (
      <div>
        <SHdr sub="COMPANY INTELLIGENCE" title="Tesla, Inc. — 핵심 현황" />
        <div style={{...card,background:"linear-gradient(135deg,rgba(227,25,55,.12),rgba(0,0,0,0) 60%)",marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16}}>
            <div>
              <div style={lbl}>{"TICKER · NASDAQ · "+stock.date+" 종가"}</div>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:44,fontWeight:900,color:"#fff",lineHeight:1}}>TSLA</div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:20,color:R,marginTop:6}}>{priceStr}</div>
              <div style={{fontSize:11,color:MU,marginTop:4}}>{diffStr + " · " + highStr}</div>
              <div style={{fontSize:12,color:MU,marginTop:10,maxWidth:520,lineHeight:1.7}}>
                전기차 → <strong style={{color:TX}}>물리적 AI 기업</strong>으로 전환 완료 선언.<br/>
                자율주행(FSD)·Robotaxi·Optimus·에너지가 4대 성장 엔진.<br/>
                <strong style={{color:YL}}>2026: Model S·X 단종 → Fremont Optimus 전환 + Terafab 착공</strong>
              </div>
            </div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:72,fontWeight:900,color:"rgba(227,25,55,.07)",userSelect:"none",lineHeight:1}}>TSLA</div>
          </div>
        </div>

        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
          <KPI label="시가총액"         value={mktCap}     sub={stock.date+" 종가 기준"} color={R} />
          <KPI label="2025 연간매출"    value="$94.8B"     sub="YoY -3%" />
          <KPI label="Q1'26 EPS"       value="$0.41"      sub="컨센 +17%" color={GR} />
          <KPI label="자동차 총이익률"  value="21.1%"      sub="5분기 최고" color={AC} />
          <KPI label="FSD 구독자"       value="128만명"    sub="+51% YoY" color={YL} />
          <KPI label="FSD ARR"          value="$5.46억"    sub="연간 반복매출" color={GR} badge="NEW" />
          <KPI label="2026 CapEx 가이던스" value="$25B+"  sub="기존 $20B → 상향" color={R} badge="↑" />
          <KPI label="현금 & 투자"      value="$44.7B"    sub="Q1'26 기준" />
          <KPI label="52주 범위"        value={rangeVal}   sub={rangeSub} color={MU} />
        </div>

        {/* 2026 전략 피벗 */}
        <div style={{...card,marginBottom:16,borderColor:"rgba(255,214,0,.35)",background:"rgba(255,214,0,.04)"}}>
          <div style={{...lbl,color:YL}}>2026 STRATEGIC PIVOT — 핵심 이벤트</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
            {[
              ["🔴 Model S·X 단종","Q2'26 생산 종료. Fremont → Optimus 100만대/년 전환.",R],
              ["🔵 Terafab 착공","Giga Texas $3B 반도체 R&D 팹. Intel 14A. 2026.04.22 착공.",AC],
              ["🟡 CapEx $25B+ 선언","2026 자본지출 $25B+ (2025 $8.5B의 3배). AI·Optimus·Cybercab.",YL],
              ["🟢 Robotaxi 확장","달라스·휴스턴 무사고 운행. FSD v14.3.3 출시.",GR],
            ].map(([t,d,c],i) => (
              <div key={i} style={{background:c+"0d",border:"1px solid "+c+"30",borderRadius:3,padding:"12px 14px"}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,color:c,marginBottom:6}}>{t}</div>
                <div style={{fontSize:11,color:MU,lineHeight:1.65}}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div style={card}>
            <div style={lbl}>{"사업 세그먼트 ("+latestAnnual.y+" 실적 자동 연동)"}</div>
            {segItems.map((seg,i) => {
              const pct = Math.min(Math.round(seg.v / latestAnnual.total * 100) * 2.5, 100);
              return (
                <div key={i} style={{marginTop:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                    <span style={{color:MU}}>{seg.n}</span>
                    <span style={{display:"flex",gap:8}}>
                      <span style={{fontFamily:"'Space Mono',monospace",color:TX}}>{"$"+(seg.v/1000).toFixed(1)+"B"}</span>
                      <span style={{fontFamily:"'Space Mono',monospace",color:Number(seg.yoy)>=0?GR:R,fontSize:10}}>{"YoY "+(Number(seg.yoy)>=0?"+":"")+seg.yoy+"%"}</span>
                    </span>
                  </div>
                  <div style={{height:5,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:pct+"%",background:seg.c,borderRadius:3}} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={card}>
            <div style={lbl}>글로벌 기가팩토리</div>
            {[
              ["🇺🇸 캘리포니아 (Fremont)","Model 3/Y · 55만대/년"],
              ["  └ Optimus 라인","전환 중 (Model S·X 종료 후) 🔄"],
              ["🇨🇳 상하이 (Giga Shanghai)","Model 3/Y · 95만대/년"],
              ["🇩🇪 베를린 (Giga Berlin)","Model Y · 37.5만대/년"],
              ["🇺🇸 텍사스 (Giga Texas)","Model Y · Cybertruck · Terafab 🔵"],
              ["🇺🇸 네바다 (Gigafactory)","배터리 · Powerwall"],
              ["Cybercab","Pilot Production 중 🟡"],
            ].map(([l,r],i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:11}}>
                <span style={{color:l.startsWith(" ")?"#5a5a7a":MU}}>{l}</span>
                <span style={{fontFamily:"'Space Mono',monospace",color:TX,fontSize:9}}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* ── CEO ── */
  const CeoTab = () => (
    <div>
      <SHdr sub="LEADERSHIP PROFILE" title="일론 머스크 — 생애와 걸어온 길" />
      <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:20}}>
        <div>
          <div style={{...card,textAlign:"center",marginBottom:14}}>
            <div style={{width:68,height:68,borderRadius:"50%",background:"linear-gradient(135deg,"+R+",#7b0016)",margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Orbitron',monospace",fontSize:22,fontWeight:900,color:"#fff",border:"3px solid "+R,boxShadow:"0 0 18px rgba(227,25,55,.4)"}}>EM</div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:15,fontWeight:700,color:"#fff",marginBottom:2}}>Elon Reeve Musk</div>
            <div style={{fontSize:10,color:R,letterSpacing:2,marginBottom:12}}>CHAIRMAN & CEO · TESLA</div>
            {[["출생","1971.06.28 (만 54세)"],["학력","UPenn 경제·물리학"],["CEO 취임","2008.10~ (현재)"],["순자산","~$834B (2026.06)"],["국적","미국·캐나다·남아공"]].map(([k,v],i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:11}}>
                <span style={{color:MU}}>{k}</span><span style={{fontFamily:"'Space Mono',monospace",color:TX}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{...card,marginBottom:14}}>
            <div style={lbl}>보유 기업</div>
            {[["Tesla","~13%",R],["SpaceX","~42%",AC],["X","최대주주",MU],["xAI","창업자",YL],["Neuralink","공동창업자",MU],["The Boring Co.","창업자",MU]].map(([n,v,c],i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:12}}>
                <span style={{color:MU}}>{n}</span><span style={{fontFamily:"'Space Mono',monospace",color:c,fontSize:10}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{...card,borderColor:"rgba(255,214,0,.3)"}}>
            <div style={{...lbl,color:YL}}>CEO 보상 마일스톤</div>
            <div style={{fontSize:9,color:MU,marginBottom:10,lineHeight:1.5}}>머스크 보상패키지 조건 달성 현황</div>
            {CEO_MILESTONES.map((m,i) => (
              <div key={i} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:4}}>
                  <span style={{color:MU}}>{i+1+". "+m.n}</span>
                  <span style={{fontFamily:"'Space Mono',monospace",color:YL,fontSize:9}}>{m.cur}</span>
                </div>
                <div style={{height:4,background:"rgba(255,255,255,.06)",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:m.pct+"%",background:YL,borderRadius:2}} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={card}>
          <div style={lbl}>생애 타임라인</div>
          <div style={{position:"relative",paddingLeft:26,marginTop:14}}>
            <div style={{position:"absolute",left:7,top:0,bottom:0,width:1,background:"linear-gradient(to bottom,"+R+",transparent)"}} />
            {CEO_TL.map((t,i) => (
              <div key={i} style={{position:"relative",marginBottom:20}}>
                <div style={{position:"absolute",left:-22,top:4,width:10,height:10,borderRadius:"50%",background:R,border:"2px solid "+DK,boxShadow:"0 0 7px rgba(227,25,55,.5)"}} />
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,color:R,letterSpacing:2,marginBottom:2}}>{t.y}</div>
                <div style={{fontSize:13,fontWeight:700,color:TX,marginBottom:2}}>{t.t}</div>
                <div style={{fontSize:11,color:MU,lineHeight:1.6}}>{t.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  /* ── VALUES ── */
  const ValuesTab = () => (
    <div>
      <SHdr sub="PHILOSOPHY & PRINCIPLES" title="가치관과 사상 체계" />
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        {VALUES.map((v,i) => (
          <div key={i} style={card}>
            <div style={{fontSize:24,marginBottom:8}}>{v.icon}</div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:11,fontWeight:700,color:R,marginBottom:6}}>{v.t}</div>
            <div style={{fontSize:11,color:MU,lineHeight:1.65}}>{v.d}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div>
          {[["제1원칙","나는 제1원칙에서 추론하는 것이 중요하다고 생각한다. 근본적 진실을 찾아내고 그로부터 추론하는 것이다."],
            ["사명","어떤 것이 충분히 중요하다면, 승산이 없더라도 해야 한다."],
            ["혁신","실패가 없으면 혁신도 없다."],
            ["인간 잠재력","평범한 사람도 비범함을 선택할 수 있다."]].map(([k,q],i) => (
            <div key={i} style={{background:"rgba(227,25,55,.05)",borderLeft:"3px solid rgba(227,25,55,.4)",borderRadius:"0 4px 4px 0",padding:"12px 16px",marginBottom:10}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:R,letterSpacing:2,marginBottom:5}}>{k}</div>
              <div style={{fontSize:12,color:TX,lineHeight:1.7,fontStyle:"italic"}}>{"\""+q+"\""}</div>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={lbl}>리더십 스타일 분석</div>
          {[["비전 제시력",98,R],["기술 전문성",92,AC],["리스크 감내력",97,R],["실행 속도",95,GR],["직원 관리 유연성",45,YL],["대중 소통",88,AC]].map(([l,p,c],i) => (
            <div key={i} style={{marginTop:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                <span style={{color:MU}}>{l}</span><span style={{color:TX,fontFamily:"'Space Mono',monospace"}}>{p+"%"}</span>
              </div>
              <div style={{height:5,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:p+"%",background:c,borderRadius:3}} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── PERFORMANCE ── */
  const PerfTab = () => {
    const YR_OPTS = ["ALL","2019","2020","2021","2022","2023","2024","2025","2026"];
    return (
      <div>
        <SHdr sub="FINANCIAL INTELLIGENCE" title="실적 분석">
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <AIBtn onUpdate={() => guard(updatePerf)} loading={ld.perf} label="최신 분기 업데이트" />
            <LogBadge log={logs.perf} />
          </div>
        </SHdr>
        {/* 서브탭 */}
        <div style={{display:"flex",gap:0,borderBottom:"1px solid "+BD,marginBottom:18}}>
          {[["quarterly","📊 분기별"],["annual","📈 연간"],["rd","🔬 R&D & CapEx"],["fsd_data","📡 FSD 지표"]].map(([v,l]) => (
            <button key={v} onClick={() => setPerfSub(v)}
              style={{fontFamily:"'Space Mono',monospace",fontSize:9,letterSpacing:1,padding:"9px 16px",border:"none",
                borderBottom:"2px solid "+(perfSub===v?R:"transparent"),
                background:perfSub===v?"rgba(227,25,55,.07)":"transparent",
                color:perfSub===v?R:MU,cursor:"pointer"}}>{l}</button>
          ))}
        </div>

        {perfSub === "quarterly" && (
          <div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
              <KPI label="Q1'26 총 매출" value="$22.4B" sub="YoY +16%" />
              <KPI label="자동차" value="$16.2B" sub="+16%" color={R} />
              <KPI label="에너지" value="$2.4B" sub="-12%" color={AC} />
              <KPI label="서비스/FSD" value="$3.75B" sub="+42%" color={GR} />
              <KPI label="총이익률" value="21.1%" sub="5분기 최고" color={YL} />
              <KPI label="EPS(비GAAP)" value="$0.41" sub="컨센 +17%" color={GR} />
              <KPI label="R&D 지출" value="$1.95B" sub="매출 9% · YoY +38%" color={AC} badge="NEW" />
              <KPI label="FCF" value="$1.44B" sub="음전환 예고" color={YL} />
            </div>
            {/* CapEx 경고 배너 */}
            <div style={{...card,marginBottom:14,borderColor:"rgba(227,25,55,.5)",background:"rgba(227,25,55,.06)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:22}}>⚠️</div>
                <div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:R,letterSpacing:2,marginBottom:3}}>2026 CAPEX SHOCK</div>
                  <div style={{fontSize:12,color:TX,lineHeight:1.6}}>
                    2026년 CapEx 가이던스 <strong style={{color:R}}>$25B+</strong> (기존 $20B 대비 25% 상향, 2025년의 3배).
                    <strong style={{color:YL}}> FCF 음전환 예고</strong> — "몇 년간 지속될 대규모 투자 단계" (머스크)
                  </div>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
              <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:MU,alignSelf:"center",letterSpacing:2}}>FILTER:</span>
              {YR_OPTS.map(y => <button key={y} style={fb(yearFil===y)} onClick={() => setYearFil(y)}>{y}</button>)}
            </div>
            <div style={{display:"flex",gap:6,marginBottom:12}}>
              {[["revenue","매출 구성"],["margin","이익률"],["income","영업이익"]].map(([v,l]) => (
                <button key={v} style={fb(perfView===v)} onClick={() => setPerfView(v)}>{l}</button>
              ))}
            </div>
            <div style={{...card,marginBottom:12}}>
              {perfView === "revenue" && (
                <>
                  <div style={lbl}>분기별 사업부문 매출 ($M)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={filtQ} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                      <XAxis dataKey="q" tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} />
                      <YAxis tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(0)+"B"} />
                      <Tooltip content={<RevTip />} />
                      <Legend wrapperStyle={{fontFamily:"'Space Mono',monospace",fontSize:9}} />
                      <Bar dataKey="auto"     name="자동차"     stackId="a" fill={R} />
                      <Bar dataKey="energy"   name="에너지"     stackId="a" fill={AC} />
                      <Bar dataKey="services" name="서비스/FSD" stackId="a" fill={GR} radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
              {perfView === "margin" && (
                <>
                  <div style={lbl}>총이익률 추이 (%)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={filtQ.filter(d => d.gm)} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                      <XAxis dataKey="q" tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} />
                      <YAxis domain={[10,35]} tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} tickFormatter={v => v+"%"} />
                      <Tooltip formatter={v => [v+"%","총이익률"]} />
                      <ReferenceLine y={18} stroke="rgba(255,214,0,.3)" strokeDasharray="4 4" />
                      <Line dataKey="gm" stroke={R} dot={{r:2}} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
              {perfView === "income" && (
                <>
                  <div style={lbl}>영업이익 추이 ($M)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={filtQ.filter(d => d.opInc != null)} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                      <XAxis dataKey="q" tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} />
                      <YAxis tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(1)+"B"} />
                      <Tooltip content={<RevTip />} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,.3)" />
                      <Bar dataKey="opInc" name="영업이익" fill={R} radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
            {/* 데이터 테이블 */}
            <div style={card}>
              <div style={lbl}>{"전체 분기 데이터 ("+quarterly.length+"개 분기) — R&D·CapEx 포함"}</div>
              <div style={{overflowX:"auto",marginTop:10}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Space Mono',monospace",fontSize:9}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid rgba(227,25,55,.3)"}}>
                      {["분기","총매출","자동차","에너지","서비스","총이익률","영업이익","EPS","FCF","R&D","CapEx"].map(h => (
                        <th key={h} style={{padding:"6px 8px",color:h==="R&D"||h==="CapEx"?AC:R,textAlign:"right",fontWeight:400,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...filtQ].reverse().map((d,i) => (
                      <tr key={d.q} style={{borderBottom:"1px solid rgba(255,255,255,.04)",background:i%2?"rgba(255,255,255,.015)":"transparent"}}>
                        <td style={{padding:"5px 8px",color:R,letterSpacing:1}}>{d.q}</td>
                        <td style={{padding:"5px 8px",textAlign:"right"}}>{d.total.toLocaleString()}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:R}}>{d.auto.toLocaleString()}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:AC}}>{d.energy.toLocaleString()}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:GR}}>{d.services.toLocaleString()}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:d.gm>=20?GR:d.gm>=17?YL:R}}>{d.gm != null ? d.gm+"%" : "—"}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:d.opInc>0?"#fff":"#ff6b6b"}}>{d.opInc != null ? d.opInc.toLocaleString() : "—"}</td>
                        <td style={{padding:"5px 8px",textAlign:"right"}}>{d.eps != null ? "$"+d.eps : "—"}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:d.fcf>0?GR:d.fcf<0?"#ff6b6b":MU}}>{d.fcf != null ? d.fcf.toLocaleString() : "—"}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:AC}}>{d.rd != null ? d.rd.toLocaleString() : "—"}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:"#a78bfa"}}>{d.capex != null ? d.capex.toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {perfSub === "annual" && (
          <div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              {[["revenue","매출 구성"],["margin","이익률"],["income","이익 추이"],["rd_capex","R&D·CapEx"]].map(([v,l]) => (
                <button key={v} style={fb(annV===v)} onClick={() => setAnnV(v)}>{l}</button>
              ))}
            </div>
            <div style={{...card,marginBottom:12}}>
              {annV === "revenue" && (
                <>
                  <div style={lbl}>연간 사업부문별 매출</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={ANNUAL} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                      <XAxis dataKey="y" tick={{fontFamily:"'Space Mono',monospace",fontSize:10,fill:MU}} />
                      <YAxis tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(0)+"B"} />
                      <Tooltip content={<RevTip />} /><Legend wrapperStyle={{fontFamily:"'Space Mono',monospace",fontSize:9}} />
                      <Bar dataKey="auto"     name="자동차"     stackId="a" fill={R} />
                      <Bar dataKey="energy"   name="에너지"     stackId="a" fill={AC} />
                      <Bar dataKey="services" name="서비스/FSD" stackId="a" fill={GR} radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
              {annV === "margin" && (
                <>
                  <div style={lbl}>연간 총이익률</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={ANNUAL} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                      <XAxis dataKey="y" tick={{fontFamily:"'Space Mono',monospace",fontSize:10,fill:MU}} />
                      <YAxis domain={[10,30]} tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} tickFormatter={v => v+"%"} />
                      <Tooltip formatter={v => [v+"%","총이익률"]} />
                      <Line dataKey="gm" stroke={R} dot={{r:5,fill:R}} strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
              {annV === "income" && (
                <>
                  <div style={lbl}>연간 영업이익 & 순이익</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={ANNUAL} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                      <XAxis dataKey="y" tick={{fontFamily:"'Space Mono',monospace",fontSize:10,fill:MU}} />
                      <YAxis tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(0)+"B"} />
                      <Tooltip content={<RevTip />} /><Legend wrapperStyle={{fontFamily:"'Space Mono',monospace",fontSize:9}} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,.3)" />
                      <Bar dataKey="opInc"  name="영업이익" fill={R}  radius={[2,2,0,0]} />
                      <Bar dataKey="netInc" name="순이익"   fill={AC} radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
              {annV === "rd_capex" && (
                <>
                  <div style={lbl}>연간 R&D & CapEx ($M)</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={ANNUAL} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                      <XAxis dataKey="y" tick={{fontFamily:"'Space Mono',monospace",fontSize:10,fill:MU}} />
                      <YAxis tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(0)+"B"} />
                      <Tooltip content={<RevTip />} /><Legend wrapperStyle={{fontFamily:"'Space Mono',monospace",fontSize:9}} />
                      <Bar dataKey="rd"    name="R&D"    fill={AC}       opacity={0.85} />
                      <Bar dataKey="capex" name="CapEx"  fill="#a78bfa"  opacity={0.85} />
                      <Line dataKey="opInc" name="영업이익" stroke={R} dot={false} strokeWidth={2} strokeDasharray="5 3" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
            <div style={card}>
              <div style={lbl}>연간 요약 테이블 (R&D·CapEx 포함)</div>
              <div style={{overflowX:"auto",marginTop:10}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Space Mono',monospace",fontSize:9}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid rgba(227,25,55,.3)"}}>
                      {["연도","총매출","자동차","에너지","서비스","총이익률","영업이익","순이익","R&D","CapEx"].map(h => (
                        <th key={h} style={{padding:"7px 10px",color:h==="R&D"?AC:h==="CapEx"?"#a78bfa":R,textAlign:"right",fontWeight:400}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...ANNUAL].reverse().map((d,i) => (
                      <tr key={d.y} style={{borderBottom:"1px solid rgba(255,255,255,.04)",background:i%2?"rgba(255,255,255,.015)":"transparent"}}>
                        <td style={{padding:"7px 10px",color:R,fontWeight:700}}>{d.y}</td>
                        <td style={{padding:"7px 10px",textAlign:"right"}}>{"$"+(d.total/1000).toFixed(1)+"B"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:R}}>{"$"+(d.auto/1000).toFixed(1)+"B"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:AC}}>{"$"+(d.energy/1000).toFixed(1)+"B"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:GR}}>{"$"+(d.services/1000).toFixed(1)+"B"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:d.gm>=22?GR:d.gm>=18?YL:R}}>{d.gm+"%"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:d.opInc>0?"#fff":"#ff6b6b"}}>{"$"+(d.opInc/1000).toFixed(1)+"B"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right"}}>{"$"+(d.netInc/1000).toFixed(1)+"B"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:AC}}>{"$"+(d.rd/1000).toFixed(1)+"B"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:"#a78bfa"}}>{"$"+(d.capex/1000).toFixed(1)+"B"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {perfSub === "rd" && (
          <div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
              <KPI label="Q1'26 R&D"           value="$1.95B" sub="매출 9% · YoY +38%" color={AC} badge="NEW" />
              <KPI label="2025 연간 R&D"        value="$6.74B" sub="YoY +46%"            color={AC} />
              <KPI label="Q1'26 CapEx"          value="$2.49B" sub="YoY +67%"            color="#a78bfa" badge="↑" />
              <KPI label="2026 CapEx 가이던스"  value="$25B+"  sub="2025 $8.5B의 3배"   color={R}  badge="⚠" />
              <KPI label="Terafab 투자액"        value="$3B"    sub="Giga Texas 반도체 팹" color={YL} badge="NEW" />
              <KPI label="FCF Q1'26"             value="$1.44B" sub="음전환 예고"         color={YL} />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
              <div style={card}>
                <div style={lbl}>분기별 R&D 지출 추이 ($M)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={BASE_Q.filter(d => d.rd).slice(-12)} margin={{top:6,right:8,left:0,bottom:0}}>
                    <defs>
                      <linearGradient id="rdg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={AC} stopOpacity={.3} />
                        <stop offset="95%" stopColor={AC} stopOpacity={0}  />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                    <XAxis dataKey="q" tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} />
                    <YAxis tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(1)+"B"} />
                    <Tooltip formatter={v => ["$"+v+"M","R&D"]} />
                    <Area dataKey="rd" stroke={AC} fill="url(#rdg)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={card}>
                <div style={lbl}>CapEx vs FCF (최근 8분기, $M)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={capexFcfData} margin={{top:6,right:8,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                    <XAxis dataKey="q" tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} />
                    <YAxis tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(1)+"B"} />
                    <Tooltip content={<RevTip />} /><Legend wrapperStyle={{fontFamily:"'Space Mono',monospace",fontSize:9}} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,.3)" />
                    <Bar dataKey="capex" name="CapEx" fill="#a78bfa" opacity={0.85} />
                    <Line dataKey="fcf" name="FCF" stroke={GR} dot={{r:3}} strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Terafab 상세 */}
            <div style={{...card,borderColor:"rgba(255,214,0,.35)",background:"rgba(255,214,0,.04)"}}>
              <div style={{...lbl,color:YL}}>TERAFAB — 테슬라 반도체 R&D 팹</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginTop:12}}>
                {[
                  ["📍 위치","Giga Texas (오스틴)","착공 2026.04.22"],
                  ["💰 투자","Tesla 단독 $3B","전체 프로젝트: $55B~$119B"],
                  ["🤝 파트너","Intel (14A 공정)","SpaceX·xAI 공동"],
                  ["⚙️ 역할","월 수천 장 웨이퍼","반도체 물리학 검증"],
                  ["🎯 목적","AI5 칩·FSD HW 자체조달","AI 컴퓨팅 독립"],
                  ["📅 전략","15년 장기 프로젝트","고용 유지·증가"],
                ].map(([icon,main,sub],i) => (
                  <div key={i} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",borderRadius:3,padding:"12px 14px"}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:YL,marginBottom:6}}>{icon}</div>
                    <div style={{fontSize:12,fontWeight:700,color:TX,marginBottom:4}}>{main}</div>
                    <div style={{fontSize:10,color:MU,lineHeight:1.5}}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {perfSub === "fsd_data" && (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <div style={{...lbl,marginBottom:0}}>{"마지막 업데이트: "+fsdMiles.updatedDate+" · 출처: tesla.com/VehicleSafetyReport"}</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <AIBtn onUpdate={()=>guard(updateFsd)} loading={ldFsd} label="FSD 마일 업데이트" />
                <LogBadge log={logs.fsd} />
              </div>
            </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
              <KPI label="FSD 구독자" value="128만명" sub="Q1'26 · YoY +51%" color={AC} badge="NEW" />
              <KPI label="FSD ARR"    value="$5.46억" sub="연간 반복매출"     color={GR} badge="NEW" />
              <KPI label="FSD 취득률" value="~14%"   sub="누적 인도 920만대 대비" color={YL} badge="NEW" />
              <KPI label="구독자(월정액)" value="476,100명" sub="$546M ARR"   color={AC} />
              <KPI label="일시불 구매자"  value="823,900명" sub="2026.02 폐지" color={MU} />
              <KPI label="FSD 누적 주행" value={(fsdMiles.totalMiles/1e9).toFixed(2)+"B 마일"} sub={"목표 100억 마일 달성! · 일 "+Math.round(fsdMiles.dailyMiles/1e6)+"M 마일"} color={GR} badge="✅" />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
              <div style={card}>
                <div style={lbl}>FSD 활성 구독자 추이 (백만명)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={FSD_SUBS} margin={{top:6,right:8,left:0,bottom:0}}>
                    <defs>
                      <linearGradient id="fsdg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={AC} stopOpacity={.4} />
                        <stop offset="95%" stopColor={AC} stopOpacity={0}  />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                    <XAxis dataKey="q" tick={{fontFamily:"'Space Mono',monospace",fontSize:9,fill:MU}} />
                    <YAxis domain={[0,1.5]} tick={{fontFamily:"'Space Mono',monospace",fontSize:8,fill:MU}} tickFormatter={v => v+"M"} />
                    <Tooltip formatter={v => [v+"M명","구독자"]} />
                    <Area dataKey="subs" stroke={AC} fill="url(#fsdg)" strokeWidth={2} dot={{r:4,fill:AC}} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={card}>
                <div style={lbl}>누적 주행 마일 목표 달성률</div>
                <div style={{marginTop:20}}>
                  {/* 동적 게이지 */}
                  {(() => {
                    const pct = Math.min((fsdMiles.totalMiles / 10e9) * 100, 100);
                    const done = fsdMiles.totalMiles >= 10e9;
                    const cityPct = ((fsdMiles.cityMiles / fsdMiles.totalMiles) * 100).toFixed(1);
                    return (
                      <>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:12}}>
                          <span style={{color:MU}}>누적 주행</span>
                          <span style={{fontFamily:"'Space Mono',monospace",color:done?GR:AC}}>{(fsdMiles.totalMiles/1e9).toFixed(3)+"B 마일"}</span>
                        </div>
                        <div style={{height:20,background:"rgba(255,255,255,.06)",borderRadius:10,overflow:"hidden",marginBottom:8,position:"relative"}}>
                          <div style={{height:"100%",width:pct+"%",background:done?"linear-gradient(90deg,"+GR+",#00ff88)":"linear-gradient(90deg,"+AC+","+GR+")",borderRadius:10,transition:"width 1s ease"}} />
                          {done && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",fontSize:9,color:"#000",fontWeight:700}}>✅ 100억 마일 달성!</div>}
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:MU}}>
                          <span>0</span>
                          <span style={{color:done?GR:YL}}>{pct.toFixed(1)+"% 달성"}</span>
                          <span>목표 100억 마일</span>
                        </div>
                        <div style={{marginTop:14,fontSize:11,color:MU,lineHeight:1.7}}>
                          📌 <strong style={{color:GR}}>2026.05.03 공식 100억 마일 돌파</strong> — Tesla X 공식 발표<br/>
                          📌 도심 주행: {(fsdMiles.cityMiles/1e9).toFixed(2)}B 마일 (전체의 {cityPct}%)<br/>
                          📌 현재 일 {Math.round(fsdMiles.dailyMiles/1e6)}M 마일 추가 중 · 충돌 1건/{""+Math.round(fsdMiles.collisionPer/1e6)}M 마일<br/>
                          📌 vs 미국 평균 운전자: 충돌 1건/{""+Math.round(fsdMiles.vsHuman/1000)+"K"} 마일 (<strong style={{color:GR}}>{""+Math.round(fsdMiles.collisionPer/fsdMiles.vsHuman)+"배 안전"}</strong>)<br/>
                          📌 <strong style={{color:TX}}>데이터 출처: tesla.com/VehicleSafetyReport (공식)</strong>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div style={card}>
              <div style={lbl}>FSD 글로벌 승인 현황 (2026.06 기준)</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginTop:14}}>
                <div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:GR,letterSpacing:2,marginBottom:8}}>✅ 승인 완료</div>
                  {[["🇺🇸 미국 (감독하)","FSD v14.3.3 · 전국"],["🇺🇸 로보택시 (무감독)","오스틴·달라스·휴스턴"],["🇨🇦 캐나다","운영 중"],["🇳🇱 네덜란드","유럽 첫 승인"],["🇲🇽 멕시코","운영 중"]].map(([c,s],i) => (
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:11}}>
                      <span style={{color:MU}}>{c}</span><span style={{fontFamily:"'Space Mono',monospace",color:GR,fontSize:9}}>{s}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:YL,letterSpacing:2,marginBottom:8}}>🟡 심사 진행 중 (12개국)</div>
                  {[["🇨🇳 중국","Q3'26 전면 승인 예상"],["🇧🇪 벨기에","5,000km 테스트 완료"],["🇪🇸 스페인","80,000km 무사고 완료"],["🇬🇧 영국","2026년 승인 예상"],["🇫🇷 프랑스","EU 심의 연동"],["🇦🇺 호주·뉴질랜드","v14 테스트 중"]].map(([c,s],i) => (
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:11}}>
                      <span style={{color:MU}}>{c}</span><span style={{fontFamily:"'Space Mono',monospace",color:YL,fontSize:9}}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{marginTop:14,borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:14}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:AC,letterSpacing:2,marginBottom:8}}>FSD 비즈니스 모델 전환</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  {[
                    ["구독 전용 전환","2026.02.14 일시불 폐지. 월정액만 가능. 예측 가능한 반복 매출 확보.",AC],
                    ["가격 인상 예고","기능 고도화에 따라 구독료 인상 계획. 현재 북미 $99/월.",YL],
                    ["CEO 보상 연계","FSD 구독자 1,000만명 달성 조건. 현재 128만명 (12.8%).",R],
                  ].map(([t,d,c],i) => (
                    <div key={i} style={{background:c+"0d",border:"1px solid "+c+"30",borderRadius:3,padding:"10px 12px"}}>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:c,marginBottom:5}}>{t}</div>
                      <div style={{fontSize:10,color:MU,lineHeight:1.6}}>{d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── ROADMAP ── */
  const RoadmapTab = () => (
    <div>
      <SHdr sub="PRODUCT INTELLIGENCE" title="제품 포트폴리오 & 로드맵" />
      <div style={{...card,marginBottom:16,borderColor:"rgba(227,25,55,.5)",background:"rgba(227,25,55,.06)"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
          <div style={{fontSize:28,flexShrink:0}}>🪦</div>
          <div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,fontWeight:700,color:R,marginBottom:6}}>MODEL S · MODEL X — 명예로운 퇴역 (2026 Q2)</div>
            <div style={{fontSize:12,color:TX,lineHeight:1.7}}>
              머스크 Q4'25 어닝콜: <em style={{color:YL}}>"이제 Model S와 X를 명예로운 퇴역으로 종료할 시간입니다."</em><br/>
              2012년(S)·2015년(X) 출시 이후 누적 75.5만대 생산. 2025년 인도량 단 3% 수준으로 전락.<br/>
              <strong style={{color:GR}}>Fremont 해당 라인 → Optimus 100만대/년 라인 전환 (6~8개월 소요)</strong>
            </div>
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        {[
          {n:"Model 3 / Model Y",  st:"PRODUCTION",        sc:"live",d:"핵심 볼륨 모델. 상하이·프리몬트·베를린 생산. 195만대/년.",ex:"195만대/년",ec:GR},
          {n:"Cybertruck",          st:"PRODUCTION",        sc:"live",d:"스테인리스 풀사이즈 픽업. 텍사스 생산. 수율 안정화.",ex:">12.5만대/년",ec:GR},
          {n:"Cybercab (로보택시)", st:"PILOT PRODUCTION",  sc:"ramp",d:"핸들·페달 없는 완전자율주행 택시. 달라스·휴스턴 무감독 운영. 생산 사이클 10초 목표(Model Y 34초).",ex:"무사고 운행 · 10초 생산 목표",ec:YL},
          {n:"Optimus V3",          st:"DEV → PRODUCTION",  sc:"dev", d:"Q1'26 V3 공개. Fremont 라인 설치 중. 목표: 100만대/년 · 단가 $20,000. 2027년 텍사스 2공장.",ex:"100만대/년 목표 · $20K 목표가",ec:AC},
          {n:"Megapack / Powerwall",st:"PRODUCTION",        sc:"live",d:"에너지 저장. 2025년 $12.8B (+27% YoY). CA·상하이·TX 생산.",ex:"$12.8B · +27% YoY",ec:GR},
          {n:"FSD",                 st:"SCALING",           sc:"ramp",d:"v14.3.3. 구독자 128만명(+51%). 취득률 14%. ARR $546M. 네덜란드 첫 유럽 승인.",ex:"ARR $546M · 12개국 심사",ec:YL},
          {n:"Tesla Semi",          st:"PILOT PRODUCTION",  sc:"ramp",d:"전기 대형트럭. 2026년 생산 돌입 예정.",ex:"2026년 양산 목표",ec:YL},
          {n:"Terafab",             st:"UNDER CONSTRUCTION",sc:"dev", d:"Giga Texas $3B 반도체 R&D 팹. Intel 14A. SpaceX·xAI 공동. 착공 2026.04.22.",ex:"$3B · Intel 14A · 착공 완료",ec:AC},
        ].map((p,i) => {
          const sc = {live:{bg:"rgba(0,230,118,.15)",c:GR},ramp:{bg:"rgba(255,214,0,.15)",c:YL},dev:{bg:"rgba(0,212,255,.15)",c:AC}}[p.sc];
          return (
            <div key={i} style={card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:12,fontWeight:700,color:"#fff"}}>{p.n}</div>
                <span style={{background:sc.bg,color:sc.c,fontFamily:"'Space Mono',monospace",fontSize:7,padding:"2px 7px",borderRadius:2,whiteSpace:"nowrap"}}>{p.st}</span>
              </div>
              <div style={{fontSize:11,color:MU,lineHeight:1.65,marginBottom:8}}>{p.d}</div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:p.ec}}>{p.ex}</div>
            </div>
          );
        })}
      </div>
      <div style={card}>
        <div style={lbl}>2026~2030 시나리오</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:12}}>
          {[
            ["BULL","$1,200+",GR,"rgba(0,230,118,.06)","rgba(0,230,118,.2)","Robotaxi 네트워크 효과·Optimus 대량생산·FSD 전세계 승인·Terafab 칩 자체조달"],
            ["BASE 2026","$350~450","#fff","rgba(227,25,55,.06)",BD,"CapEx $25B 부담·Cybercab 양산 지연·유럽 FSD 지연"],
            ["VISION 2030","$700~1,000",YL,"rgba(255,214,0,.06)","rgba(255,214,0,.2)","자동차 46%→, Robotaxi·Optimus·에너지 분산. AI 플랫폼 기업 전환"],
          ].map(([l,v,vc,bg,br,d],i) => (
            <div key={i} style={{background:bg,border:"1px solid "+br,borderRadius:4,padding:14}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:vc,letterSpacing:2,marginBottom:6}}>{l}</div>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:16,fontWeight:700,color:vc,marginBottom:6}}>{v}</div>
              <div style={{fontSize:10,color:MU,lineHeight:1.6}}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── RISK ── */
  const RiskTab = () => (
    <div>
      <SHdr sub="RISK & OUTLOOK" title="리스크 매트릭스 & 종합 전망" />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div style={card}>
          <div style={lbl}>핵심 리스크 레이더</div>
          {[["CapEx $25B 과부하",90,R,"NEW"],["경쟁 심화 (BYD·中)",88,R,null],["FSD 규제 지연",80,R,null],["머스크 집중 리스크",75,R,null],["Optimus 생산 불확실성",72,YL,"NEW"],["유럽 브랜드 부진",70,YL,null],["Terafab 실행 리스크",65,YL,"NEW"],["배터리 공급 제약",55,YL,null],["재무 유동성",25,GR,null]].map(([l,p,c,badge],i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginTop:11}}>
              <div style={{width:140,fontSize:10,color:MU,flexShrink:0,display:"flex",alignItems:"center",gap:5}}>
                {l}
                {badge && <span style={{background:c+"20",border:"1px solid "+c+"50",color:c,fontSize:7,padding:"1px 4px",borderRadius:2}}>{badge}</span>}
              </div>
              <div style={{flex:1,height:6,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:p+"%",background:c,borderRadius:3}} />
              </div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:MU,width:28,textAlign:"right"}}>{p+"%"}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{...card,marginBottom:12}}>
            <div style={lbl}>2026 핵심 모니터링</div>
            {[["🔴 CapEx $25B 집행 속도","FCF 음전환 타이밍",R],["🔴 Cybercab 양산 전환","핵심 밸류에이션 변수",R],["🔴 Optimus 2026 생산량","머스크 '예측 불가'",R],["🟡 FSD 중국 전면 승인","Q3'26 목표",YL],["🟡 Terafab 건설 진척","Intel 파트너십",YL],["🟡 FSD 구독자 증가율","CEO 보상 마일스톤",YL],["🟢 에너지 사업 성장","안정 +27%",GR],["🟢 FSD ARR $546M","고마진 반복매출",GR]].map(([l,v,c],i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:11}}>
                <span style={{color:MU}}>{l}</span><span style={{fontFamily:"'Space Mono',monospace",color:c,fontSize:9}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={lbl}>CEO 리스크 특이사항</div>
            <div style={{fontSize:11,color:MU,lineHeight:1.8,marginTop:8}}>
              2026.06.05 트럼프 Epstein 파일 언급 → <strong style={{color:R}}>당일 주가 -14.3% 급락</strong>.<br/>
              DOGE 참여로 유럽 판매 <strong style={{color:R}}>-39%</strong>(2025). 퇴임 후 Q1'26 회복.<br/>
              Terafab은 SpaceX·xAI와의 이해충돌 가능성 내재.
            </div>
          </div>
        </div>
      </div>
      <div style={card}>
        <div style={lbl}>종합 결론</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginTop:12}}>
          {[
            ["TESLA 2026 투자 테제",R,"CapEx $25B 충격은 단기 FCF 압박이나, AI 인프라·Optimus·Terafab 투자가 2027~28년 수익으로 연결되는 구조. FSD ARR·에너지 성장이 버퍼 역할. 현재 216x PER은 AI·자율주행 테제 프리미엄."],
            ["FSD → ROBOTAXI → OPTIMUS 로드맵",AC,"FSD 취득률 14%·구독 전용 전환이 반복 수익 기반 구축. 10억 마일 목표 도달 시 무감독 FSD 전면화. Robotaxi 확장 → Optimus 양산이 순차적 밸류에이션 리레이팅 핵심."],
          ].map(([t,c,d],i) => (
            <div key={i}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:c,letterSpacing:2,marginBottom:8}}>{t}</div>
              <div style={{fontSize:11,color:MU,lineHeight:1.8}}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── EARNINGS ── */
  const EarningsTab = () => (
    <div>
      <SHdr sub="EARNINGS CALL ARCHIVE" title="어닝콜 발언 아카이브">
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <AIBtn onUpdate={() => guard(updateEarnings)} loading={ld.earnings} label="최신 어닝콜 업데이트" />
          <LogBadge log={logs.earnings} />
        </div>
      </SHdr>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <input style={{...inp,flex:1,minWidth:180}} placeholder="🔍 분기·키워드·태그 검색..." value={eSearch} onChange={e => setESearch(e.target.value)} />
        <button style={{...fb(true),padding:"7px 14px"}} onClick={() => setShowForm(!showForm)}>{showForm ? "✕ 닫기" : "+ 직접 추가"}</button>
      </div>
      {showForm && (
        <div style={{...card,marginBottom:12,borderColor:"rgba(0,212,255,.4)"}}>
          <div style={{...lbl,color:AC}}>MANUAL ENTRY</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}}>
            <div><div style={{fontSize:9,color:MU,marginBottom:2}}>분기</div><input style={{...inp,width:"100%"}} value={nc.q} onChange={e => setNc({...nc,q:e.target.value})} /></div>
            <div><div style={{fontSize:9,color:MU,marginBottom:2}}>날짜</div><input style={{...inp,width:"100%"}} type="date" value={nc.date} onChange={e => setNc({...nc,date:e.target.value})} /></div>
            <div><div style={{fontSize:9,color:MU,marginBottom:2}}>감성</div>
              <select style={{...inp,width:"100%"}} value={nc.sentiment} onChange={e => setNc({...nc,sentiment:e.target.value})}>
                <option value="positive">▲ 긍정</option><option value="mixed">◆ 혼조</option><option value="negative">▼ 부진</option>
              </select></div>
          </div>
          <div style={{marginTop:7}}><div style={{fontSize:9,color:MU,marginBottom:2}}>헤드라인</div><input style={{...inp,width:"100%"}} value={nc.headline} onChange={e => setNc({...nc,headline:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 3fr",gap:8,marginTop:7}}>
            <div><div style={{fontSize:9,color:MU,marginBottom:2}}>발언자</div><input style={{...inp,width:"100%"}} value={nc.s1} onChange={e => setNc({...nc,s1:e.target.value})} /></div>
            <div><div style={{fontSize:9,color:MU,marginBottom:2}}>발언</div><input style={{...inp,width:"100%"}} value={nc.q1} onChange={e => setNc({...nc,q1:e.target.value})} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginTop:7}}>
            {[["r","매출"],["e","EPS"],["g","총이익률"],["o","영업이익"],["rd","R&D"],["capex","CapEx"]].map(([k,l]) => (
              <div key={k}><div style={{fontSize:9,color:MU,marginBottom:2}}>{l}</div><input style={{...inp,width:"100%"}} value={nc[k]} onChange={e => setNc({...nc,[k]:e.target.value})} /></div>
            ))}
          </div>
          <div style={{marginTop:7}}><div style={{fontSize:9,color:MU,marginBottom:2}}>태그 (쉼표 구분)</div><input style={{...inp,width:"100%"}} value={nc.tags} onChange={e => setNc({...nc,tags:e.target.value})} /></div>
          <div style={{display:"flex",gap:7,marginTop:10}}>
            <button onClick={addCall} style={{background:"rgba(227,25,55,.2)",border:"1px solid "+R,color:R,padding:"6px 16px",borderRadius:3,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9}}>저장</button>
            <button onClick={() => setShowForm(false)} style={{background:"transparent",border:"1px solid rgba(255,255,255,.15)",color:MU,padding:"6px 16px",borderRadius:3,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9}}>취소</button>
          </div>
        </div>
      )}
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:MU,marginBottom:8,letterSpacing:2}}>{"ARCHIVE — "+filtCalls.length+"건 (R&D·CapEx 포함)"}</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtCalls.map(c => {
          const st = SENT_ST[c.sentiment];
          const open = openCall === c.id;
          return (
            <div key={c.id} style={{background:"#141420",border:"1px solid "+st.br,borderLeft:"3px solid "+st.c,borderRadius:4,overflow:"hidden"}}>
              <div style={{padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"flex-start",gap:10,flexWrap:"wrap"}} onClick={() => setOpenCall(open ? null : c.id)}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:11,fontWeight:700,color:st.c,minWidth:55}}>{c.q}</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:MU,minWidth:80}}>{c.date}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:TX,marginBottom:c.highlight?3:0}}>{c.headline}</div>
                  {c.highlight && <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:st.c}}>{c.highlight}</div>}
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{c.tags.slice(0,3).map(t => <span key={t} style={{background:"rgba(227,25,55,.1)",border:"1px solid rgba(227,25,55,.25)",color:R,fontFamily:"'Space Mono',monospace",fontSize:7,padding:"2px 5px",borderRadius:2}}>{t}</span>)}</div>
                <div style={{color:MU,fontSize:10}}>{open ? "▲" : "▼"}</div>
              </div>
              {open && (
                <div style={{padding:"0 14px 12px",borderTop:"1px solid rgba(255,255,255,.05)"}}>
                  <div style={{display:"flex",gap:8,marginTop:8,marginBottom:10,flexWrap:"wrap"}}>
                    {Object.entries(c.m).map(([k,v]) => v ? (
                      <div key={k} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:3,padding:"4px 10px"}}>
                        <div style={{fontFamily:"'Space Mono',monospace",fontSize:7,color:k==="rd"||k==="capex"?AC:MU,letterSpacing:2,marginBottom:1}}>{k==="rd"?"R&D":k==="capex"?"CAPEX":k.toUpperCase()}</div>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:12,fontWeight:700,color:k==="rd"||k==="capex"?AC:st.c}}>{v}</div>
                      </div>
                    ) : null)}
                  </div>
                  {c.quotes.map((q,i) => (
                    <div key={i} style={{background:"rgba(227,25,55,.04)",borderLeft:"2px solid rgba(227,25,55,.4)",padding:"7px 12px",marginBottom:6,borderRadius:"0 3px 3px 0"}}>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:R,marginBottom:3}}>{q.s}</div>
                      <div style={{fontSize:12,color:TX,lineHeight:1.7,fontStyle:"italic"}}>{"\""+q.t+"\""}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── X TAB ── */
  const XTab = () => (
    <div>
      <SHdr sub="X POST TIMELINE" title="머스크 X 발언 아카이브">
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <AIBtn onUpdate={() => guard(updateXPost)} loading={ld.xpost} label="최신 발언 업데이트" />
          <LogBadge log={logs.xpost} />
        </div>
      </SHdr>
      <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
        <input style={{...inp,minWidth:180}} placeholder="🔍 키워드 검색..." value={xSrch} onChange={e => setXSrch(e.target.value)} />
        <button style={{...fb(true),marginLeft:"auto"}} onClick={() => setXLang(xLang === "ko" ? "en" : "ko")}>{xLang === "ko" ? "🇰🇷 한국어" : "🇺🇸 English"}</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {XCATS.map(c => <button key={c} style={fb(xCat === c)} onClick={() => setXCat(c)}>{c}</button>)}
      </div>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:MU,marginBottom:10,letterSpacing:2}}>{"총 "+filtPosts.length+"건 · "}<span style={{color:R}}>● HIGH</span>{" "}<span style={{color:YL}}>● MED</span></div>
      <div style={{position:"relative",paddingLeft:26}}>
        <div style={{position:"absolute",left:7,top:0,bottom:0,width:1,background:"linear-gradient(to bottom,"+R+",transparent)"}} />
        {filtPosts.map(p => (
          <div key={p.id} style={{position:"relative",marginBottom:12}}>
            <div style={{position:"absolute",left:-22,top:5,width:11,height:11,borderRadius:"50%",background:IMP_C[p.impact],border:"2px solid "+DK,boxShadow:"0 0 6px "+IMP_C[p.impact]+"80"}} />
            <div style={{...card,borderLeft:"2px solid "+IMP_C[p.impact]+"50"}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7,flexWrap:"wrap"}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:IMP_C[p.impact]}}>{p.date}</span>
                <span style={{background:"rgba(227,25,55,.12)",border:"1px solid rgba(227,25,55,.3)",color:R,fontFamily:"'Space Mono',monospace",fontSize:7,padding:"2px 5px",borderRadius:2}}>{p.cat}</span>
                <span style={{background:IMP_C[p.impact]+"18",border:"1px solid "+IMP_C[p.impact]+"50",color:IMP_C[p.impact],fontFamily:"'Space Mono',monospace",fontSize:7,padding:"2px 5px",borderRadius:2}}>{p.impact.toUpperCase()}</span>
                <span style={{marginLeft:"auto",fontFamily:"'Space Mono',monospace",fontSize:9,color:MU}}>{"♥"+p.likes+" ↺"+p.reposts}</span>
              </div>
              <div style={{fontSize:12,color:TX,lineHeight:1.75,fontStyle:"italic",marginBottom:7,borderLeft:"2px solid rgba(29,155,240,.4)",paddingLeft:10}}>
                {"\""+(xLang === "ko" ? p.ko : p.en)+"\""}
              </div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:MU}}>{"📌 "+p.ctx}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── OWNERSHIP ── */
  const OwnershipTab = () => {
    const curPrice = stock.price;

    function PieTip({active,payload}) {
      if (!active||!payload?.length) return null;
      const d = payload[0].payload;
      return (
        <div style={{background:"#1a1a28",border:"1px solid "+d.color+"60",borderRadius:4,padding:"8px 12px",fontFamily:"'Space Mono',monospace",fontSize:10}}>
          <div style={{color:d.color,fontWeight:700,marginBottom:2}}>{d.name}</div>
          <div style={{color:"#fff"}}>{d.value+"% · "+d.shares}</div>
        </div>
      );
    }

    return (
      <div>
        <SHdr sub="OWNERSHIP & INSTITUTIONAL ACTIVITY" title="지분현황 & 기관 동향">
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <AIBtn onUpdate={() => guard(updateOwnership)} loading={ld.ownership} label="기관 동향 업데이트" />
            <LogBadge log={logs.ownership} />
          </div>
        </SHdr>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
          <KPI label="총 발행주식" value="~3.76B주"  sub="2026.06" />
          <KPI label="일론 머스크" value="13.8%"     sub="717M주"  color={R} />
          <KPI label="기관 투자자" value="41.7%"     sub="4,500+ 기관" color={AC} />
          <KPI label="리테일"      value="35.1%"     color={GR} />
          <KPI label="내부자 합계" value="23.2%"     color={YL} />
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div style={card}>
            <div style={lbl}>주주 구성</div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={OWNERSHIP} cx="50%" cy="50%" outerRadius={90} innerRadius={42} dataKey="value" label={({value}) => value+"%"} labelLine={false}>
                  {OWNERSHIP.map((e,i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={card}>
            <div style={lbl}>주요 주주 현황</div>
            {OWNERSHIP.map((d,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:d.color,flexShrink:0}} />
                <div style={{flex:1,fontSize:11,color:TX}}>{d.name}</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:MU,minWidth:52,textAlign:"right"}}>{d.shares}</div>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,color:d.color,minWidth:38,textAlign:"right"}}>{d.value+"%"}</div>
                <div style={{width:44,height:4,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",background:d.color,width:((d.value/36)*100)+"%",borderRadius:3}} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 목표가 타임라인 */}
        <div style={{...card,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={lbl}>기관별 목표가 타임라인</div>
              <div style={{fontSize:10,color:MU}}>{"공시일 기준 최신순 · 현재가 $"+curPrice.toFixed(2)+" 기준 상승여력"}</div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[["컨센서스 평균","$404~420",MU],["최고 목표가","$4,600",GR],["최저 목표가","$125",R]].map(([l,v,c],i) => (
                <div key={i} style={{background:c+"10",border:"1px solid "+c+"30",borderRadius:3,padding:"5px 12px",textAlign:"center"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:MU,letterSpacing:1,marginBottom:2}}>{l}</div>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,fontWeight:700,color:c}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {/* JP모건 배너 */}
          <div style={{background:"rgba(0,212,255,0.06)",border:"1px solid rgba(0,212,255,0.3)",borderRadius:3,padding:"10px 14px",marginBottom:14,display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{fontSize:20,flexShrink:0}}>🔥</div>
            <div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:AC,letterSpacing:2,marginBottom:4}}>2026.06.05 — JPMORGAN 11년 만의 관점 전환</div>
              <div style={{fontSize:11,color:TX,lineHeight:1.7}}>
                Ryan Brinkman(2015~, $145 고수) → Rajat Gupta 교체 후 <strong style={{color:AC}}>Underweight → Neutral, $145 → $475 (+228%)</strong>.
                논거: "TSLA is at the forefront of physical AI" · 수직 통합 재평가 · EPS 2030 $7.50.
                <span style={{color:YL}}> ※ 당일 주가 -6.56% — Jamie Dimon의 SpaceX IPO 관련 머스크 초청(전날)과 타이밍 겹쳐 시장 불신 존재.</span>
              </div>
            </div>
          </div>
          {/* 목표가 테이블 */}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Space Mono',monospace",fontSize:10}}>
              <thead>
                <tr style={{borderBottom:"1px solid rgba(227,25,55,.3)"}}>
                  {["공시일","기관","애널리스트","레이팅","목표가","현재가 대비","핵심 논거"].map(h => (
                    <th key={h} style={{padding:"8px 10px",color:R,textAlign:"left",fontWeight:400,letterSpacing:1,whiteSpace:"nowrap",fontSize:9}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ANALYST_TARGETS.map((a,i) => {
                  const upside = ((a.tp / curPrice - 1) * 100).toFixed(1);
                  const isUp   = a.tp >= curPrice;
                  return (
                    <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,.04)",background:i%2?"rgba(255,255,255,.015)":"transparent"}}>
                      <td style={{padding:"8px 10px",color:MU,whiteSpace:"nowrap",fontSize:9}}>{a.date}</td>
                      <td style={{padding:"8px 10px",fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,color:"#fff",whiteSpace:"nowrap"}}>{a.inst}</td>
                      <td style={{padding:"8px 10px",color:MU,fontSize:9,whiteSpace:"nowrap"}}>{a.analyst}</td>
                      <td style={{padding:"8px 10px"}}>
                        <span style={{background:a.color+"15",border:"1px solid "+a.color+"40",color:a.color,fontSize:8,padding:"2px 6px",borderRadius:2,whiteSpace:"nowrap"}}>{a.rating}</span>
                      </td>
                      <td style={{padding:"8px 10px",fontFamily:"'Orbitron',monospace",fontSize:12,fontWeight:700,color:a.color,whiteSpace:"nowrap"}}>{"$"+a.tp.toLocaleString()}</td>
                      <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:isUp?GR:R}}>{(isUp?"▲":"▼")+Math.abs(upside)+"%"}</span>
                      </td>
                      <td style={{padding:"8px 10px",fontSize:10,color:MU,lineHeight:1.5}}>
                        {a.reason}
                        {a.badge && <span style={{marginLeft:6,background:"rgba(255,214,0,.15)",border:"1px solid rgba(255,214,0,.4)",color:YL,fontSize:7,padding:"1px 5px",borderRadius:2}}>{a.badge}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:10,padding:"7px 10px",background:"rgba(255,255,255,.025)",borderRadius:3,fontSize:10,color:MU,lineHeight:1.8}}>
            {"📌 ARK $4,600 vs JPMorgan 구 $145 → 신 $475 — 월가 역대 최대 견해 차이"}<br/>
            {"📌 현재가 $"+curPrice.toFixed(0)+" 기준 컨센서스 $404~420 — 현재가와 유사, 즉 '적정 가격' 판단 우세"}
          </div>
        </div>

        {/* 기관 매매 타임라인 */}
        <div style={card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:7}}>
            <div style={lbl}>{"기관 투자자 매수·매도 타임라인 ("+instActs.length+"건)"}</div>
            <div style={{display:"flex",gap:5}}>
              {["ALL","BUY","SELL","HOLD","RATE"].map(f => (
                <button key={f} style={{...fb(instFil===f),color:instFil===f&&f==="BUY"?GR:instFil===f&&f==="SELL"?R:instFil===f&&f==="RATE"?AC:undefined,borderColor:instFil===f&&f==="BUY"?GR:instFil===f&&f==="SELL"?R:instFil===f&&f==="RATE"?AC:undefined}} onClick={() => setInstFil(f)}>{f}</button>
              ))}
            </div>
          </div>
          {filtInst.map(d => (
            <div key={d.id} style={{display:"flex",gap:10,padding:"9px 11px",background:"rgba(255,255,255,.02)",borderRadius:3,border:"1px solid "+ACT_C[d.action]+"20",borderLeft:"3px solid "+ACT_C[d.action],marginBottom:6,flexWrap:"wrap",alignItems:"flex-start"}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:MU,minWidth:85,flexShrink:0}}>{d.date}</div>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,color:"#fff",minWidth:110,flexShrink:0}}>{d.inst}</div>
              <span style={{background:ACT_C[d.action]+"18",border:"1px solid "+ACT_C[d.action]+"40",color:ACT_C[d.action],fontFamily:"'Space Mono',monospace",fontSize:8,padding:"2px 6px",borderRadius:2,flexShrink:0}}>{d.action}</span>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#fff",minWidth:65}}>{d.amt}</div>
              <span style={{background:SENT_C[d.sent]+"15",border:"1px solid "+SENT_C[d.sent]+"35",color:SENT_C[d.sent],fontFamily:"'Space Mono',monospace",fontSize:8,padding:"2px 5px",borderRadius:2,flexShrink:0}}>{d.sent}</span>
              <div style={{flex:1,fontSize:11,color:MU,lineHeight:1.5,minWidth:130}}>{d.note}</div>
            </div>
          ))}
        </div>

        {/* 리셋 패널 */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:10,marginTop:12}}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:MU,letterSpacing:1}}>{"💾 Storage: "+(storageReady?"연결됨":"로드 중...")}</div>
          <button onClick={() => guard(resetStorage)} style={{background:"rgba(227,25,55,.08)",border:"1px solid rgba(227,25,55,.3)",color:"rgba(227,25,55,.7)",fontFamily:"'Space Mono',monospace",fontSize:9,padding:"4px 12px",borderRadius:3,cursor:"pointer",letterSpacing:1}}>⟳ 데이터 초기화</button>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */
  const TABS = [
    ["company","🏢 컴퍼니"],["ceo","👤 CEO"],["values","💡 가치관"],
    ["perf","📊 실적"],["roadmap","🚀 로드맵"],["risk","⚠️ 리스크"],
    ["earnings","🎙 어닝콜"],["xposts","𝕏 X발언"],["ownership","🏦 지분"],
  ];

  const anyLoading = Object.values(ld).some(Boolean) || ldStock;

  return (
    <div style={{background:DK,minHeight:"100vh",color:TX,fontFamily:"'Noto Sans KR',sans-serif"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient(rgba(227,25,55,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(227,25,55,.025) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none",zIndex:0}} />

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}>
          <div style={{background:"#141420",border:"2px solid "+R,borderRadius:6,padding:"36px 40px",width:340,boxShadow:"0 0 40px rgba(227,25,55,.3)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
              <div style={{width:26,height:26,background:R,clipPath:"polygon(20% 0%,80% 0%,80% 15%,57% 15%,57% 100%,43% 100%,43% 15%,20% 15%)",filter:"drop-shadow(0 0 6px rgba(227,25,55,.7))"}} />
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,fontWeight:900,letterSpacing:4,color:"#fff"}}>TESLA INTEL</div>
            </div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:R,letterSpacing:3,marginBottom:6}}>ADMIN ACCESS REQUIRED</div>
            <div style={{fontSize:12,color:"#7070a0",marginBottom:20,lineHeight:1.6}}>AI 업데이트 기능은 관리자 전용입니다.<br/>비밀번호를 입력하세요.</div>
            {lockoutUntil && Date.now() < lockoutUntil ? (
              <div style={{background:"rgba(227,25,55,.1)",border:"1px solid rgba(227,25,55,.4)",borderRadius:4,padding:"14px",textAlign:"center"}}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:22,fontWeight:700,color:R,marginBottom:6}}>{lockRemain+"s"}</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#7070a0"}}>잠금 해제까지 대기</div>
              </div>
            ) : (
              <>
                <input type="password" placeholder="비밀번호 입력" value={pwInput}
                  onChange={e => setPwInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && verifyPw()} autoFocus
                  style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid "+(authError?"rgba(227,25,55,.6)":"rgba(255,255,255,.15)"),borderRadius:3,color:"#e8e8f0",padding:"10px 14px",fontFamily:"'Space Mono',monospace",fontSize:13,outline:"none",letterSpacing:3,boxSizing:"border-box",marginBottom:authError?8:16}} />
                {authError && <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:R,marginBottom:12,letterSpacing:1}}>{authError}</div>}
                <div style={{display:"flex",gap:10}}>
                  <button onClick={verifyPw} style={{flex:1,background:"rgba(227,25,55,.2)",border:"1px solid "+R,color:R,fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:2,padding:"9px",borderRadius:3,cursor:"pointer"}}>확인</button>
                  <button onClick={() => { setShowAuthModal(false); setPwInput(""); setAuthError(""); pendingRef.current = null; }}
                    style={{flex:1,background:"transparent",border:"1px solid rgba(255,255,255,.15)",color:"#7070a0",fontFamily:"'Space Mono',monospace",fontSize:10,padding:"9px",borderRadius:3,cursor:"pointer"}}>취소</button>
                </div>
              </>
            )}
            {attempts > 0 && !lockoutUntil && (
              <div style={{display:"flex",gap:4,justifyContent:"center",marginTop:14}}>
                {Array.from({length:MAX_ATTEMPTS}).map((_,i) => (
                  <div key={i} style={{width:8,height:8,borderRadius:"50%",background:i<attempts?R:"rgba(255,255,255,.1)"}} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div ref={hdrRef} style={{background:"rgba(5,5,8,.97)",borderBottom:"1px solid "+BD,padding:"13px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:11}}>
          <div style={{width:30,height:30,background:R,clipPath:"polygon(20% 0%,80% 0%,80% 15%,57% 15%,57% 100%,43% 100%,43% 15%,20% 15%)",filter:"drop-shadow(0 0 7px rgba(227,25,55,.7))"}} />
          <div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:15,fontWeight:900,letterSpacing:5,color:"#fff"}}>TESLA INTELLIGENCE HUB</div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,letterSpacing:2,color:MU,marginTop:1}}>AI-POWERED · v5.0 · Storage 연동 · 주가 실시간</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {/* 잠금 배지 */}
          <div onClick={() => authUnlocked ? setAuthUnlocked(false) : setShowAuthModal(true)}
            style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",background:authUnlocked?"rgba(0,230,118,.1)":"rgba(227,25,55,.1)",border:"1px solid "+(authUnlocked?"rgba(0,230,118,.4)":"rgba(227,25,55,.3)"),borderRadius:3,padding:"5px 10px"}}>
            <span style={{fontSize:11}}>{authUnlocked ? "🔓" : "🔒"}</span>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:authUnlocked?GR:R,letterSpacing:1}}>{authUnlocked?"ADMIN":"LOCKED"}</span>
          </div>
          {/* 주가 업데이트 버튼 */}
          <button onClick={() => guard(updateStock)} disabled={ldStock}
            style={{display:"flex",alignItems:"center",gap:5,background:ldStock?"rgba(0,212,255,.05)":"rgba(0,212,255,.1)",border:"1px solid rgba(0,212,255,.4)",color:AC,fontFamily:"'Space Mono',monospace",fontSize:8,letterSpacing:1,padding:"5px 10px",borderRadius:3,cursor:ldStock?"not-allowed":"pointer"}}>
            {ldStock ? <><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>◌</span>{" 조회중"}</> : <>{"📈 주가 업데이트"}</>}
          </button>
          {/* 전체 AI 업데이트 */}
          <button onClick={() => guard(updateAll)} disabled={anyLoading}
            style={{display:"flex",alignItems:"center",gap:6,background:"rgba(227,25,55,.15)",border:"1px solid rgba(227,25,55,.5)",color:R,fontFamily:"'Space Mono',monospace",fontSize:9,letterSpacing:1,padding:"6px 14px",borderRadius:3,cursor:anyLoading?"not-allowed":"pointer"}}>
            {anyLoading ? <><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>◌</span>{" 업데이트 중..."}</> : <><span>✦</span>{" 전체 AI 업데이트"}</>}
          </button>
          {/* 저장 토스트 */}
          {saveToast && (
            <div style={{background:saveToast.ok?"rgba(0,230,118,.15)":"rgba(227,25,55,.15)",border:"1px solid "+(saveToast.ok?"rgba(0,230,118,.5)":"rgba(227,25,55,.5)"),color:saveToast.ok?GR:R,fontFamily:"'Space Mono',monospace",fontSize:8,padding:"4px 10px",borderRadius:3,letterSpacing:1}}>
              {saveToast.ok ? "💾 "+saveToast.msg : "⚠ "+saveToast.msg}
            </div>
          )}
          {/* 방문자 카운터 배지 */}
          {visitors.total > 0 && (
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:5,
                background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:3,padding:"4px 10px"}}>
                <span style={{fontSize:10}}>👁</span>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:MU,letterSpacing:1}}>
                  <span style={{color:TX,fontWeight:700}}>{visitors.today.toLocaleString()}</span>
                  <span style={{color:MU}}> 오늘</span>
                </div>
                <div style={{width:1,height:10,background:"rgba(255,255,255,0.15)"}} />
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:MU,letterSpacing:1}}>
                  <span style={{color:AC,fontWeight:700}}>{visitors.total.toLocaleString()}</span>
                  <span style={{color:MU}}> 총</span>
                </div>
              </div>
            </div>
          )}
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:MU}}>{"TSLA · "+stock.date}</div>
        </div>
      </div>

      {/* TAB NAV */}
      <div style={{background:"rgba(13,13,18,.97)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(227,25,55,.2)",display:"flex",overflowX:"auto",scrollbarWidth:"none",position:"sticky",top:hdrH,zIndex:49}}>
        {TABS.map(([v,l]) => (
          <button key={v} onClick={() => { setMainTab(v); window.scrollTo({top:0,behavior:"smooth"}); }}
            style={{fontFamily:"'Space Mono',monospace",fontSize:9,letterSpacing:1,padding:"11px 14px",border:"none",borderBottom:"2px solid "+(mainTab===v?R:"transparent"),background:mainTab===v?"rgba(227,25,55,.07)":"transparent",color:mainTab===v?R:MU,cursor:"pointer",whiteSpace:"nowrap",transition:"all .2s"}}>{l}</button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{position:"relative",zIndex:1,maxWidth:1400,margin:"0 auto",padding:"24px 20px 60px"}}>
        {mainTab === "company"   && <CompanyTab />}
        {mainTab === "ceo"       && <CeoTab />}
        {mainTab === "values"    && <ValuesTab />}
        {mainTab === "perf"      && <PerfTab />}
        {mainTab === "roadmap"   && <RoadmapTab />}
        {mainTab === "risk"      && <RiskTab />}
        {mainTab === "earnings"  && <EarningsTab />}
        {mainTab === "xposts"    && <XTab />}
        {mainTab === "ownership" && <OwnershipTab />}

        {/* UPDATE LOG */}
        {updateHistory.length > 0 && (
          <div style={{...card,marginTop:20,borderColor:"rgba(0,212,255,.2)"}}>
            <div style={{...lbl,color:AC}}>{"AI 업데이트 로그 (최근 "+updateHistory.length+"건)"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:8}}>
              {updateHistory.map((h,i) => (
                <div key={i} style={{display:"flex",gap:10,padding:"4px 8px",background:"rgba(255,255,255,.02)",borderRadius:3,fontSize:9,fontFamily:"'Space Mono',monospace",alignItems:"center"}}>
                  <span style={{color:h.ok?GR:R,flexShrink:0}}>{h.ok?"✓":"✗"}</span>
                  <span style={{color:MU,flexShrink:0,minWidth:130}}>{h.time}</span>
                  <span style={{color:AC,flexShrink:0}}>{"["+h.key+"]"}</span>
                  <span style={{color:TX}}>{h.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{position:"relative",zIndex:1,textAlign:"center",padding:"16px 12px 12px",fontFamily:"'Space Mono',monospace",fontSize:8,color:"rgba(255,255,255,.15)",borderTop:"1px solid rgba(227,25,55,.12)",letterSpacing:2}}>
        {visitors.total > 0 && (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:8,fontFamily:"'Space Mono',monospace",fontSize:9}}>
            <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:3,padding:"5px 14px"}}>
              <span style={{color:MU}}>오늘 방문</span>
              <span style={{color:TX,fontWeight:700,fontFamily:"'Orbitron',monospace",fontSize:11}}>{visitors.today.toLocaleString()}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(0,212,255,0.05)",border:"1px solid rgba(0,212,255,0.15)",borderRadius:3,padding:"5px 14px"}}>
              <span style={{color:MU}}>누적 방문</span>
              <span style={{color:AC,fontWeight:700,fontFamily:"'Orbitron',monospace",fontSize:11}}>{visitors.total.toLocaleString()}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4,color:MU}}>
              <span style={{fontSize:7,color:"rgba(255,255,255,0.2)"}}>※ 세션 중복 제외 · Artifact Storage (공유)</span>
            </div>
          </div>
        )}
        TESLA INTELLIGENCE HUB v5.0 · SEC 8-K/10-Q/13F · X POSTS · NOT FINANCIAL ADVICE
      </div>
    </div>
  );
}
