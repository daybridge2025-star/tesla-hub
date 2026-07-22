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
      return window.storage.get(key).catch(() => null);
    }
    const v = localStorage.getItem(key);
    return v ? { value: v } : null;
  },
  getShared: async (key) => {
    if (typeof window !== "undefined" && window.storage) {
      return window.storage.get(key, true).catch(() => null);
    }
    const v = localStorage.getItem("shared_"+key);
    return v ? { value: v } : null;
  },
  set: async (key, value) => {
    if (typeof window !== "undefined" && window.storage) {
      return window.storage.set(key, value).catch(() => null);
    }
    localStorage.setItem(key, value); return true;
  },
  setShared: async (key, value) => {
    if (typeof window !== "undefined" && window.storage) {
      return window.storage.set(key, value, true).catch(() => null);
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
   RESPONSIVE HOOK
═══════════════════════════════════════ */
/* ── 카운트다운 — 독립 컴포넌트 (App 리렌더 격리) ── */
function Countdown() {
  const [ct, setCt] = useState({d:0,h:0,m:0,s:0,passed:false});
  const isMobile = useIsMobile();
  useEffect(() => {
    const target = new Date(Date.UTC(2026, 6, 22, 20, 30, 0));
    const tick = () => {
      const diff = (target - new Date()) / 1000;
      if (diff <= 0) { setCt({d:0,h:0,m:0,s:0,passed:true}); return; }
      setCt({
        d: Math.floor(diff / 86400),
        h: Math.floor((diff % 86400) / 3600),
        m: Math.floor((diff % 3600) / 60),
        s: Math.floor(diff % 60),
        passed: false
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px 18px",marginBottom:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.08em",textTransform:"uppercase"}}>
          {ct.passed ? "🔔 Q2'26 실적 발표됨" : "Q2'26 실적 발표까지"}
        </div>
        {!ct.passed && (
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#38BDF8",animation:"pulse 2s ease-in-out infinite"}} />
            <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:"#38BDF8",fontWeight:600}}>LIVE</span>
          </div>
        )}
      </div>
      {!ct.passed ? (
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[["일",ct.d],["시간",ct.h],["분",ct.m],["초",ct.s]].map(([label,val])=>(
            <div key={label} style={{textAlign:"center",background:"var(--bg-elev)",borderRadius:10,padding:"10px 6px"}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:isMobile?20:24,fontWeight:700,color:"var(--text-1)",lineHeight:1}}>
                {String(val).padStart(2,"0")}
              </div>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:"var(--text-3)",marginTop:5,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:13,color:"var(--text-2)"}}>{"최신 결과를 확인하세요."}</div>
      )}
      <div style={{display:"flex",flexWrap:"wrap",gap:isMobile?8:16,marginTop:12,paddingTop:12,borderTop:"1px solid var(--border)"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.08em"}}>현지</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600,color:"var(--text-1)"}}>7/22 16:30 ET</span>
          <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:"var(--text-3)"}}>(장마감 후)</span>
        </div>
        <div style={{width:1,height:16,background:"var(--border)",alignSelf:"center"}} />
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.08em"}}>한국</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600,color:"#38BDF8"}}>7/23 05:30 KST</span>
          <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:"var(--text-3)"}}>{"(익일 새벽)"}</span>
        </div>
      </div>
      <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:"var(--text-3)",marginTop:8}}>
        {"컨센 EPS $0.45 · 매출 $24.34B"}
      </div>
    </div>
  );
}

function useIsMobile(breakpoint = 430) {
  const [mob, setMob] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const h = () => setMob(window.innerWidth <= breakpoint);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [breakpoint]);
  return mob;
}

/* ═══════════════════════════════════════
   FONT INJECT — Pretendard
═══════════════════════════════════════ */
if (typeof document !== "undefined" && !document.getElementById("pretendard-font")) {
  const link = document.createElement("link");
  link.id = "pretendard-font";
  link.rel = "stylesheet";
  link.href = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css";
  document.head.appendChild(link);
  const jb = document.createElement("link");
  jb.rel = "stylesheet";
  jb.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&display=swap";
  document.head.appendChild(link);
}

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
  const apiUrl = "https://tesla-proxy.daybridge2025.workers.dev";
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6", max_tokens: 1000,
      system, messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error("API " + res.status);
  const data = await res.json();
  // API 오류 응답 처리
  if (data.error) throw new Error("API Error: " + (data.error.message || JSON.stringify(data.error)));
  if (!data.content) throw new Error("No content in response: " + JSON.stringify(Object.keys(data)));
  // web_search 결과 포함 시 여러 content 블록 처리
  const textBlocks = data.content.filter(b => b.type === "text");
  if (!textBlocks.length) {
    const types = data.content.map(b => b.type).join(", ");
    throw new Error("No text block. Got: " + types);
  }
  const text = textBlocks.map(b => b.text).join("");
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) throw new Error("JSON not found in: " + cleaned.slice(0, 200));
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
  {id:1,date:"2025-06-05",cat:"DOGE·정치",likes:"2.1M",reposts:"512K",impact:"high",
   en:"Time to drop the really big bomb: @realDonaldTrump is in the Epstein files. That is the real reason they have not been made public.",
   ko:"진짜 큰 폭탄을 투하할 시간: 트럼프는 엡스타인 파일에 있습니다. 그것이 공개되지 않는 진짜 이유입니다.",
   ctx:"트럼프와의 공개 갈등. 이후 삭제. 당일 Tesla 주가 -14.3% 급락(종가 $284.68). $150B 시총 증발. 머스크 6/11 사과"},
  {id:2,date:"2025-06-05",cat:"DOGE·정치",likes:"890K",reposts:"198K",impact:"high",
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
  {id:18,date:"2025-11-10",cat:"Tesla전략",likes:"312K",reposts:"98K",impact:"high",
   en:"My companies are, surprisingly in some ways, trending towards convergence.",
   ko:"저의 회사들이 놀랍게도 수렴(통합) 방향으로 나아가고 있습니다.",
   ctx:"Sawyer Merritt 포스트 댓글. SpaceX·Tesla·xAI 통합 암시. 2026년 SpaceX IPO·합병설로 재조명됨"},
  {id:19,date:"2026-03-31",cat:"Optimus",likes:"287K",reposts:"76K",impact:"medium",
   en:"Optimus 3 is mobile but requires some finishing touches before it is ready to be shown to the world.",
   ko:"Optimus 3는 작동 가능하지만, 세상에 공개되기 전 마무리 작업이 조금 더 필요합니다.",
   ctx:"Q1'26 마지막 날 Optimus V3 공개 지연 공식 발표. 당초 Q1 공개 목표였으나 슬립"},
  {id:20,date:"2026-03-31",cat:"Terafab",likes:"198K",reposts:"54K",impact:"high",
   en:"Either we build the Terafab or we do not have the chips, and we need the chips, so we build the Terafab.",
   ko:"Terafab을 짓거나, 칩이 없거나 둘 중 하나입니다. 칩이 필요하니 Terafab을 짓습니다.",
   ctx:"Tesla·SpaceX·xAI 3사 공동 반도체 팹 착공 필요성 강조. Giga Texas 인근 착공 확정"},
  {id:21,date:"2026-01-06",cat:"FSD",likes:"11K",reposts:"1.1K",impact:"medium",
   en:"The actual time from when FSD sort of works to where it is much safer than a human is several years.",
   ko:"FSD가 어느 정도 작동하는 시점부터 인간보다 훨씬 안전해지는 단계까지는 수년이 걸립니다. 레거시 OEM은 그 이후에야 대규모로 탑재할 것입니다.",
   ctx:"1M 조회수. Tesla FSD 경쟁우위 수년간 유지 전망 강조. 기술 해자 명확히 제시"},
  {id:22,date:"2026-01-13",cat:"FSD",likes:"91K",reposts:"10K",impact:"high",
   en:"Tesla will stop selling FSD after Feb 14. FSD will only be available as a monthly subscription thereafter.",
   ko:"Tesla는 2월 14일 이후 FSD 판매를 중단합니다. 이후 FSD는 월정액 구독으로만 제공됩니다.",
   ctx:"FSD 일시불 판매 종료 공식 발표. $99/월 구독 전환. ARR 기반 반복수익 모델 시작"},
  {id:23,date:"2026-01-22",cat:"FSD",likes:"39K",reposts:"4.8K",impact:"high",
   en:"The $99/month for supervised FSD will rise as capabilities improve. The massive value jump is unsupervised FSD.",
   ko:"감독형 FSD 월 $99는 성능 향상에 따라 인상됩니다. 진정한 가치 도약은 무감독 FSD 도달 시점입니다.",
   ctx:"Autopilot 단종·FSD 구독 전환 맥락. 무감독 FSD 가격 프리미엄 예고. ARR 성장 기반 마련"},
  {id:24,date:"2026-03-11",cat:"Tesla전략",likes:"77K",reposts:"12K",impact:"high",
   en:"Macrohard or Digital Optimus is a joint xAI-Tesla project. Grok is the master conductor/navigator to direct digital Optimus.",
   ko:"Digital Optimus는 xAI-Tesla 공동 프로젝트. Grok이 세계를 깊이 이해하며 Digital Optimus를 지휘합니다.",
   ctx:"Tesla xAI $2B 투자 공식화 이후 AI 통합 아키텍처 공개. Grok+Optimus 결합 구조 첫 언급"},
  {id:25,date:"2026-04-01",cat:"FSD",likes:"59K",reposts:"5.5K",impact:"high",
   en:"FSD 14.3 is in Tesla employee beta now and will probably go to wide release end of week.",
   ko:"FSD 14.3이 현재 Tesla 직원 베타 테스트 중이며, 이번 주 말 정식 출시 예정입니다.",
   ctx:"48M 조회수. FSD v14.3 광역 출시 임박 공식 발표. 마지막 퍼즐 조각 도달 시사"},
  {id:26,date:"2026-04-10",cat:"FSD",likes:"76K",reposts:"10K",impact:"high",
   en:"First (supervised) FSD approval in Europe! Congratulations to the Tesla team and thank you to the Netherlands regulatory authorities.",
   ko:"유럽 최초 감독형 FSD 승인! Tesla 팀과 네덜란드 규제 당국에 감사드립니다.",
   ctx:"FSD 유럽 최초 승인 (네덜란드, 2026-04-10). 12개국 추가 심사 진행 중. 글로벌 확장 전환점"},
  {id:27,date:"2026-06-18",cat:"Tesla전략",likes:"89K",reposts:"21K",impact:"high",
   en:"Tesla will deploy millions of MEGAPOD AI compute units at Supercharger stations worldwide. 7 gigawatts of available power, zero permitting delay.",
   ko:"Tesla는 전 세계 슈퍼차저 스테이션에 수백만 대의 MEGAPOD AI 컴퓨팅 유닛을 배포할 것입니다. 가용 전력 7기가와트, 허가 지연 없음.",
   ctx:"MEGAPOD USPTO 상표 출원 당일(2026.06.18). Supercharger 인프라 기반 분산 AI 데이터센터 구상 공식화. Digital Optimus·Terafab과 연계"},
  {id:28,date:"2025-06-22",cat:"Tesla전략",likes:"234K",reposts:"45K",impact:"high",
   en:"Super congratulations to the @Tesla_AI software & chip design teams on a successful @Robotaxi launch!! Culmination of a decade of hard work. Both the AI chip and software teams were built from scratch within Tesla.",
   ko:"Tesla AI 소프트웨어·칩 설계 팀의 성공적인 로보택시 출시를 진심으로 축하합니다!! 10년간의 노력의 결실입니다. AI 칩과 소프트웨어 팀 모두 Tesla 내부에서 처음부터 구축했습니다.",
   ctx:"오스틴 로보택시 서비스 출시 당일. Tesla AI·HW 팀 10년 성과 결실 공개 치하. 무감독 FSD 상업화의 역사적 전환점"},
  {id:29,date:"2025-07-14",cat:"Tesla전략",likes:"312K",reposts:"58K",impact:"high",
   en:"Just left the @Tesla design studio. Most epic demo ever by end of year. Ever.",
   ko:"방금 Tesla 디자인 스튜디오를 나왔습니다. 올해 말까지 역대 가장 epic한 데모가 있을 것입니다. 정말로.",
   ctx:"25M 조회수. Tesla 호손 디자인 스튜디오 방문 직후. Roadster·Optimus V3 공개 암시로 해석. 2025년 말 대규모 이벤트 예고"},
  {id:30,date:"2026-03-04",cat:"Optimus",likes:"198K",reposts:"38K",impact:"high",
   en:"Tesla will be one of the companies to make AGI and probably the first to make it in humanoid/atom-shaping form.",
   ko:"Tesla는 AGI를 만들 기업 중 하나가 될 것이며, 아마도 휴머노이드/원자 형태로 최초로 구현하는 기업이 될 것입니다.",
   ctx:"Giga Berlin Cybercab 인터뷰 맥락. xAI·Tesla AI 통합 연계. Optimus가 Tesla의 AGI 구현체라는 비전 공식화"},
];


const BASE_INST = [
  {id:1,date:"2026-04-06~08",inst:"ARK Invest (Cathie Wood)",action:"BUY",amt:"$28M",shares:"81K주",note:"저점 매수 $28M. 2026년 목표가 $4,600 유지 (베이스). 불케이스 $5,800. 로보택시가 기업가치의 60% 기여 전망",sent:"bullish"},
 
  {id:2,date:"2026-01",inst:"ARK Invest",action:"SELL",amt:"$44M",shares:"132K주",note:"차익실현, 목표가 상향 직전",sent:"neutral"},
  {id:3,date:"2025-12-22",inst:"ARK Invest",action:"SELL",amt:"$29M",shares:"60.7K주",note:"4주 연속 매도 트렌드",sent:"neutral"},
  {id:4,date:"2025-11-06",inst:"ARK Invest",action:"SELL",amt:"$87M",shares:"181K주",note:"차익실현, Mag7 다른 종목 매수",sent:"neutral"},
  {id:5,date:"2025-Q3",inst:"Vanguard Group",action:"HOLD",amt:"~$94B",shares:"229.8M주",note:"S&P500 지수추종 자동 보유",sent:"neutral"},
 
 
 
  {id:9,date:"2026-Q1",inst:"JPMorgan Chase",action:"BUY",amt:"$551.5M",shares:"1,483,545주",note:"Q1'26 13F: 지분 추가. 총 46,075,161주 보유. 분기말 시가 $17.12B. 목표가 업그레이드(→$475) 전 매수",sent:"bullish"},
  {id:10,date:"2026-Q4(2025)",inst:"Vanguard Group",action:"BUY",amt:"~$2.7B",shares:"6.6M주 추가",note:"Q4 2025 13F: 2022년 이후 최대 분기 매수. 총 259M주 보유. 시가 $102.85B",sent:"bullish"},
  {id:11,date:"2026-Q1",inst:"Citadel Advisors",action:"BUY",amt:"—",shares:"지분 확대",note:"Q1 2026 13F: 총 보유 상위 6위권. 헤지펀드 중 최대 포지션",sent:"bullish"},
  {id:12,date:"2026-06-18",inst:"ARK Invest (Cathie Wood)",action:"BUY",amt:"$22M",shares:"추가 매수",note:"오스틴 무감독 로보택시 탑승 영상 공개 직후 $22M 추가 매수. $75 주차 위반 티켓을 신규 모델 비용 항목으로 추가 - 불케이스 $4,600 재확인",sent:"bullish"},
  {id:13,date:"2026-Q1",inst:"BlackRock",action:"HOLD",amt:"—",shares:"기관 보유 2위",note:"Q1 2026 13F 기준 Tesla 기관 보유 2위. 글로벌 최대 자산운용사($10조 AUM). 지수추종·액티브 혼합 보유",sent:"neutral"},
  {id:14,date:"2026-Q1",inst:"State Street",action:"HOLD",amt:"—",shares:"기관 보유 3위",note:"Q1 2026 13F 기준 3위. S&P500·ETF 지수추종 자동 보유. SPDR ETF 계열 운용",sent:"neutral"},
  {id:15,date:"2026-Q1",inst:"Geode Capital Management",action:"HOLD",amt:"—",shares:"기관 보유 4위",note:"Q1 2026 13F 기준 4위. Fidelity 계열 지수 포트폴리오 운용. 패시브 전략",sent:"neutral"},
  {id:16,date:"2026-Q1",inst:"Susquehanna International Group",action:"HOLD",amt:"—",shares:"기관 보유 5위 신규",note:"Q1 2026 13F 신규 상위 5위 진입. 퀀트·옵션·파생상품 전문 헤지펀드. 포지션 확대 추정",sent:"neutral"},
  {id:17,date:"2026-Q1",inst:"Capital World Investors",action:"HOLD",amt:"—",shares:"기관 보유 8위",note:"American Funds 운용사. 장기 액티브 투자 전략. Tesla EV·AI 성장 테제 보유",sent:"bullish"},
  {id:18,date:"2026-Q1",inst:"Jane Street Group",action:"HOLD",amt:"—",shares:"기관 보유 9위 신규",note:"Q1 2026 13F 신규 상위 9위 진입. 퀀트·ETF 차익거래 전문. 대규모 파생 포지션 병행 추정",sent:"neutral"},
  {id:19,date:"2026-Q1",inst:"FMR LLC (Fidelity)",action:"HOLD",amt:"—",shares:"기관 보유 10위",note:"Fidelity 자산운용. 액티브·지수 혼합. Contrafund 등 주요 펀드 통해 보유",sent:"neutral"},
];
 
 
 
 
 
 
 
 

const OWNERSHIP = [
  {name:"일론 머스크",value:19.9,color:"#E31937",shares:"1.12B주"},
  {name:"Vanguard",value:7.3,color:"#38BDF8",shares:"229.8M주"},
  {name:"BlackRock",value:5.8,color:"#10b981",shares:"188.8M주"},
  {name:"State Street",value:3.4,color:"#fbbf24",shares:"114.7M주"},
  {name:"Geode Capital",value:1.7,color:"#a78bfa",shares:"~55M주"},
  {name:"Larry Ellison",value:1.4,color:"#f97316",shares:"~46M주"},
  {name:"기타 기관",value:24.5,color:"var(--bg-elev)",shares:"~815M주 (총 4,382개 기관·42.5%)"},
  {name:"리테일",value:35.1,color:"#1e3a5f",shares:"~1.17B주"},
  {name:"기타 내부자",value:7.0,color:"#5b21b6",shares:"~233M주"},
];

const CEO_TL = [
  {y:"1971",t:"남아공 프리토리아 출생",d:"학교에서 또래에게 입원할 정도로 심한 폭력을 당했고, 아버지와의 관계도 평생의 트라우마로 남음. 이 시기가 훗날 고통에 무감각해지는 성향 형성에 영향을 줌(Isaacson, 2023)."},
  {y:"1983~1984",t:"게임 'Blastar' 제작·판매",d:"1983년(12세) BASIC으로 우주 슈팅 게임 Blastar 제작. 1984년(13세) 남아공 PC and Office Technology 잡지에 소스코드 게재·$500 판매. 훗날 Google 엔지니어가 웹 버전으로 복원."},
  {y:"1995",t:"Zip2 창업",d:"스탠퍼드 박사 과정 이틀 만에 자퇴. 1999년 Compaq에 $307M 매각."},
  {y:"1999",t:"X.com → PayPal",d:"X.com 설립, 합병 후 PayPal. 2002년 eBay가 $1.5B에 인수."},
  {y:"2000",t:"말라리아 생사 고비",d:"남아공 휴가 중 심각한 말라리아에 감염. 거의 사망 직전까지 갔다가 회복. Vance 전기에 따르면 이 경험이 '시간을 낭비하지 말라'는 머스크의 극단적 집중력 형성에 기여했다고 기술."},
  {y:"2002",t:"SpaceX 창립",d:"Mars 이주 목표. 제1원칙 사고로 로켓 비용 99% 절감 목표."},
  {y:"2004",t:"Tesla 투자 참여",d:"시리즈 A 최대 투자자로 참여. 이사회 의장 역임."},
  {y:"2008",t:"Tesla CEO 취임 & 위기",d:"Falcon 1 3차 발사 실패, 이혼, Tesla 파산 위기가 동시에 겹친 최악의 해. 크리스마스 직전 Falcon 1 4차 성공과 Tesla 긴급투자 유치로 동시에 회생 — Isaacson은 이를 '벼랑 끝 더블 베팅'으로 서술."},
  {y:"2010",t:"Tesla NASDAQ 상장",d:"공모가 $17 → 현재 $391 (2,200%+)."},
  {y:"2012",t:"Tesla Model S 첫 배송",d:"2012.06.22 최초 고객 배송 감독. Consumer Reports 역대 최고점 99/100 획득. 이 판매 급증이 2013년 Google 인수 협상 철회의 직접적 계기가 됨."},
  {y:"2013",t:"Google 인수 협상 → 극적 반전",d:"운영자금 2주치만 남은 파산 직전 위기. 공장 가동 중단 후 Larry Page(Google)에게 $60억 매각 + $50억 공장투자 제안, 구두 합의 후 계약서 작성 시작. 그러나 Model S 판매 급증·Consumer Reports 99/100(역대 최고점)으로 Q1 흑자($1,100만) 달성 → 머스크가 직접 전화해 매각 철회. \"그는 더 이상 구원자가 필요 없었다\" — Ashlee Vance 전기(2015)"},
  {y:"2015",t:"OpenAI 공동창업 + SpaceX 재사용 로켓 착륙",d:"Sam Altman과 OpenAI 공동창업(AI 안전성·오픈소스 목표). 2018년 갈등 끝 탈퇴 후 2023년 xAI 설립. 같은 해 SpaceX Falcon 9 부스터 역사상 최초 수직 착륙 성공 — 재사용 가능 궤도 로켓 시대 개막."},
  {y:"2020",t:"SpaceX 첫 유인 비행 성공",d:"2020.05.30 Falcon 9 / Crew Dragon으로 NASA 우주비행사 2명을 ISS에 수송. 미국 민간 우주선 최초 유인 비행. 9년 만의 미국 자체 유인 우주비행 복귀. Isaacson 전기가 '상업 우주시대의 시작'으로 기술."},
  {y:"2021",t:"세계 최고 부자 등극",d:"Tesla 시총 $1조 돌파. Time 올해의 인물 선정."},
  {y:"2022",t:"Twitter $44B 인수 → X",d:"인수 직후 대량 해고와 광고주 이탈로 매출 급감 — Isaacson은 머스크의 충동적 의사결정·극단적 작업강도 요구 패턴의 대표 사례로 서술. 이후 xAI Grok과 결합돼 AI 전략 자산으로 재포지셔닝."},
  {y:"2024",t:"Neuralink 첫 인간 이식 + Starship 부스터 포획",d:"2024.01.29 Neuralink 첫 인간 환자(29세 사지마비 Noland Arbaugh) 뇌 임플란트 성공 — 생각만으로 마우스 제어. 2024.10 Starship Super Heavy 부스터를 발사탑 '메카질라' 집게로 공중 포획 성공 — 완전 재사용 우주 시대 개막."},
  {y:"2025",t:"Tesla $1조 보상안 승인",d:"주주총회에서 차량 2,000만대·시총 $8.5조 등 10년 목표 달성 시 최대 $1조 규모 스톡옵션 패키지 승인. 트릴리어네어 등극의 첫 번째 경로."},
  {y:"2025",t:"DOGE 수장 → 5월 퇴임",d:"트럼프 2기 DOGE 수장 합류 → 4개월 만에 퇴임, Tesla CEO 복귀."},
  {y:"2026.02",t:"SpaceX-xAI 합병",d:"xAI를 SpaceX에 합병. Grok이 Digital Optimus를 지휘하는 통합 AI 아키텍처 공식화. SpaceX 밸류에이션이 약 $1조로 상승하는 결정적 계기."},
  {y:"2026.06",t:"SpaceX 나스닥 상장 — 역대 최대 IPO",d:"6/12 SPCX 티커로 상장. 공모가 $135 → 첫날 $150 마감, 밸류에이션 약 $1.77조. $75B 조달로 역대 최대 IPO. 머스크 SpaceX 지분가치 약 $690~866억 추산. 6/24 $250억 채권 발행(브릿지론 $175억 상환 목적, 현금보유 $1,008억)."},
  {y:"2026.06",t:"세계 최초 '트릴리어네어' 등극",d:"SpaceX 상장 직후 순자산 약 $1.05~1.1조 달성, 인류 역사상 최초의 1조 달러 자산가. Tesla 지분 + SpaceX 지분 합산. 2위 Larry Page와 약 $700B 이상 격차."},
  {y:"2026.06",t:"2018년 보상안 행사 — 지분 19.9% 급증",d:"6/16 옵션 행사로 3.04억주 취득(행사가 $23.34). 순증 2.86억주, 총 보유 약 11.2억주(지분 19.9%)로 상승. 신규 주식은 2028년 1월까지 베스팅 후 5년 락업(2033년까지 매도 불가)."},
  {y:"2026",t:"물리적 AI 전환 가속",d:"Terafab 착공, Model S·X 단종, Robotaxi 오스틴 전역·텍사스 2개 도시 확장. MEGAPOD AI 데이터센터 상표 출원(6/18). Roadster 8월 공개 예정. NatPower $5B 메가팩 계약(유럽 역대 최대). Cars.com 6년 연속 미국산 차량 1위(Model 3 #1, Model Y #2)."},
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
  {date:"2026.06.05",inst:"JPMorgan",analyst:"Rajat Gupta",rating:"Neutral",tp:475,color:"#38BDF8",reason:"수직 통합 재평가. EPS 2030 $7.50 전망. 11년 약세론 종료.",badge:"🔥"},
  {date:"2026.01.10",inst:"Wedbush",analyst:"Dan Ives",rating:"Outperform",tp:600,color:"#10b981",reason:"AI 전환 역사적 변곡점. 로보택시 30개 도시 가속.",badge:null},
  {date:"2026.01.08",inst:"TD Cowen",analyst:"—",rating:"Buy",tp:519,color:"#10b981",reason:"Cybercab $0.30/마일 — 라이드셰어 구조적 파괴.",badge:null},
  {date:"2026.01.05",inst:"Stifel",analyst:"—",rating:"Buy",tp:508,color:"#10b981",reason:"로보택시 7개 도시 확장. Optimus V3 공급망 주목.",badge:null},
  {date:"2025.12.15",inst:"Piper Sandler",analyst:"Alex Potter",rating:"Overweight",tp:500,color:"#10b981",reason:"에너지·소프트웨어 스케일링 지속.",badge:null},
  {date:"2025.12.11",inst:"Morgan Stanley",analyst:"Adam Jonas",rating:"Equal-Weight",tp:425,color:"#fbbf24",reason:"AI·Optimus 가치 인정. EV 경쟁·실행 리스크 병존.",badge:null},
  {date:"2026.01.29",inst:"Goldman Sachs",analyst:"Mark Delaney",rating:"Neutral",tp:405,color:"#fbbf24",reason:"CapEx $25B → FCF 음전환. 실행 리스크 높음.",badge:null},
  {date:"2026.01.15",inst:"RBC Capital",analyst:"Tom Narayan",rating:"Outperform",tp:320,color:"#fbbf24",reason:"전통 EV 경쟁 심화. 자율주행 타임라인 불확실.",badge:null},
  {date:"2026.04.01",inst:"Wells Fargo",analyst:"Colin Langan",rating:"Underweight",tp:125,color:"#E31937",reason:"EV 수요 구조적 둔화. 밸류에이션 현실과 괴리.",badge:null},
  {date:"2025.01.01",inst:"ARK Invest",analyst:"Cathie Wood",rating:"—",tp:4600,color:"#a78bfa",reason:"로보택시+Optimus 대량생산 DCF. 2029 불마켓 가정.",badge:"⚠극단값"},
  {date:"2026.06.22",inst:"Jefferies",analyst:"—",rating:"Hold",tp:375,color:"#94A3B8",reason:"SpaceX 합병 기대로 TSLA의 SPCX 추종주식화 위험 경고. 로보택시·휴머노이드 초기 손실 센터 전망. 밸류에이션-실적 괴리 지속.",badge:null},
  {date:"2026.05.19",inst:"Barclays",analyst:"Dan Levy",rating:"Hold",tp:360,color:"#94A3B8",reason:"메모리 칩·구리 원자재 비용 상승. Model Y 가격 인상으로 일부 상쇄. 로보택시·AI 기대 이미 주가 반영.",badge:null},
];

/* ═══════════════════════════════════════
   STYLES
═══════════════════════════════════════ */
const R="#E31937",AC="#38BDF8",GR="#10b981",YL="#fbbf24",MU="var(--text-2)",TX="var(--text-1)",DK="var(--bg)",SF="var(--bg-card)",SF2="var(--bg-elev)",BD="var(--border)";

const card = {background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:16,padding:"18px 20px"};
const lbl  = {fontFamily:"'Pretendard',sans-serif",fontSize:12,letterSpacing:1.5,color:R,textTransform:"uppercase",marginBottom:6,fontWeight:600,textAlign:"center"};
const ttl  = {fontFamily:"'Pretendard',sans-serif",fontSize:20,fontWeight:800,color:"var(--text-1)",marginBottom:16,letterSpacing:-0.3,textAlign:"center"};
const fb   = a => ({fontFamily:"'Pretendard',sans-serif",fontSize:11,padding:"5px 14px",borderRadius:20,cursor:"pointer",
                    border:a?"1px solid "+R:"1px solid rgba(255,255,255,0.1)",
                    background:a?"rgba(227,25,55,0.15)":"transparent",color:a?R:MU,letterSpacing:1});
const inp  = {background:"var(--border-subtle)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:3,
              color:TX,padding:"7px 11px",fontFamily:"'Pretendard','Noto Sans KR',sans-serif",fontSize:12,outline:"none"};

const SENT_ST = {
  positive:{br:"rgba(16,185,129,.3)",c:GR},
  mixed:   {br:"rgba(251,191,36,.3)", c:YL},
  negative:{br:"rgba(227,25,55,.3)", c:R},
};
const ACT_C  = {BUY:GR,SELL:R,HOLD:MU,RATE:AC};
const SENT_C = {bullish:GR,bearish:R,neutral:YL};
const IMP_C  = {high:R,medium:YL,low:MU};

/* ─── 재사용 컴포넌트 ─────────────────── */
function KPI({label,value,sub,color,badge}) {
  const isMobile = useIsMobile();
  return (
    <div style={{flex:"1 1 130px",minWidth:0,position:"relative",minHeight:88,display:"flex",flexDirection:"column",justifyContent:"space-between",background:SF2,border:"0.5px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"14px 16px",textAlign:"center",alignItems:"center"}}>
      <div style={{width:"100%",display:"flex",justifyContent:"center",alignItems:"center",gap:6,position:"relative"}}>
        <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:isMobile?11:13,color:MU,fontWeight:600,letterSpacing:0}}>{label}</div>
        {badge && (
          <div style={{background:badge==="NEW"?"rgba(56,189,248,.15)":badge==="↑"?"rgba(16,185,129,.15)":"rgba(227,25,55,.15)",
            border:"1px solid "+(badge==="NEW"?AC:badge==="↑"?GR:R),
            color:badge==="NEW"?AC:badge==="↑"?GR:R,
            fontFamily:"'Pretendard',sans-serif",fontSize:10,padding:"1px 6px",borderRadius:10,fontWeight:600}}>{badge}</div>
        )}
      </div>
      <div style={{fontFamily:"'JetBrains Mono','Pretendard',monospace",fontSize:isMobile?17:21,fontWeight:700,color:color||"var(--text-1)",lineHeight:1.1,letterSpacing:-0.5,marginTop:6,textAlign:"center"}}>{value}</div>
      {sub && (
        <div style={{marginTop:8,textAlign:"center"}}>
          <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:MU}}>{sub}</span>
        </div>
      )}
    </div>
  );
}

function RevTip({active,payload,label}) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"var(--bg-card)",border:"1px solid rgba(227,25,55,.4)",borderRadius:4,padding:"8px 12px",fontFamily:"'Pretendard',sans-serif",fontSize:10}}>
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
        background:loading?"rgba(49,130,246,0.05)":"rgba(49,130,246,0.15)",
        border:"1px solid "+(loading?"rgba(49,130,246,0.2)":"rgba(49,130,246,0.5)"),
        color:loading?MU:"#60a5fa",fontFamily:"'Pretendard',sans-serif",fontSize:12,letterSpacing:0,fontWeight:600,
        padding:"7px 16px",borderRadius:20,cursor:loading?"not-allowed":"pointer",whiteSpace:"nowrap"}}>
      {loading ? <><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>◌</span>{" 검색 중..."}</> : <><span>✦</span>{" "}{label||"AI 업데이트"}</>}
    </button>
  );
}

function LogBadge({log}) {
  if (!log) return null;
  return (
    <div style={{background:log.ok?"rgba(16,185,129,.1)":"rgba(227,25,55,0.1)",
      border:"1px solid "+(log.ok?"rgba(16,185,129,.3)":"rgba(227,25,55,0.3)"),
      color:log.ok?GR:R,fontFamily:"'Pretendard',sans-serif",fontSize:10,fontWeight:600,padding:"4px 12px",borderRadius:20}}>
      {log.ok ? "✓ "+log.msg : "✗ "+log.msg}
    </div>
  );
}

function SHdr({sub,title,children}) {
  return (
    <div style={{marginBottom:20}}>
      <div style={{textAlign:"center",marginBottom:children?12:0}}>
        <div style={{...lbl,textAlign:"center"}}>{sub}</div>
        <div style={{...ttl,textAlign:"center"}}>{title}</div>
      </div>
      {children && (
        <div style={{display:"flex",justifyContent:"center"}}>{children}</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN APP
═══════════════════════════════════════ */
export default function App() {
  /* ── responsive ── */
  const isMobile = useIsMobile();

  /* ── theme ── */
  const [theme, setTheme] = useState("dark");
  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  /* ── progress bar ── */
  const [progress, setProgress] = useState(0);
  /* ── 뉴스 데이터 로드 ── */
  useEffect(() => {
    const load = async () => {
      setNewsLoading(true);
      try {
        const res = await fetch("https://tesla-proxy.daybridge2025.workers.dev/news?days=30");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setNews(data.news || []);
        setBreakingNews(data.breaking || []);
        setNewsDates(data.dates || []);
        setNewsMeta({ updatedAt: data.updatedAt || null, total: data.total ?? 0, error: null });
      } catch(e) {
        console.error("뉴스 로드 실패", e);
        setNewsMeta({ updatedAt: null, total: 0, error: e.message || "Unknown error" });
      } finally {
        setNewsLoading(false);
      }
    };
    load();
  }, []);

  /* ── 🆕 로보택시 데이터 로드 (v3.2) ── */
  useEffect(() => {
    const load = async () => {
      setRoboLoading(true);
      try {
        const res = await fetch("https://tesla-proxy.daybridge2025.workers.dev/robotaxi");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRoboLatest(data.latest || null);
        setRoboHistory(data.history || []);
        setRoboMeta({ updatedAt: data.updatedAt || null, count: data.count ?? 0, error: null, lastError: data.lastError || null });
      } catch(e) {
        console.error("로보택시 로드 실패", e);
        setRoboMeta({ updatedAt: null, count: 0, error: e.message || "Unknown error", lastError: null });
      } finally {
        setRoboLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const pct = h.scrollTop / (h.scrollHeight - h.clientHeight);
      setProgress(Math.min(100, Math.max(0, pct * 100)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);



  /* ── IntersectionObserver: 활성 섹션 추적 (ScrollSpy) ── */
  useEffect(() => {
    const sections = document.querySelectorAll("section[id]");
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) setActiveSection(e.target.id);
      });
    }, { rootMargin:"-20% 0px -70% 0px", threshold: 0 });
    sections.forEach(s => spy.observe(s));
    return () => spy.disconnect();
  }, []);

  /* ── IntersectionObserver: 섹션 진입 애니메이션 ── */
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.05, rootMargin:"0px 0px -40px 0px" });
    document.querySelectorAll(".reveal, .reveal-fast").forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ── tabs ── */
  const [mainTab, setMainTab]   = useState("company");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("section-overview");
  const [news, setNews]         = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsFilter, setNewsFilter]   = useState("전체");
  const [newsDay, setNewsDay]         = useState(0);
  const [newsDates, setNewsDates]     = useState([]);
  const [breakingNews, setBreakingNews] = useState([]);
  const [newsMeta, setNewsMeta] = useState({ updatedAt: null, total: 0, error: null });

  /* ── 🆕 로보택시 state (v3.2) ── */
  const [roboLatest,  setRoboLatest]  = useState(null);
  const [roboHistory, setRoboHistory] = useState([]);
  const [roboLoading, setRoboLoading] = useState(true);
  const [roboMeta,    setRoboMeta]    = useState({ updatedAt: null, count: 0, error: null, lastError: null });
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
  const [hdrH,    setHdrH]    = useState(60);
  const hdrRef    = useCallback(node => { if (node) setHdrH(node.offsetHeight); }, []);
  const tickerRef = useCallback(node => { if (node) setTickerH(node.offsetHeight); }, []);

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
        // 항상 Worker /stock에서 최신 주가 확인 (Cron 업데이트 반영)
        try {
          const sr = await fetch("https://tesla-proxy.daybridge2025.workers.dev/stock");
          if (sr.ok) {
            const sd = await sr.json();
            if (sd.price) {
              // 저장된 날짜보다 새 데이터면 업데이트
              const storedDate = s?.value ? JSON.parse(s.value).date : "";
              if (!storedDate || sd.date >= storedDate) {
                setStock(prev => ({...prev, ...sd}));
                await LS.set("tsla:stock", JSON.stringify({...sd}));
              }
            }
          }
        } catch(e2) { /* Worker 불가 시 저장값 유지 */ }
        const fsdVal = await LS.get("tsla:fsd");
        if (fsdVal?.value) setFsdMiles(JSON.parse(fsdVal.value));
      } catch(e) { /* storage unavailable, use defaults */ }
      // ── 방문자 카운팅 (Cloudflare Workers KV) ──────────────────
      try {
        const isNew = !sessionStorage.getItem("tsla_visited");
        const res = await fetch("https://tesla-proxy.daybridge2025.workers.dev/count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newVisit: isNew }),
        });
        if (res.ok) {
          const vdata = await res.json();
          setVisitors({ total: vdata.total, today: vdata.today, date: new Date().toISOString().slice(0,10) });
          if (isNew) sessionStorage.setItem("tsla_visited", "1");
        }
      } catch(e2) { /* KV 불가 시 무시 */ }
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
      // Yahoo Finance → Cloudflare Worker /stock 프록시
      const res = await fetch("https://tesla-proxy.daybridge2025.workers.dev/stock");
      if (!res.ok) throw new Error("Worker HTTP "+res.status);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      if (d && d.price) {
        const updated = {...stock, ...d};
        setStock(updated);
        await save("tsla:stock", updated);
        const src = d.cached ? "캐시" : "Yahoo Finance";
        recordLog("stock", true, "$"+d.price+" ("+src+") "+d.date);
      } else throw new Error("구조 오류");
    } catch(e) { recordLog("stock", false, e.message); }
    setLdStock(false);
  }, [stock, save]);

  const updatePerf = useCallback(async () => {
    setLd(l => ({...l, perf:true}));
    try {
      // 1차: SEC EDGAR API 자동 파싱
      let d = null;
      let source = "EDGAR";
      try {
        const res = await fetch("https://tesla-proxy.daybridge2025.workers.dev/edgar");
        if (res.ok) {
          const edgar = await res.json();
          if (edgar.q && edgar.total) {
            d = edgar;
            source = "SEC EDGAR";
          }
        }
      } catch(edgarErr) {
        console.warn("EDGAR 실패, Claude로 대체:", edgarErr.message);
      }

      // 2차: EDGAR 실패 시 Claude AI로 폴백
      if (!d) {
        d = await callClaude(SYS.quarterly, "Find Tesla latest quarterly earnings. Return JSON.");
        source = "Claude AI";
      }

      if (d && d.q && d.total) {
        const exists = quarterly.some(q => q.q === d.q);
        if (!exists) {
          setQuarterly(prev => { const n = [...prev, d]; save("tsla:quarterly", n); return n; });
          recordLog("perf", true, d.q+" 추가 — $"+(d.total/1000).toFixed(1)+"B ("+source+")");
        } else recordLog("perf", false, d.q+" 이미 존재 ("+source+")");
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
    await updateFsd(); await updateFsd(); await updatePerf(); await updateEarnings(); await updateXPost(); await updateOwnership();
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
  const filtPosts = useMemo(() => {
    const q = xSrch.toLowerCase();
    return posts
      .filter(p => (xCat === "ALL" || p.cat === xCat) && (p.en.toLowerCase().includes(q) || p.ko.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [posts, xCat, xSrch]);
  const filtInst  = useMemo(() => instFil === "ALL" ? instActs : instActs.filter(d => d.action === instFil), [instActs, instFil]);

  const capexFcfData = useMemo(() => BASE_Q.slice(-8).map(d => ({q:d.q,capex:d.capex,fcf:d.fcf})), []);

  /* ══════════════════════════════════════
     TAB RENDERERS
  ══════════════════════════════════════ */

  /* ── COMPANY ── */
  const NEWS_CATS = ["전체","FSD","로보택시","실적","Optimus","에너지","규제","머스크발언","주가"];
const SENT_COLOR = {bullish:GR, bearish:R, neutral:MU};
const IMPACT_LABEL = {5:"🔴 긴급", 4:"🟠 주목", 3:"🟡 참고", 2:"🔵 관심", 1:"⚪ 미미"};
const CAT_COLOR = {
  FSD:"rgba(56,189,248,.15)",로보택시:"rgba(16,185,129,.12)",실적:"rgba(251,191,36,.12)",
  Optimus:"rgba(167,139,250,.12)",에너지:"rgba(16,185,129,.12)",규제:"rgba(239,68,68,.12)",
  머스크발언:"rgba(251,191,36,.12)",주가:"rgba(56,189,248,.12)",기타:"rgba(148,163,184,.1)"
};

const NewsTab = () => {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState({});
  const toggle = id => setExpanded(p => ({...p, [id]:!p[id]}));

  /* ── 더보기 페이지네이션 + 날짜별 그룹 접기 상태 ── */
  const CARD_INITIAL = 5, CARD_STEP = 10;
  const [flatVisibleCount, setFlatVisibleCount] = useState(CARD_INITIAL);
  const [groupVisibleCounts, setGroupVisibleCounts] = useState({});
  const [toggledDates, setToggledDates] = useState(() => new Set());
  useEffect(() => {
    setFlatVisibleCount(CARD_INITIAL);
    setGroupVisibleCounts({});
    setToggledDates(new Set());
  }, [newsFilter, newsDay]);
  const toggleDateGroup = date => setToggledDates(prev => {
    const next = new Set(prev);
    next.has(date) ? next.delete(date) : next.add(date);
    return next;
  });

  const filteredNews = news.filter(n => {
    const catOk  = newsFilter === "전체" || n.category === newsFilter;
    const dateOk = newsDay === 0 || n.date === newsDates[newsDay];
    return catOk && dateOk;
  });

  /* 날짜별 그룹 (filteredNews는 이미 날짜desc→임팩트desc 정렬 상태라 재정렬 불필요) */
  const groupedByDate = useMemo(() => {
    const map = new Map();
    filteredNews.forEach(n => {
      if (!map.has(n.date)) map.set(n.date, []);
      map.get(n.date).push(n);
    });
    return [...map.entries()];
  }, [filteredNews]);

  const todayCount  = news.filter(n => n.date === newsDates[0]).length;
  const totalCount  = news.length;

  const renderCard = n => (
    <div key={n.id} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",
      borderLeft:"3px solid "+(n.impact===5?R:n.impact===4?"#fb923c":n.impact===3?YL:"var(--border)")}}>
      {/* 카드 헤더 */}
      <div style={{padding:"12px 14px",cursor:"pointer"}} onClick={()=>toggle(n.id)}>
        {/* 태그 행 */}
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7,alignItems:"center"}}>
          <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fontWeight:700,
            color:n.impact>=4?R:n.impact===3?YL:"var(--text-3)"}}>{IMPACT_LABEL[n.impact]||"⚪"}</span>
          <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fontWeight:600,
            background:CAT_COLOR[n.category]||CAT_COLOR["기타"],
            color:"var(--text-1)",padding:"1px 7px",borderRadius:10}}>{n.category}</span>
          <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,
            color:SENT_COLOR[n.sentiment]||MU,fontWeight:600}}>
            {n.sentiment==="bullish"?"↑긍정":n.sentiment==="bearish"?"↓부정":"→중립"}
          </span>
          <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:"var(--text-3)",marginLeft:"auto"}}>{n.source}</span>
        </div>
        {/* 제목 */}
        <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:isMobile?13:14,fontWeight:700,
          color:"var(--text-1)",lineHeight:1.4,marginBottom:6}}>{n.titleKo}</div>
        {/* 요약 */}
        <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:"var(--text-2)",
          lineHeight:1.7,
          display:expanded[n.id]?"block":"-webkit-box",
          WebkitLineClamp:expanded[n.id]?999:3,
          WebkitBoxOrient:"vertical",
          overflow:"hidden"}}>{n.summaryKo}</div>
        {/* 펼치기 */}
        <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:AC,marginTop:4,cursor:"pointer"}}>
          {expanded[n.id]?"▲ 접기":"▼ 전문 보기"}
        </div>
      </div>
      {/* 카드 푸터 */}
      <div style={{padding:"6px 14px 8px",borderTop:"0.5px solid var(--border-subtle)",
        display:"flex",justifyContent:"space-between",alignItems:"center",
        background:"var(--card-overlay)"}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"var(--text-3)"}}>
          {n.date} {n.collectedAt ? new Date(n.collectedAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})+" KST" : ""}
        </span>
        {n.sourceUrl && (
          <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer"
            style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:AC,textDecoration:"none",fontWeight:600}}>
            원문 보기 →
          </a>
        )}
      </div>
    </div>
  );

  const renderLoadMore = (remaining, onClick) => (
    <button onClick={onClick} style={{display:"block",width:"100%",margin:"10px 0 2px",padding:"9px 16px",
      borderRadius:10,border:"1px solid var(--border)",background:"transparent",color:AC,
      fontFamily:"'Pretendard',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer"}}>
      {"더 보기 (+"+Math.min(CARD_STEP, remaining)+"건)"}
    </button>
  );

  return (
    <div>
      <SHdr sub="TESLA & MUSK NEWS" title="테슬라·머스크 뉴스" />

      {/* 카테고리 필터 */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
        {NEWS_CATS.map(cat => (
          <button key={cat} onClick={()=>setNewsFilter(cat)}
            style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:newsFilter===cat?700:400,
              padding:"4px 10px",borderRadius:20,border:"1px solid "+(newsFilter===cat?R:"var(--border)"),
              background:newsFilter===cat?"rgba(227,25,55,.1)":"transparent",
              color:newsFilter===cat?R:"var(--text-2)",cursor:"pointer"}}>
            {cat}
          </button>
        ))}
      </div>

      {/* 날짜 필터 — 기사가 1건도 없는 날짜(예: 옛날 초기 테스트 잔재)는 목록에서 제외 */}
      <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none",marginBottom:14,paddingBottom:2}}>
        {["전체 기간", ...newsDates.filter(d => news.some(n => n.date === d)).slice(0,7)].map((d,i) => {
          const dIdx = i===0 ? 0 : newsDates.indexOf(d);
          return (
            <button key={i} onClick={()=>setNewsDay(dIdx)}
              style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:newsDay===dIdx?700:400,
                padding:"4px 12px",borderRadius:20,border:"1px solid "+(newsDay===dIdx?AC:"var(--border)"),
                background:newsDay===dIdx?"rgba(56,189,248,.1)":"transparent",
                color:newsDay===dIdx?AC:"var(--text-2)",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
              {i===0 ? "전체 기간" : (d===newsDates[0]?"오늘 "+d.slice(5):d.slice(5))}
            </button>
          );
        })}
      </div>

      {/* 로딩 */}
      {newsLoading && (
        <div style={{textAlign:"center",padding:"40px 0",color:"var(--text-2)",fontFamily:"'Pretendard',sans-serif",fontSize:13}}>
          <div style={{animation:"spin 1s linear infinite",display:"inline-block",marginRight:8}}>◌</div>
          뉴스 수집 중...
        </div>
      )}

      {/* 뉴스 없음 */}
      {!newsLoading && filteredNews.length === 0 && (
        <div style={{textAlign:"center",padding:"40px 0",color:"var(--text-2)",fontFamily:"'Pretendard',sans-serif",fontSize:13}}>
          {newsMeta.error ? (
            <>
              <div style={{color:"#fb923c",marginBottom:6,fontWeight:600}}>⚠ 뉴스 서버 연결 실패</div>
              <div style={{fontSize:11,color:"var(--text-3)"}}>{newsMeta.error}</div>
            </>
          ) : newsMeta.total === 0 ? (
            <>
              <div style={{color:AC,marginBottom:6,fontWeight:600}}>📡 수집된 뉴스 없음</div>
              <div style={{fontSize:11,color:"var(--text-3)"}}>다음 갱신: 매일 09:00 / 16:00 KST</div>
            </>
          ) : (
            <>해당 조건의 뉴스가 없습니다</>
          )}
        </div>
      )}

      {/* 뉴스 카드 목록 — 특정 날짜 선택: 더보기 페이지네이션만 / 전체 기간: 날짜별 그룹 접기 + 그룹별 더보기 */}
      {newsDay !== 0 ? (
        <>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filteredNews.slice(0, flatVisibleCount).map(renderCard)}
          </div>
          {flatVisibleCount < filteredNews.length &&
            renderLoadMore(filteredNews.length - flatVisibleCount, () => setFlatVisibleCount(c => c + CARD_STEP))}
        </>
      ) : (
        groupedByDate.map(([date, items], gi) => {
          const isDefaultOpen = gi === 0; // 가장 최신 날짜만 기본 펼침
          const isOpen = toggledDates.has(date) ? !isDefaultOpen : isDefaultOpen;
          const shown = groupVisibleCounts[date] ?? CARD_INITIAL;
          return (
            <div key={date} style={{marginBottom:10}}>
              <button onClick={()=>toggleDateGroup(date)} style={{width:"100%",display:"flex",
                justifyContent:"space-between",alignItems:"center",padding:"10px 14px",
                background:"var(--card-overlay)",border:"1px solid var(--border)",borderRadius:10,
                cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>
                <span style={{fontSize:12,fontWeight:700,color:"var(--text-1)"}}>
                  {(date===newsDates[0]?"오늘 "+date.slice(5):date.slice(5))+" · "+items.length+"건"}
                </span>
                <span style={{fontSize:11,color:"var(--text-3)"}}>{isOpen?"▲ 접기":"▼ 펼치기"}</span>
              </button>
              {isOpen && (
                <>
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
                    {items.slice(0, shown).map(renderCard)}
                  </div>
                  {shown < items.length &&
                    renderLoadMore(items.length - shown, () => setGroupVisibleCounts(p => ({...p, [date]: shown + CARD_STEP})))}
                </>
              )}
            </div>
          );
        })
      )}

      {/* 통계 */}
      {!newsLoading && (
        <div style={{textAlign:"center",padding:"16px 0",fontFamily:"'Pretendard',sans-serif",
          fontSize:11,color:"var(--text-3)"}}>
          {newsDay===0 ? `전체 ${totalCount}건` : `${newsDates[newsDay]} ${filteredNews.length}건`}
          {" · 최근 30일 누적 · 매일 오전 9시·오후 4시 KST 업데이트"}
          {newsMeta.updatedAt && (
            <div style={{fontSize:10,color:"var(--text-3)",marginTop:4,opacity:.7,fontFamily:"'JetBrains Mono',monospace"}}>
              서버 응답: {new Date(newsMeta.updatedAt).toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})} KST
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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

        {/* 🆕 v3.2 - Robotaxi Austin Fleet (Overview 상단 KPI 그리드) */}
        <div style={{...card, marginBottom:20, background:"linear-gradient(135deg,rgba(6,182,212,.06),rgba(0,0,0,0) 60%)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:12}}>
            <div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:AC,letterSpacing:1,marginBottom:4}}>
                🚕 ROBOTAXI FLEET · AUSTIN
              </div>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:15,fontWeight:700,color:"var(--text-1)"}}>
                {roboLoading ? "로딩 중..." :
                 roboLatest ? `테슬라 로보택시 플릿 현황` :
                 "데이터 준비 중"}
              </div>
            </div>
            {roboLatest && (
              <div style={{textAlign:"right",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"var(--text-3)"}}>
                <div>기준일: {roboLatest.date}</div>
                <div style={{marginTop:2}}>
                  갱신: {roboMeta.updatedAt ? new Date(roboMeta.updatedAt).toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—"}
                </div>
              </div>
            )}
          </div>

          {roboLoading ? (
            <div style={{textAlign:"center",padding:"30px 0",color:"var(--text-3)",fontSize:12,fontFamily:"'Pretendard',sans-serif"}}>
              로보택시 데이터 로딩 중...
            </div>
          ) : roboMeta.error ? (
            <div style={{textAlign:"center",padding:"30px 0",fontFamily:"'Pretendard',sans-serif"}}>
              <div style={{color:"#fb923c",fontSize:13,fontWeight:600,marginBottom:6}}>⚠ 로보택시 데이터 서버 오류</div>
              <div style={{fontSize:11,color:"var(--text-3)"}}>{roboMeta.error}</div>
            </div>
          ) : !roboLatest ? (
            <div style={{textAlign:"center",padding:"30px 0",fontFamily:"'Pretendard',sans-serif"}}>
              <div style={{color:AC,fontSize:13,fontWeight:600,marginBottom:6}}>📡 첫 수집 대기 중</div>
              <div style={{fontSize:11,color:"var(--text-3)"}}>매일 KST 08:00 자동 갱신</div>
            </div>
          ) : (
            <>
              {/* KPI 그리드 6개 */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",gap:10,marginBottom:12}}>
                <KPI label="Rider Vehicles"  value={roboLatest.riderVehicles ?? "—"} sub="30d active"      color={AC} />
                <KPI label="Unsupervised"    value={roboLatest.unsupervised  ?? "—"} sub="30d active"      color={GR} />
                <KPI label="Inactive"        value={roboLatest.inactive      ?? "—"} sub="30d unseen"      color={"#94a3b8"} />
                <KPI label="Cybercabs"       value={roboLatest.cybercabs     ?? "—"} sub="test fleet"      color={"#a78bfa"} />
                <KPI
                  label="Unsup. Rate (7D)"
                  value={roboLatest.unsupRate7D != null ? `${roboLatest.unsupRate7D}%` : "—"}
                  sub={roboLatest.unsupRatio7D ? `${roboLatest.unsupRatio7D.num} of ${roboLatest.unsupRatio7D.den} rides` : "지난 7일"}
                  color={R}
                />
                <KPI
                  label="TxDMV 등록"
                  value={roboLatest.txDmvRegistered != null ? `${roboLatest.txDmvRegistered}대` : "—"}
                  sub="텍사스 차량국 공식"
                  color={"#f59e0b"}
                />
              </div>

              {/* Unsupervised 추이 미니 차트 (2일 이상 데이터 있을 때만) */}
              {roboHistory.length >= 2 && (
                <div style={{marginTop:8,padding:"10px 6px 6px",background:"rgba(0,0,0,.15)",borderRadius:8}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"var(--text-3)",letterSpacing:1,marginBottom:4,paddingLeft:6}}>
                    UNSUPERVISED VEHICLES · {roboHistory.length}일 추이
                  </div>
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={roboHistory} margin={{top:5,right:10,left:0,bottom:0}}>
                      <XAxis
                        dataKey="date"
                        tick={{fontSize:9,fill:"var(--text-3)",fontFamily:"'JetBrains Mono',monospace"}}
                        tickFormatter={(d)=> d ? d.slice(5) : ""}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{fontSize:9,fill:"var(--text-3)",fontFamily:"'JetBrains Mono',monospace"}}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <Tooltip
                        contentStyle={{background:"rgba(15,23,42,.95)",border:"1px solid rgba(255,255,255,.1)",borderRadius:6,fontSize:11,fontFamily:"'Pretendard',sans-serif"}}
                        labelStyle={{color:"var(--text-2)",fontSize:10}}
                        formatter={(v)=>[v,"Unsupervised"]}
                      />
                      <Line type="monotone" dataKey="unsupervised" stroke={GR} strokeWidth={2} dot={{r:2,fill:GR}} activeDot={{r:4}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 출처 표기 */}
              <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid rgba(255,255,255,.05)",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:4,fontSize:10,color:"var(--text-3)",fontFamily:"'Pretendard',sans-serif"}}>
                <div>
                  출처:{" "}
                  <a href="https://robotaxitracker.com/?provider=tesla&area=austin" target="_blank" rel="noopener noreferrer" style={{color:AC,textDecoration:"none"}}>
                    robotaxitracker.com
                  </a>
                  {" · by Ethan McKanna (@ethanmckanna)"}
                </div>
                <div style={{fontFamily:"'JetBrains Mono',monospace"}}>
                  매일 KST 08:00 자동 갱신
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{...card,background:"linear-gradient(135deg,rgba(227,25,55,.08),rgba(0,0,0,0) 60%)",marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16}}>
            <div>
              <div style={lbl}>{"TICKER · NASDAQ · "+stock.date+" 종가"}</div>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:32,fontWeight:800,color:"var(--text-1)",lineHeight:1,letterSpacing:-1}}>TSLA</div>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:20,color:R,marginTop:6}}>{priceStr}</div>
              <div style={{fontSize:11,color:MU,marginTop:4}}>{diffStr + " · " + highStr}</div>
              <div style={{fontSize:12,color:MU,marginTop:10,maxWidth:520,lineHeight:1.7}}>
                전기차 → <strong style={{color:TX}}>물리적 AI 기업</strong>으로 전환 완료 선언.<br/>
                자율주행(FSD)·Robotaxi·Optimus·에너지가 4대 성장 엔진.<br/>
                <strong style={{color:YL}}>2026: Model S·X 단종 → Fremont Optimus 전환 + Terafab 착공</strong>
              </div>
            </div>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(auto-fill,minmax(130px,1fr))",gap:isMobile?8:10,marginBottom:20}}>
          <KPI label="시가총액"         value={mktCap}     sub={stock.date+" 종가 기준"} color={R} />
          <KPI label="2025 연간매출"    value="$94.8B"     sub="YoY -3%" />
          <KPI label="Q1'26 EPS"       value="$0.41"      sub="컨센 +17%" color={GR} />
          <KPI label="다음 실적 발표"   value="7/22"        sub="Q2'26 컨센 EPS $0.45" color={AC} />
          <KPI label="자동차 총이익률"  value="21.1%"      sub="5분기 최고" color={AC} />
          <KPI label="FSD 구독자"       value="128만명"    sub="+51% YoY" color={YL} />
          <KPI label="FSD ARR"          value="$5.46억"    sub="연간 반복매출" color={GR} badge="NEW" />
          <KPI label="2026 CapEx 가이던스" value="$25B+"  sub="기존 $20B → 상향" color={R} badge="↑" />
          <KPI label="현금 & 투자"      value="$44.7B"    sub="Q1'26 기준" />
          <KPI label="52주 범위"        value={rangeVal}   sub={rangeSub} color={MU} />
        </div>

        {/* 2026 전략 피벗 */}
        <div style={{...card,marginBottom:16,borderColor:"rgba(251,191,36,.35)",background:"rgba(251,191,36,.08)"}}>
          <div style={{...lbl,color:YL}}>2026 STRATEGIC PIVOT — 핵심 이벤트</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginTop:12}}>
            {[
              ["🔴 Model S·X 단종","Q2'26 생산 종료. Fremont → Optimus 100만대/년 전환.",R],
              ["🔵 Terafab 착공","Giga Texas $3B 반도체 R&D 팹. Intel 14A. 2026.04.22 착공.",AC],
              ["🟡 CapEx $25B+ 선언","2026 자본지출 $25B+ (2025 $8.5B의 3배). AI·Optimus·Cybercab.",YL],
              ["🟢 Robotaxi 확장","달라스·휴스턴 무사고 운행. FSD v14.3.3 출시.",GR],
            ].map(([t,d,c],i) => (
              <div key={i} style={{background:c+"0d",border:"1px solid "+c+"30",borderRadius:3,padding:"12px 14px"}}>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fontWeight:700,color:c,marginBottom:6}}>{t}</div>
                <div style={{fontSize:11,color:MU,lineHeight:1.65}}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
          <div style={card}>
            <div style={lbl}>{"사업 세그먼트 ("+latestAnnual.y+" 실적 자동 연동)"}</div>
            {segItems.map((seg,i) => {
              const pct = Math.min(Math.round(seg.v / latestAnnual.total * 100) * 2.5, 100);
              return (
                <div key={i} style={{marginTop:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                    <span style={{color:MU}}>{seg.n}</span>
                    <span style={{display:"flex",gap:8}}>
                      <span style={{fontFamily:"'Pretendard',sans-serif",color:TX}}>{"$"+(seg.v/1000).toFixed(1)+"B"}</span>
                      <span style={{fontFamily:"'Pretendard',sans-serif",color:Number(seg.yoy)>=0?GR:R,fontSize:10}}>{"YoY "+(Number(seg.yoy)>=0?"+":"")+seg.yoy+"%"}</span>
                    </span>
                  </div>
                  <div style={{height:5,background:"var(--border-subtle)",borderRadius:3,overflow:"hidden"}}>
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
                <span style={{color:l.startsWith(" ")?"var(--text-3)":MU}}>{l}</span>
                <span style={{fontFamily:"'Pretendard',sans-serif",color:TX,fontSize:12}}>{r}</span>
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
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"300px 1fr",gap:20}}>
        <div>
          <div style={{...card,textAlign:"center",marginBottom:14}}>
            <div style={{width:68,height:68,borderRadius:"50%",background:"linear-gradient(135deg,"+R+",#7b0016)",margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Pretendard',sans-serif",fontSize:22,fontWeight:900,color:"var(--text-1)",border:"3px solid "+R,boxShadow:"0 0 18px rgba(227,25,55,.4)"}}>EM</div>
            <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:15,fontWeight:700,color:"var(--text-1)",marginBottom:2}}>Elon Reeve Musk</div>
            <div style={{fontSize:10,color:R,letterSpacing:0.5,marginBottom:12}}>CHAIRMAN & CEO · TESLA</div>
            {[["출생","1971.06.28 (만 55세 🎂 오늘!)"],["학력","UPenn 경제·물리학"],["CEO 취임","2008.10~ (현재)"],["순자산","~$1.07~1.2조 (2026.06)"],["국적","미국·캐나다·남아공"]].map(([k,v],i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:11}}>
                <span style={{color:MU}}>{k}</span><span style={{fontFamily:"'Pretendard',sans-serif",color:TX}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{...card,marginBottom:14}}>
            <div style={lbl}>보유 기업</div>
            {[["Tesla","~20% (19.9%)",R],["SpaceX (SPCX)","~42% (SPCX)",AC],["X","최대주주 (xAI에 포함)",MU],["xAI","SpaceX에 합병",YL],["Neuralink","공동창업자·CEO",MU],["The Boring Co.","창업자·CEO",MU]].map(([n,v,c],i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:12}}>
                <span style={{color:MU}}>{n}</span><span style={{fontFamily:"'Pretendard',sans-serif",color:c,fontSize:10}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{...card,borderColor:"rgba(251,191,36,.3)"}}>
            <div style={{...lbl,color:YL}}>CEO 보상 마일스톤</div>
            <div style={{fontSize:12,color:MU,marginBottom:10,lineHeight:1.5}}>머스크 보상패키지 조건 달성 현황</div>
            {CEO_MILESTONES.map((m,i) => (
              <div key={i} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:4}}>
                  <span style={{color:MU}}>{i+1+". "+m.n}</span>
                  <span style={{fontFamily:"'Pretendard',sans-serif",color:YL,fontSize:12}}>{m.cur}</span>
                </div>
                <div style={{height:4,background:"var(--border-subtle)",borderRadius:2,overflow:"hidden"}}>
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
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fontWeight:700,color:R,letterSpacing:0.5,marginBottom:2}}>{t.y}</div>
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
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:12,marginBottom:20}}>
        {VALUES.map((v,i) => (
          <div key={i} style={card}>
            <div style={{fontSize:24,marginBottom:8}}>{v.icon}</div>
            <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:R,marginBottom:6}}>{v.t}</div>
            <div style={{fontSize:11,color:MU,lineHeight:1.65}}>{v.d}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
        <div>
          {[["제1원칙","나는 제1원칙에서 추론하는 것이 중요하다고 생각한다. 근본적 진실을 찾아내고 그로부터 추론하는 것이다."],
            ["사명","어떤 것이 충분히 중요하다면, 승산이 없더라도 해야 한다."],
            ["혁신","실패가 없으면 혁신도 없다."],
            ["인간 잠재력","평범한 사람도 비범함을 선택할 수 있다."]].map(([k,q],i) => (
            <div key={i} style={{background:"var(--red-tint)",borderLeft:"3px solid rgba(227,25,55,.4)",borderRadius:"0 4px 4px 0",padding:"12px 16px",marginBottom:10}}>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:R,letterSpacing:0.5,marginBottom:5}}>{k}</div>
              <div style={{fontSize:12,color:TX,lineHeight:1.7,fontStyle:"italic"}}>{"\""+q+"\""}</div>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={lbl}>리더십 스타일 분석</div>
          {[["비전 제시력",98,R],["기술 전문성",92,AC],["리스크 감내력",97,R],["실행 속도",95,GR],["직원 관리 유연성",45,YL],["대중 소통",88,AC]].map(([l,p,c],i) => (
            <div key={i} style={{marginTop:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                <span style={{color:MU}}>{l}</span><span style={{color:TX,fontFamily:"'Pretendard',sans-serif"}}>{p+"%"}</span>
              </div>
              <div style={{height:5,background:"var(--border-subtle)",borderRadius:3,overflow:"hidden"}}>
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

            <LogBadge log={logs.perf} />
          </div>
        </SHdr>
        {/* 서브탭 */}
        <div style={{display:"flex",gap:0,borderBottom:"1px solid rgba(255,255,255,0.07)",marginBottom:18,overflowX:"auto",scrollbarWidth:"none"}}>
          {[["quarterly","분기별"],["annual","연간"],["rd","R&D·CapEx"],["fsd_data","FSD"]].map(([v,l]) => (
            <button key={v} onClick={() => setPerfSub(v)}
              style={{fontFamily:"'Pretendard',sans-serif",fontSize:isMobile?11:13,fontWeight:perfSub===v?700:400,
                letterSpacing:0,padding:isMobile?"10px 12px":"11px 18px",border:"none",whiteSpace:"nowrap",flexShrink:0,
                borderBottom:"2px solid "+(perfSub===v?R:"transparent"),
                background:perfSub===v?"rgba(227,25,55,.07)":"transparent",
                color:perfSub===v?"var(--text-1)":MU,cursor:"pointer"}}>{l}</button>
          ))}
        </div>

        {perfSub === "quarterly" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(auto-fill,minmax(130px,1fr))",gap:isMobile?8:10,marginBottom:16}}>
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
            <div style={{...card,marginBottom:14,borderColor:"rgba(227,25,55,.5)",background:"var(--red-tint)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:22}}>⚠️</div>
                <div>
                  <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:R,letterSpacing:0.5,marginBottom:3}}>2026 CAPEX SHOCK</div>
                  <div style={{fontSize:12,color:TX,lineHeight:1.6}}>
                    2026년 CapEx 가이던스 <strong style={{color:R}}>$25B+</strong> (기존 $20B 대비 25% 상향, 2025년의 3배).
                    <strong style={{color:YL}}> FCF 음전환 예고</strong> — "몇 년간 지속될 대규모 투자 단계" (머스크)
                  </div>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
              <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:MU,alignSelf:"center",letterSpacing:0.5}}>FILTER:</span>
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
                  <ResponsiveContainer width="100%" height={isMobile?160:220}>
                    <BarChart data={filtQ} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-overlay)" />
                      <XAxis dataKey="q" tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} />
                      <YAxis tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(0)+"B"} />
                      <Tooltip content={<RevTip />} />
                      <Legend wrapperStyle={{fontFamily:"'Pretendard',sans-serif",fontSize:12}} />
                      <Bar dataKey="auto"     name="자동차"     stackId="a" fill={R}  isAnimationActive={false}/>
                      <Bar dataKey="energy"   name="에너지"     stackId="a" fill={AC}  isAnimationActive={false}/>
                      <Bar dataKey="services" name="서비스/FSD" stackId="a" fill={GR} radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
              {perfView === "margin" && (
                <>
                  <div style={lbl}>총이익률 추이 (%)</div>
                  <ResponsiveContainer width="100%" height={isMobile?160:220}>
                    <LineChart data={filtQ.filter(d => d.gm)} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-overlay)" />
                      <XAxis dataKey="q" tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} />
                      <YAxis domain={[10,35]} tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} tickFormatter={v => v+"%"} />
                      <Tooltip formatter={v => [v+"%","총이익률"]} />
                      <ReferenceLine y={18} stroke="rgba(251,191,36,.3)" strokeDasharray="4 4" />
                      <Line dataKey="gm" stroke={R} dot={{r:2}} strokeWidth={2}  isAnimationActive={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
              {perfView === "income" && (
                <>
                  <div style={lbl}>영업이익 추이 ($M)</div>
                  <ResponsiveContainer width="100%" height={isMobile?160:220}>
                    <BarChart data={filtQ.filter(d => d.opInc != null)} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-overlay)" />
                      <XAxis dataKey="q" tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} />
                      <YAxis tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(1)+"B"} />
                      <Tooltip content={<RevTip />} />
                      <ReferenceLine y={0} stroke="var(--border)" />
                      <Bar dataKey="opInc" name="영업이익" fill={R} radius={[2,2,0,0]}  isAnimationActive={false}/>
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
            {/* 데이터 테이블 */}
            <div style={card}>
              <div style={lbl}>{"전체 분기 데이터 ("+quarterly.length+"개 분기) — R&D·CapEx 포함"}</div>
              <div style={{overflowX:"auto",marginTop:10,WebkitOverflowScrolling:"touch",position:"relative"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Pretendard',sans-serif",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid rgba(227,25,55,.3)"}}>
                      {["분기","총매출","자동차","에너지","서비스","총이익률","영업이익","EPS","FCF","R&D","CapEx"].map(h => (
                        <th key={h} style={{padding:"6px 8px",color:h==="R&D"||h==="CapEx"?AC:R,textAlign:"right",fontWeight:400,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...filtQ].reverse().map((d,i) => (
                      <tr key={d.q} style={{borderBottom:"1px solid rgba(255,255,255,.04)",background:i%2?"var(--card-overlay)":"transparent"}}>
                        <td style={{padding:"5px 8px",color:R,letterSpacing:1}}>{d.q}</td>
                        <td style={{padding:"5px 8px",textAlign:"right"}}>{d.total.toLocaleString()}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:R}}>{d.auto.toLocaleString()}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:AC}}>{d.energy.toLocaleString()}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:GR}}>{d.services.toLocaleString()}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:d.gm>=20?GR:d.gm>=17?YL:R}}>{d.gm != null ? d.gm+"%" : "—"}</td>
                        <td style={{padding:"5px 8px",textAlign:"right",color:d.opInc>0?"var(--text-1)":"#ff6b6b"}}>{d.opInc != null ? d.opInc.toLocaleString() : "—"}</td>
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
                  <ResponsiveContainer width="100%" height={isMobile?160:240}>
                    <BarChart data={ANNUAL} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-overlay)" />
                      <XAxis dataKey="y" tick={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fill:MU}} />
                      <YAxis tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(0)+"B"} />
                      <Tooltip content={<RevTip />} /><Legend wrapperStyle={{fontFamily:"'Pretendard',sans-serif",fontSize:12}} />
                      <Bar dataKey="auto"     name="자동차"     stackId="a" fill={R}  isAnimationActive={false}/>
                      <Bar dataKey="energy"   name="에너지"     stackId="a" fill={AC}  isAnimationActive={false}/>
                      <Bar dataKey="services" name="서비스/FSD" stackId="a" fill={GR} radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
              {annV === "margin" && (
                <>
                  <div style={lbl}>연간 총이익률</div>
                  <ResponsiveContainer width="100%" height={isMobile?160:240}>
                    <LineChart data={ANNUAL} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-overlay)" />
                      <XAxis dataKey="y" tick={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fill:MU}} />
                      <YAxis domain={[10,30]} tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} tickFormatter={v => v+"%"} />
                      <Tooltip formatter={v => [v+"%","총이익률"]} />
                      <Line dataKey="gm" stroke={R} dot={{r:5,fill:R}} strokeWidth={3}  isAnimationActive={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
              {annV === "income" && (
                <>
                  <div style={lbl}>연간 영업이익 & 순이익</div>
                  <ResponsiveContainer width="100%" height={isMobile?160:240}>
                    <BarChart data={ANNUAL} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-overlay)" />
                      <XAxis dataKey="y" tick={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fill:MU}} />
                      <YAxis tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(0)+"B"} />
                      <Tooltip content={<RevTip />} /><Legend wrapperStyle={{fontFamily:"'Pretendard',sans-serif",fontSize:12}} />
                      <ReferenceLine y={0} stroke="var(--border)" />
                      <Bar dataKey="opInc"  name="영업이익" fill={R}  radius={[2,2,0,0]}  isAnimationActive={false}/>
                      <Bar dataKey="netInc" name="순이익"   fill={AC} radius={[2,2,0,0]}  isAnimationActive={false}/>
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
              {annV === "rd_capex" && (
                <>
                  <div style={lbl}>연간 R&D & CapEx ($M)</div>
                  <ResponsiveContainer width="100%" height={isMobile?160:240}>
                    <ComposedChart data={ANNUAL} margin={{top:6,right:10,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-overlay)" />
                      <XAxis dataKey="y" tick={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fill:MU}} />
                      <YAxis tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(0)+"B"} />
                      <Tooltip content={<RevTip />} /><Legend wrapperStyle={{fontFamily:"'Pretendard',sans-serif",fontSize:12}} />
                      <Bar dataKey="rd"    name="R&D"    fill={AC}       opacity={0.85}  isAnimationActive={false}/>
                      <Bar dataKey="capex" name="CapEx"  fill="#a78bfa"  opacity={0.85}  isAnimationActive={false}/>
                      <Line dataKey="opInc" name="영업이익" stroke={R} dot={false} strokeWidth={2} strokeDasharray="5 3"  isAnimationActive={false}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
            <div style={card}>
              <div style={lbl}>연간 요약 테이블 (R&D·CapEx 포함)</div>
              <div style={{overflowX:"auto",marginTop:10,WebkitOverflowScrolling:"touch",position:"relative"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Pretendard',sans-serif",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid rgba(227,25,55,.3)"}}>
                      {["연도","총매출","자동차","에너지","서비스","총이익률","영업이익","순이익","R&D","CapEx"].map(h => (
                        <th key={h} style={{padding:"7px 10px",color:h==="R&D"?AC:h==="CapEx"?"#a78bfa":R,textAlign:"right",fontWeight:400}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...ANNUAL].reverse().map((d,i) => (
                      <tr key={d.y} style={{borderBottom:"1px solid rgba(255,255,255,.04)",background:i%2?"var(--card-overlay)":"transparent"}}>
                        <td style={{padding:"7px 10px",color:R,fontWeight:700}}>{d.y}</td>
                        <td style={{padding:"7px 10px",textAlign:"right"}}>{"$"+(d.total/1000).toFixed(1)+"B"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:R}}>{"$"+(d.auto/1000).toFixed(1)+"B"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:AC}}>{"$"+(d.energy/1000).toFixed(1)+"B"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:GR}}>{"$"+(d.services/1000).toFixed(1)+"B"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:d.gm>=22?GR:d.gm>=18?YL:R}}>{d.gm+"%"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:d.opInc>0?"var(--text-1)":"#ff6b6b"}}>{"$"+(d.opInc/1000).toFixed(1)+"B"}</td>
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
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(auto-fill,minmax(130px,1fr))",gap:isMobile?8:10,marginBottom:16}}>
              <KPI label="Q1'26 R&D"           value="$1.95B" sub="매출 9% · YoY +38%" color={AC} badge="NEW" />
              <KPI label="2025 연간 R&D"        value="$6.74B" sub="YoY +46%"            color={AC} />
              <KPI label="Q1'26 CapEx"          value="$2.49B" sub="YoY +67%"            color="#a78bfa" badge="↑" />
              <KPI label="2026 CapEx 가이던스"  value="$25B+"  sub="2025 $8.5B의 3배"   color={R}  badge="⚠" />
              <KPI label="Terafab 투자액"        value="$3B"    sub="Giga Texas 반도체 팹" color={YL} badge="NEW" />
              <KPI label="FCF Q1'26"             value="$1.44B" sub="음전환 예고"         color={YL} />
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
              <div style={card}>
                <div style={lbl}>분기별 R&D 지출 추이 ($M)</div>
                <ResponsiveContainer width="100%" height={isMobile?150:200}>
                  <AreaChart data={BASE_Q.filter(d => d.rd).slice(-12)} margin={{top:6,right:8,left:0,bottom:0}}>
                    <defs>
                      <linearGradient id="rdg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={AC} stopOpacity={.3} />
                        <stop offset="95%" stopColor={AC} stopOpacity={0}  />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-overlay)" />
                    <XAxis dataKey="q" tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} />
                    <YAxis tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(1)+"B"} />
                    <Tooltip formatter={v => ["$"+v+"M","R&D"]} />
                    <Area dataKey="rd" stroke={AC} fill="url(#rdg)" strokeWidth={2}  isAnimationActive={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={card}>
                <div style={lbl}>CapEx vs FCF (최근 8분기, $M)</div>
                <ResponsiveContainer width="100%" height={isMobile?150:200}>
                  <ComposedChart data={capexFcfData} margin={{top:6,right:8,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-overlay)" />
                    <XAxis dataKey="q" tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} />
                    <YAxis tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} tickFormatter={v => "$"+(v/1000).toFixed(1)+"B"} />
                    <Tooltip content={<RevTip />} /><Legend wrapperStyle={{fontFamily:"'Pretendard',sans-serif",fontSize:12}} />
                    <ReferenceLine y={0} stroke="var(--border)" />
                    <Bar dataKey="capex" name="CapEx" fill="#a78bfa" opacity={0.85}  isAnimationActive={false}/>
                    <Line dataKey="fcf" name="FCF" stroke={GR} dot={{r:3}} strokeWidth={2}  isAnimationActive={false}/>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Terafab 상세 */}
            <div style={{...card,borderColor:"rgba(251,191,36,.35)",background:"rgba(251,191,36,.08)"}}>
              <div style={{...lbl,color:YL}}>TERAFAB — 테슬라 반도체 R&D 팹</div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14,marginTop:12}}>
                {[
                  ["📍 위치","Giga Texas (오스틴)","착공 2026.04.22"],
                  ["💰 투자","Tesla 단독 $3B","전체 프로젝트: $55B~$119B"],
                  ["🤝 파트너","Intel (14A 공정)","SpaceX·xAI 공동"],
                  ["⚙️ 역할","월 수천 장 웨이퍼","반도체 물리학 검증"],
                  ["🎯 목적","AI5 칩·FSD HW 자체조달","AI 컴퓨팅 독립"],
                  ["📅 전략","15년 장기 프로젝트","고용 유지·증가"],
                ].map(([icon,main,sub],i) => (
                  <div key={i} style={{background:"var(--card-overlay)",border:"1px solid rgba(255,255,255,.08)",borderRadius:3,padding:"12px 14px"}}>
                    <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:YL,marginBottom:6}}>{icon}</div>
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

                <LogBadge log={logs.fsd} />
              </div>
            </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(auto-fill,minmax(130px,1fr))",gap:isMobile?8:10,marginBottom:16}}>
              <KPI label="FSD 구독자" value="128만명" sub="Q1'26 · YoY +51%" color={AC} badge="NEW" />
              <KPI label="FSD ARR"    value="$5.46억" sub="연간 반복매출"     color={GR} badge="NEW" />
              <KPI label="FSD 취득률" value="~14%"   sub="누적 인도 920만대 대비" color={YL} badge="NEW" />
              <KPI label="구독자(월정액)" value="476,100명" sub="$546M ARR"   color={AC} />
              <KPI label="일시불 구매자"  value="823,900명" sub="2026.02 폐지" color={MU} />
              <KPI label="FSD 누적 주행" value={(fsdMiles.totalMiles/1e9).toFixed(2)+"B 마일"} sub={"목표 100억 마일 달성! · 일 "+Math.round(fsdMiles.dailyMiles/1e6)+"M 마일"} color={GR} badge="✅" />
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
              <div style={card}>
                <div style={lbl}>FSD 활성 구독자 추이 (백만명)</div>
                <ResponsiveContainer width="100%" height={isMobile?150:200}>
                  <AreaChart data={FSD_SUBS} margin={{top:6,right:8,left:0,bottom:0}}>
                    <defs>
                      <linearGradient id="fsdg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={AC} stopOpacity={.4} />
                        <stop offset="95%" stopColor={AC} stopOpacity={0}  />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-overlay)" />
                    <XAxis dataKey="q" tick={{fontFamily:"'Pretendard',sans-serif",fontSize:12,fill:MU}} />
                    <YAxis domain={[0,1.5]} tick={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fill:MU}} tickFormatter={v => v+"M"} />
                    <Tooltip formatter={v => [v+"M명","구독자"]} />
                    <Area dataKey="subs" stroke={AC} fill="url(#fsdg)" strokeWidth={2} dot={{r:4,fill:AC}}  isAnimationActive={false}/>
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
                          <span style={{fontFamily:"'Pretendard',sans-serif",color:done?GR:AC}}>{(fsdMiles.totalMiles/1e9).toFixed(3)+"B 마일"}</span>
                        </div>
                        <div style={{height:20,background:"var(--border-subtle)",borderRadius:10,overflow:"hidden",marginBottom:8,position:"relative"}}>
                          <div style={{height:"100%",width:pct+"%",background:done?"linear-gradient(90deg,"+GR+",#00ff88)":"linear-gradient(90deg,"+AC+","+GR+")",borderRadius:10,transition:"width 1s ease"}} />
                          {done && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Pretendard',sans-serif",fontSize:12,color:"#000",fontWeight:700}}>✅ 100억 마일 달성!</div>}
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
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20,marginTop:14}}>
                <div>
                  <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:GR,letterSpacing:0.5,marginBottom:8}}>✅ 승인 완료</div>
                  {[["🇺🇸 미국 (감독하)","FSD v14.3.3 · 전국"],["🇺🇸 로보택시 (무감독)","오스틴·달라스·휴스턴"],["🇨🇦 캐나다","운영 중"],["🇳🇱 네덜란드","유럽 첫 승인"],["🇲🇽 멕시코","운영 중"]].map(([c,s],i) => (
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:11}}>
                      <span style={{color:MU}}>{c}</span><span style={{fontFamily:"'Pretendard',sans-serif",color:GR,fontSize:12}}>{s}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:YL,letterSpacing:0.5,marginBottom:8}}>🟡 심사 진행 중 (12개국)</div>
                  {[["🇨🇳 중국","Q3'26 전면 승인 예상"],["🇧🇪 벨기에","5,000km 테스트 완료"],["🇪🇸 스페인","80,000km 무사고 완료"],["🇬🇧 영국","2026년 승인 예상"],["🇫🇷 프랑스","EU 심의 연동"],["🇦🇺 호주·뉴질랜드","v14 테스트 중"]].map(([c,s],i) => (
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:11}}>
                      <span style={{color:MU}}>{c}</span><span style={{fontFamily:"'Pretendard',sans-serif",color:YL,fontSize:12}}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{marginTop:14,borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:14}}>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:AC,letterSpacing:0.5,marginBottom:8}}>FSD 비즈니스 모델 전환</div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:10}}>
                  {[
                    ["구독 전용 전환","2026.02.14 일시불 폐지. 월정액만 가능. 예측 가능한 반복 매출 확보.",AC],
                    ["가격 인상 예고","기능 고도화에 따라 구독료 인상 계획. 현재 북미 $99/월.",YL],
                    ["CEO 보상 연계","FSD 구독자 1,000만명 달성 조건. 현재 128만명 (12.8%).",R],
                  ].map(([t,d,c],i) => (
                    <div key={i} style={{background:c+"0d",border:"1px solid "+c+"30",borderRadius:3,padding:"10px 12px"}}>
                      <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:c,marginBottom:5}}>{t}</div>
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
      <div style={{...card,marginBottom:16,borderColor:"rgba(227,25,55,.4)",background:"var(--red-tint)"}}>
        {/* 상단: 레이블 + 단종 배지 */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:8}}>
          <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:R,letterSpacing:0.5,textTransform:"uppercase"}}>MODEL S · MODEL X</span>
          <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:600,color:R,background:"rgba(227,25,55,.15)",padding:"3px 10px",borderRadius:10,border:"0.5px solid rgba(227,25,55,.3)"}}>2026 Q2 단종</span>
        </div>
        {/* 타이틀 */}
        <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:16,fontWeight:800,color:"var(--text-1)",marginBottom:12}}>명예로운 퇴역 선언</div>
        {/* 인용구 */}
        <div style={{background:"var(--card-overlay)",borderLeft:"2px solid rgba(255,214,0,.5)",padding:"8px 12px",borderRadius:"0 6px 6px 0",marginBottom:10}}>
          <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:MU,marginBottom:3}}>Elon Musk · Q4'25 어닝콜</div>
          <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:isMobile?12:13,color:YL,fontStyle:"italic",lineHeight:1.6}}>
            {"\"이제 Model S와 X를 명예로운 퇴역으로 종료할 시간입니다.\""}
          </div>
        </div>
        {/* 팩트 */}
        <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:MU,lineHeight:1.7,marginBottom:10}}>
          2012년(S) · 2015년(X) 출시 이후 누적 75.5만대 생산. 2025년 인도량 단 <strong style={{color:TX}}>3% 수준</strong>으로 전락.
        </div>
        {/* 전환 강조 박스 */}
        <div style={{background:"rgba(16,185,129,.07)",border:"0.5px solid rgba(16,185,129,.3)",borderRadius:8,padding:"10px 14px"}}>
          <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,fontWeight:700,color:GR,marginBottom:3}}>Fremont 라인 전환 계획</div>
          <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:"rgba(16,185,129,.8)",lineHeight:1.6}}>
            Model S·X 생산 종료 후 → <strong style={{color:GR}}>Optimus 100만대/년</strong> 라인으로 전환<br/>
            <span style={{fontSize:11,color:MU}}>전환 소요 기간: 6~8개월</span>
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:16}}>
        {[
          {n:"Model 3 / Model Y",  st:"PRODUCTION",        sc:"live",d:"핵심 볼륨 모델. 상하이·프리몬트·베를린 생산. 195만대/년.",ex:"195만대/년",ec:GR},
          {n:"Cybertruck",          st:"PRODUCTION",        sc:"live",d:"스테인리스 풀사이즈 픽업. 텍사스 생산. 수율 안정화.",ex:">12.5만대/년",ec:GR},
          {n:"Cybercab (로보택시)", st:"PRODUCTION → RAMP", sc:"ramp",d:"2026.02 첫 차량 출고, 4월 연속생산 시작. NHTSA 2,500대 상한 제외 확보. 오스틴 전역·텍사스 2개 도시 무감독 운행 확장(2026.06). 초기 생산 극도로 느리다가 연말 급증 예상.",ex:"오스틴 전역 + 텍사스 2개 도시 운영 중",ec:GR},
          {n:"Optimus V3",          st:"DEV → PRODUCTION",  sc:"dev", d:"Q1'26 V3 공개. Fremont 라인 설치 중. 목표: 100만대/년 · 단가 $20,000. 2027년 텍사스 2공장.",ex:"100만대/년 목표 · $20K 목표가",ec:AC},
          {n:"Megapack / Powerwall",st:"PRODUCTION·SCALING",sc:"live",d:"에너지 저장. 2025년 $12.8B(+27% YoY). CA·상하이·TX 생산. 2025 배포 46.7GWh(+48%). 2026.06.23 NatPower(이탈리아·영국) $4~5B 계약 체결 — 25GWh 1단계(CA 공장 연산 62.5%), 장기 목표 100GWh·$15B 이상(20년). Autobidder 포함 수직통합.",ex:"NatPower $5B · 46.7GWh 배포",ec:GR},
          {n:"FSD",                 st:"SCALING",           sc:"ramp",d:"v14.3.4: Cybertruck Smart Summon 추가. 구독자 128만명(+51%). 네덜란드·벨기에 유럽 승인. 독일·핀란드 선제 승인 검토(EU 공식 결정 10월 예정). 스웨덴 반대 권고(속도위반). 한국 포함 12개국 심사 중.",ex:"독일·핀란드 선제 검토 · ARR $546M",ec:YL},
          {n:"Tesla Semi",          st:"PILOT PRODUCTION",  sc:"ramp",d:"전기 대형트럭. 2026년 생산 돌입 예정.",ex:"2026년 양산 목표",ec:YL},
          {n:"MEGAPOD",              st:"TRADEMARK FILED",   sc:"dev", d:"2026.06.18 USPTO 상표 출원. 모듈형 AI 데이터센터 하드웨어(서버·PDU·냉각 포함). Supercharger 7GW 전력 활용 분산 AI 인프라 구상. Digital Optimus와 연계.",ex:"2026.06.18 출원 · 미출시",ec:AC},
          {n:"Tesla Roadster (2세대)",st:"REVEAL 예정",        sc:"dev", d:"2026년 8월 공개·데모 이벤트 예정. Musk Q1'26 어닝콜에서 공개 지연 확인. SpaceX 패키지(냉기 추진기) 포함. $200K~250K 예정. 양산 2027년 시작.",ex:"2026.08 공개 예정 · $200K~250K",ec:YL},
          {n:"Model Y L (장축형)",   st:"UNDER DEVELOPMENT", sc:"dev", d:"4.28m 소형 SUV. 2026년 9월 상하이 양산 시작(AutoForecast). 자율주행 버전 포함 계획. 미국·유럽 생산은 2028년 이후.",ex:"2026.09 상하이 양산 예정",ec:AC},
          {n:"Terafab",             st:"UNDER CONSTRUCTION",sc:"dev", d:"Giga Texas $3B 반도체 R&D 팹. Intel 14A. SpaceX·xAI 공동. 착공 2026.04.22.",ex:"$3B · Intel 14A · 착공 완료",ec:AC},
        ].map((p,i) => {
          const sc = {live:{bg:"rgba(16,185,129,.15)",c:GR},ramp:{bg:"rgba(251,191,36,.15)",c:YL},dev:{bg:"rgba(56,189,248,.15)",c:AC}}[p.sc];
          return (
            <div key={i} style={card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,fontWeight:700,color:"var(--text-1)"}}>{p.n}</div>
                <span style={{background:sc.bg,color:sc.c,fontFamily:"'Pretendard',sans-serif",fontSize:10,padding:"2px 7px",borderRadius:2,whiteSpace:"nowrap"}}>{p.st}</span>
              </div>
              <div style={{fontSize:11,color:MU,lineHeight:1.65,marginBottom:8}}>{p.d}</div>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:p.ec}}>{p.ex}</div>
            </div>
          );
        })}
      </div>
      <div style={card}>
        <div style={lbl}>2026~2030 시나리오</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:12,marginTop:12}}>
          {[
            ["BULL","$1,200+",GR,"rgba(16,185,129,.08)","rgba(16,185,129,.2)","Robotaxi 네트워크 효과·Optimus 대량생산·FSD 전세계 승인·Terafab 칩 자체조달"],
            ["BASE 2026","$350~450","var(--text-1)","var(--red-tint)",BD,"CapEx $25B 부담·Cybercab 양산 지연·유럽 FSD 지연"],
            ["VISION 2030","$700~1,000",YL,"rgba(251,191,36,.08)","rgba(251,191,36,.2)","자동차 46%→, Robotaxi·Optimus·에너지 분산. AI 플랫폼 기업 전환"],
          ].map(([l,v,vc,bg,br,d],i) => (
            <div key={i} style={{background:bg,border:"1px solid "+br,borderRadius:4,padding:14}}>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:vc,letterSpacing:0.5,marginBottom:6}}>{l}</div>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:16,fontWeight:700,color:vc,marginBottom:6}}>{v}</div>
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
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
        <div style={card}>
          <div style={lbl}>핵심 리스크 레이더</div>
          {[["CapEx $25B 과부하",90,R,"NEW"],["FSD 안전성 美상원·EU 조사",88,R,"NEW"],["스웨덴 FSD 반대↔독일 선제 승인",82,YL,"NEW"],["NHTSA Model 3 충돌 조사",82,R,"NEW"],["경쟁 심화 (BYD·中)",80,R,null],["FSD 규제 지연",78,R,null],["머스크 집중 리스크",75,R,null],["Optimus 생산 불확실성",70,YL,"NEW"],["유럽 브랜드 부진",68,YL,null],["Terafab 실행 리스크",62,YL,"NEW"],["배터리 공급 제약",50,YL,null],["재무 유동성",22,GR,null]].map(([l,p,c,badge],i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginTop:11}}>
              <div style={{width:140,fontSize:10,color:MU,flexShrink:0,display:"flex",alignItems:"center",gap:5}}>
                {l}
                {badge && <span style={{background:c+"20",border:"1px solid "+c+"50",color:c,fontSize:10,padding:"1px 4px",borderRadius:2}}>{badge}</span>}
              </div>
              <div style={{flex:1,height:6,background:"var(--border-subtle)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:p+"%",background:c,borderRadius:3}} />
              </div>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:MU,width:28,textAlign:"right"}}>{p+"%"}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{...card,marginBottom:12}}>
            <div style={lbl}>2026 핵심 모니터링</div>
            {[["🔴 스웨덴·NHTSA FSD 안전성 조사","유럽 확장 지연 최대 변수",R],["🔴 FSD 안전성 美상원·EU 조사","로보택시 확장 지연 변수",R],["🔴 CapEx $25B 집행 속도","FCF 음전환 타이밍",R],["🔴 Cybercab 양산 전환","핵심 밸류에이션 변수",R],["🔴 Optimus 2026 생산량","머스크 '예측 불가'",R],["🟡 FSD 중국 전면 승인","Q3'26 목표",YL],["🟡 Terafab 건설 진척","Intel 파트너십",YL],["🟡 FSD 구독자 증가율","CEO 보상 마일스톤",YL],["🟢 에너지 사업 성장","안정 +27%",GR],["🟢 FSD ARR $546M","고마진 반복매출",GR]].map(([l,v,c],i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:11}}>
                <span style={{color:MU}}>{l}</span><span style={{fontFamily:"'Pretendard',sans-serif",color:c,fontSize:12}}>{v}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
      <div style={card}>
        <div style={lbl}>종합 결론</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20,marginTop:12}}>
          {[
            ["TESLA 2026 투자 테제",R,"CapEx $25B 충격은 단기 FCF 압박이나, AI 인프라·Optimus·Terafab 투자가 2027~28년 수익으로 연결되는 구조. FSD ARR·에너지 성장이 버퍼 역할. 현재 ~366x PER(2026.06 기준)은 AI·자율주행 테제 프리미엄. 다음 실적 발표 2026.07.22 예정."],
            ["FSD → ROBOTAXI → OPTIMUS 로드맵",AC,"FSD 취득률 14%·구독 전용 전환이 반복 수익 기반 구축. 10억 마일 목표 도달 시 무감독 FSD 전면화. Robotaxi 확장 → Optimus 양산이 순차적 밸류에이션 리레이팅 핵심."],
          ].map(([t,c,d],i) => (
            <div key={i}>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:c,letterSpacing:0.5,marginBottom:8}}>{t}</div>
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

          <LogBadge log={logs.earnings} />
        </div>
      </SHdr>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <input style={{...inp,flex:1,minWidth:180}} placeholder="🔍 분기·키워드·태그 검색..." value={eSearch} onChange={e => setESearch(e.target.value)} />
        <button style={{...fb(true),padding:"7px 14px"}} onClick={() => setShowForm(!showForm)}>{showForm ? "✕ 닫기" : "+ 직접 추가"}</button>
      </div>
      {showForm && (
        <div style={{...card,marginBottom:12,borderColor:"rgba(56,189,248,.4)"}}>
          <div style={{...lbl,color:AC}}>MANUAL ENTRY</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:8,marginTop:8}}>
            <div><div style={{fontSize:12,color:MU,marginBottom:2}}>분기</div><input style={{...inp,width:"100%"}} value={nc.q} onChange={e => setNc({...nc,q:e.target.value})} /></div>
            <div><div style={{fontSize:12,color:MU,marginBottom:2}}>날짜</div><input style={{...inp,width:"100%"}} type="date" value={nc.date} onChange={e => setNc({...nc,date:e.target.value})} /></div>
            <div><div style={{fontSize:12,color:MU,marginBottom:2}}>감성</div>
              <select style={{...inp,width:"100%"}} value={nc.sentiment} onChange={e => setNc({...nc,sentiment:e.target.value})}>
                <option value="positive">▲ 긍정</option><option value="mixed">◆ 혼조</option><option value="negative">▼ 부진</option>
              </select></div>
          </div>
          <div style={{marginTop:7}}><div style={{fontSize:12,color:MU,marginBottom:2}}>헤드라인</div><input style={{...inp,width:"100%"}} value={nc.headline} onChange={e => setNc({...nc,headline:e.target.value})} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 3fr",gap:8,marginTop:7}}>
            <div><div style={{fontSize:12,color:MU,marginBottom:2}}>발언자</div><input style={{...inp,width:"100%"}} value={nc.s1} onChange={e => setNc({...nc,s1:e.target.value})} /></div>
            <div><div style={{fontSize:12,color:MU,marginBottom:2}}>발언</div><input style={{...inp,width:"100%"}} value={nc.q1} onChange={e => setNc({...nc,q1:e.target.value})} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginTop:7}}>
            {[["r","매출"],["e","EPS"],["g","총이익률"],["o","영업이익"],["rd","R&D"],["capex","CapEx"]].map(([k,l]) => (
              <div key={k}><div style={{fontSize:12,color:MU,marginBottom:2}}>{l}</div><input style={{...inp,width:"100%"}} value={nc[k]} onChange={e => setNc({...nc,[k]:e.target.value})} /></div>
            ))}
          </div>
          <div style={{marginTop:7}}><div style={{fontSize:12,color:MU,marginBottom:2}}>태그 (쉼표 구분)</div><input style={{...inp,width:"100%"}} value={nc.tags} onChange={e => setNc({...nc,tags:e.target.value})} /></div>
          <div style={{display:"flex",gap:7,marginTop:10}}>
            <button onClick={addCall} style={{background:"rgba(227,25,55,.2)",border:"1px solid "+R,color:R,padding:"6px 16px",borderRadius:3,cursor:"pointer",fontFamily:"'Pretendard',sans-serif",fontSize:12}}>저장</button>
            <button onClick={() => setShowForm(false)} style={{background:"transparent",border:"1px solid rgba(255,255,255,.15)",color:MU,padding:"6px 16px",borderRadius:3,cursor:"pointer",fontFamily:"'Pretendard',sans-serif",fontSize:12}}>취소</button>
          </div>
        </div>
      )}
      <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:MU,marginBottom:8,letterSpacing:0.5}}>{"ARCHIVE — "+filtCalls.length+"건 (R&D·CapEx 포함)"}</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtCalls.map(c => {
          const st = SENT_ST[c.sentiment];
          const open = openCall === c.id;
          const sentLabel = {positive:"긍정",mixed:"혼조",negative:"부진"}[c.sentiment]||c.sentiment;
          return (
            <div key={c.id} style={{background:SF,border:"0.5px solid "+st.br,borderLeft:"3px solid "+st.c,borderRadius:8,overflow:"hidden"}}>
              <div style={{padding:"12px 14px",cursor:"pointer"}} onClick={() => setOpenCall(open ? null : c.id)}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:14,fontWeight:800,color:st.c}}>{c.q}</span>
                    <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fontWeight:600,color:st.c,background:st.c+"18",padding:"2px 8px",borderRadius:10}}>{sentLabel}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:MU}}>{c.date}</span>
                    <span style={{fontSize:10,color:MU}}>{open?"▲":"▼"}</span>
                  </div>
                </div>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:13,fontWeight:600,color:TX,lineHeight:1.5,marginBottom:c.highlight?6:8}}>{c.headline}</div>
                {c.highlight && (
                  <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:st.c,marginBottom:8}}>{c.highlight}</div>
                )}
                {c.tags.length > 0 && (
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {c.tags.slice(0,4).map(t => (
                      <span key={t} style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,background:"rgba(227,25,55,.1)",border:"0.5px solid rgba(227,25,55,.25)",color:R,padding:"2px 8px",borderRadius:10}}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {open && (
                <div style={{padding:"10px 14px 14px",borderTop:"0.5px solid rgba(255,255,255,.06)",background:"var(--card-overlay)"}}>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:6,marginBottom:12}}>
                    {Object.entries(c.m).map(([k,v]) => v ? (
                      <div key={k} style={{background:SF2,border:"0.5px solid rgba(255,255,255,.07)",borderRadius:6,padding:"7px 10px"}}>
                        <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:k==="rd"||k==="capex"?AC:MU,fontWeight:500,marginBottom:3}}>{k==="rd"?"R&D":k==="capex"?"CapEx":k.toUpperCase()}</div>
                        <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:13,fontWeight:700,color:k==="rd"||k==="capex"?AC:st.c}}>{v}</div>
                      </div>
                    ) : null)}
                  </div>
                  {c.quotes.map((q,i) => (
                    <div key={i} style={{background:"rgba(227,25,55,.04)",borderLeft:"2px solid rgba(227,25,55,.4)",padding:"8px 12px",marginBottom:6,borderRadius:"0 6px 6px 0"}}>
                      <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:600,color:R,marginBottom:4}}>{q.s}</div>
                      <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:TX,lineHeight:1.7,fontStyle:"italic"}}>{"\""+q.t+"\""}</div>
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
      <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:MU,marginBottom:10,letterSpacing:0.5}}>{"총 "+filtPosts.length+"건 · "}<span style={{color:R}}>● HIGH</span>{" "}<span style={{color:YL}}>● MED</span></div>
      <div style={{position:"relative",paddingLeft:26}}>
        <div style={{position:"absolute",left:7,top:0,bottom:0,width:1,background:"linear-gradient(to bottom,"+R+",transparent)"}} />
        {filtPosts.map(p => (
          <div key={p.id} style={{position:"relative",marginBottom:12}}>
            <div style={{position:"absolute",left:-22,top:5,width:11,height:11,borderRadius:"50%",background:IMP_C[p.impact],border:"2px solid "+DK,boxShadow:"0 0 6px "+IMP_C[p.impact]+"80"}} />
            <div style={{...card,borderLeft:"2px solid "+IMP_C[p.impact]+"50"}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7,flexWrap:"wrap"}}>
                <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:IMP_C[p.impact]}}>{p.date}</span>
                <span style={{background:"rgba(227,25,55,.12)",border:"1px solid rgba(227,25,55,.3)",color:R,fontFamily:"'Pretendard',sans-serif",fontSize:10,padding:"2px 5px",borderRadius:2}}>{p.cat}</span>
                <span style={{background:IMP_C[p.impact]+"18",border:"1px solid "+IMP_C[p.impact]+"50",color:IMP_C[p.impact],fontFamily:"'Pretendard',sans-serif",fontSize:10,padding:"2px 5px",borderRadius:2}}>{p.impact.toUpperCase()}</span>
                <span style={{marginLeft:"auto",fontFamily:"'Pretendard',sans-serif",fontSize:12,color:MU}}>{"♥"+p.likes+" ↺"+p.reposts}</span>
              </div>
              <div style={{fontSize:12,color:TX,lineHeight:1.75,fontStyle:"italic",marginBottom:7,borderLeft:"2px solid rgba(29,155,240,.4)",paddingLeft:10}}>
                {"\""+(xLang === "ko" ? p.ko : p.en)+"\""}
              </div>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:MU}}>{"📌 "+p.ctx}</div>
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
        <div style={{background:"var(--bg-card)",border:"1px solid "+d.color+"60",borderRadius:4,padding:"8px 12px",fontFamily:"'Pretendard',sans-serif",fontSize:10}}>
          <div style={{color:d.color,fontWeight:700,marginBottom:2}}>{d.name}</div>
          <div style={{color:"var(--text-1)"}}>{d.value+"% · "+d.shares}</div>
        </div>
      );
    }

    return (
      <div>
        <SHdr sub="OWNERSHIP & INSTITUTIONAL ACTIVITY" title="지분현황 & 기관 동향">
          <div style={{display:"flex",gap:8,alignItems:"center"}}>

            <LogBadge log={logs.ownership} />
          </div>
        </SHdr>
        {/* ── 섹션 구분: 주주 구성 ── */}
        <div style={{display:"flex",alignItems:"center",gap:12,margin:"0 0 12px"}}>
          <div style={{flex:1,height:1,background:"var(--border-subtle)"}} />
          <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:MU,letterSpacing:0.5,whiteSpace:"nowrap"}}>
            👥 주주 구성 현황
          </div>
          <div style={{flex:1,height:1,background:"var(--border-subtle)"}} />
        </div>

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(auto-fill,minmax(130px,1fr))",gap:isMobile?8:10,marginBottom:14}}>
          <KPI label="총 발행주식" value="~3.76B주"  sub="2026.06" />
          <KPI label="일론 머스크" value="19.9%"     sub="1.12B주 (6/16 옵션행사)"  color={R} />
          <KPI label="기관 투자자" value="41.7%"     sub="4,500+ 기관" color={AC} />
          <KPI label="리테일"      value="35.1%"     sub="~1.17B주" color={GR} />
          <KPI label="내부자 합계" value="23.2%"     sub="머스크 외 임원" color={YL} />
        </div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:12}}>
          <div style={card}>
            <div style={lbl}>주주 구성</div>
            <ResponsiveContainer width="100%" height={isMobile?160:240}>
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
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:MU,minWidth:52,textAlign:"right"}}>{d.shares}</div>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fontWeight:700,color:d.color,minWidth:38,textAlign:"right"}}>{d.value+"%"}</div>
                <div style={{width:44,height:4,background:"var(--border-subtle)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",background:d.color,width:((d.value/36)*100)+"%",borderRadius:3}} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 섹션 구분: 한국인 보유 ── */}
        <div style={{display:"flex",alignItems:"center",gap:12,margin:"4px 0 12px"}}>
          <div style={{flex:1,height:1,background:"var(--border-subtle)"}} />
          <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:MU,letterSpacing:0.5,whiteSpace:"nowrap"}}>
            🇰🇷 한국인 보유 현황 (한국예탁결제원)
          </div>
          <div style={{flex:1,height:1,background:"var(--border-subtle)"}} />
        </div>

        {/* 한국인 보유 KPI */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:8,marginBottom:12}}>
          <KPI label="보관금액 (2026.07.02)" value="$230.0억" sub="약 35.17조원" color={AC} />
          <KPI label="투자자 수 (Q2'25)" value="70.2만명" sub="해외주식 최다" color={GR} />
          <KPI label="1인 평균 보유" value="78.4주" sub="중앙값 10~30주" />
          <KPI label="추정 지분율" value="~1.4%" sub="3.76B주 기준" color={YL} />
        </div>

        {/* KSD 분기별 보관금액 추이 */}
        <div style={{...card,marginBottom:12}}>
          <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,fontWeight:700,color:TX,marginBottom:12}}>분기별 보관금액 추이 (출처: 한국예탁결제원)</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:8,marginBottom:14}}>
            {[
              {q:"2025 상반기",date:"2025.07.14 발표",amt:"$212.94억",won:"약 29.4조원",rank:"해외주식 1위",chg:"+전분기 대비 상승",color:GR},
              {q:"2025 Q3",date:"2025.10.27 발표",amt:"$274억",won:"약 39.2조원",rank:"해외주식 1위",chg:"+28.8% QoQ",color:GR},
              {q:"2026.07.02",date:"2026.07.04 SEIBro 확정",amt:"$230.0억",won:"약 35.17조원",rank:"해외주식 1위",chg:"+9.1% YoY (vs 210.8억)",color:GR},
            ].map((d,i) => (
              <div key={i} style={{background:SF2,borderRadius:8,padding:"12px 14px",border:"0.5px solid rgba(255,255,255,0.07)"}}>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,fontWeight:700,color:d.color,marginBottom:4}}>{d.q}</div>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:MU,marginBottom:6}}>{d.date}</div>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:18,fontWeight:800,color:d.amt==="미확인"?MU:TX,marginBottom:4}}>{d.amt}</div>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:MU}}>{d.won}</div>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:d.color,marginTop:4}}>{d.chg}</div>
              </div>
            ))}
          </div>

          {/* 🆕 연도별 7/2 기준 시계열 (2019~2026) - SEIBro 원본 */}
          <div style={{marginTop:14,marginBottom:16,padding:"14px 12px 10px",background:"linear-gradient(135deg,rgba(99,153,34,.08),rgba(0,212,255,.04) 60%)",borderRadius:8,border:"0.5px solid rgba(99,153,34,.2)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6,marginBottom:10}}>
              <div>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,fontWeight:700,color:TX}}>
                  연도별 7월 2일 기준 · 한국 투자자 테슬라 보관금액
                </div>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:MU,marginTop:2}}>
                  2019 → 2026 · 8년간 <span style={{color:GR,fontWeight:700}}>약 251배 성장</span> · 순위 21위 → 1위
                </div>
              </div>
              <div style={{background:"rgba(99,153,34,.15)",border:"0.5px solid "+GR+"40",borderRadius:4,padding:"3px 10px"}}>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:GR,fontWeight:700}}>+251×</div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={[
                  {year:"2019",amt:0.9,   won:0.14,  rank:21},
                  {year:"2020",amt:10.6,  won:1.62,  rank:2},
                  {year:"2021",amt:91.8,  won:14.04, rank:1},
                  {year:"2022",amt:117.9, won:18.03, rank:1},
                  {year:"2023",amt:145.9, won:22.32, rank:1},
                  {year:"2024",amt:139.0, won:21.25, rank:1},
                  {year:"2025",amt:210.8, won:32.23, rank:1},
                  {year:"2026",amt:230.0, won:35.17, rank:1},
                ]}
                margin={{top:5,right:10,left:0,bottom:5}}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
                <XAxis
                  dataKey="year"
                  tick={{fontSize:10,fill:MU,fontFamily:"'JetBrains Mono',monospace"}}
                  axisLine={{stroke:"rgba(255,255,255,.1)"}}
                  tickLine={false}
                />
                <YAxis
                  tick={{fontSize:10,fill:MU,fontFamily:"'JetBrains Mono',monospace"}}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  label={{value:"억달러",angle:-90,position:"insideLeft",style:{fontSize:9,fill:MU}}}
                />
                <Tooltip
                  contentStyle={{background:"rgba(15,23,42,.95)",border:"1px solid rgba(255,255,255,.1)",borderRadius:6,fontSize:11,fontFamily:"'Pretendard',sans-serif"}}
                  labelStyle={{color:TX,fontSize:11,fontWeight:700}}
                  formatter={(v,name,item) => {
                    if (name === "amt") {
                      const won = item?.payload?.won;
                      const rank = item?.payload?.rank;
                      return [`$${v}억 · ${won}조원 · ${rank}위`,"보관금액"];
                    }
                    return [v,name];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amt"
                  stroke={GR}
                  strokeWidth={2.5}
                  dot={{r:4,fill:GR,strokeWidth:0}}
                  activeDot={{r:6,stroke:GR,strokeWidth:2,fill:"#0f172a"}}
                />
              </LineChart>
            </ResponsiveContainer>

            <div style={{marginTop:6,paddingTop:6,borderTop:"0.5px solid rgba(255,255,255,.05)",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:4,fontSize:9,color:MU,fontFamily:"'Pretendard',sans-serif"}}>
              <div>
                자료:{" "}
                <a href="https://seibro.or.kr" target="_blank" rel="noopener noreferrer" style={{color:AC,textDecoration:"none"}}>SEIBro</a>
                {" · 한국예탁결제원 · 정리 @ohmahahm"}
              </div>
              <div style={{fontFamily:"'JetBrains Mono',monospace"}}>
                환율 1,529.30원 기준(2026) · 2022=7/1, 2023=6/30
              </div>
            </div>
          </div>

          {/* 계층별 분포 (Q2'25 기준) */}
          <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,fontWeight:700,color:TX,marginBottom:10}}>계층별 보유 분포 (2025년 6월 기준)</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[
              {range:"0~100주",investors:"90%",share:"10%",avg:"8.7주",color:"rgba(99,153,34,.7)"},
              {range:"100~500주",investors:"7%",share:"20%",avg:"223.9주",color:"rgba(0,212,255,.7)"},
              {range:"500~1,000주",investors:"2%",share:"20%",avg:"783.6주",color:"rgba(251,191,36,.7)"},
              {range:"1,000~5,000주",investors:"1%",share:"25%",avg:"1,959주",color:"rgba(227,25,55,.7)"},
              {range:"5,000주 이상",investors:"<1%",share:"25%이상",avg:"고액 투자자",color:"rgba(227,25,55,1)"},
            ].map((d,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"0.5px solid rgba(255,255,255,0.05)"}}>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:TX,minWidth:100}}>{d.range}</div>
                <div style={{flex:1,height:5,background:"var(--border-subtle)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{width:d.share,height:"100%",background:d.color,borderRadius:3}} />
                </div>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:MU,minWidth:60,textAlign:"right"}}>{"투자자 "+d.investors}</div>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:TX,minWidth:60,textAlign:"right"}}>{"지분 "+d.share}</div>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:MU,minWidth:70,textAlign:"right"}}>{"평균 "+d.avg}</div>
              </div>
            ))}
          </div>

          <div style={{marginTop:12,padding:"8px 12px",background:"rgba(0,212,255,0.05)",border:"0.5px solid rgba(0,212,255,0.2)",borderRadius:6}}>
            <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:MU,lineHeight:1.8}}>
              {"💡 "}
              <span style={{color:AC,fontWeight:600}}>상위 1% 미만이 전체 지분 50% 이상 보유</span>
              {" — 한국인 테슬라 투자도 양극화. 1인당 평균 78.4주이나 실제 절반 이상은 10~30주 보유. 일론 머스크가 한국인 투자자를 가리켜 "}<span style={{color:TX}}>{"\"Smart people\""}</span>{" 이라 언급한 바 있음."}
            </div>
          </div>
        </div>


        {/* ── 섹션 구분: 목표가 ── */}
        <div style={{display:"flex",alignItems:"center",gap:12,margin:"4px 0 12px"}}>
          <div style={{flex:1,height:1,background:"var(--border-subtle)"}} />
          <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:MU,letterSpacing:0.5,whiteSpace:"nowrap"}}>
            📊 애널리스트 목표주가
          </div>
          <div style={{flex:1,height:1,background:"var(--border-subtle)"}} />
        </div>

        {/* 목표가 타임라인 */}
        <div style={{...card,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={lbl}>기관별 목표가 타임라인</div>
              <div style={{fontSize:10,color:MU}}>{"공시일 기준 최신순 · 현재가 $"+curPrice.toFixed(2)+" 기준 상승여력"}</div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[["컨센서스 평균","$395 (33개 기관)",MU],["최고 목표가","$4,600 (ARK)",GR],["최저 목표가","$24.86 (GLJ)",R]].map(([l,v,c],i) => (
                <div key={i} style={{background:c+"10",border:"1px solid "+c+"30",borderRadius:3,padding:"5px 12px",textAlign:"center"}}>
                  <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:MU,letterSpacing:1,marginBottom:2}}>{l}</div>
                  <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:13,fontWeight:700,color:c}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {/* JP모건 배너 */}
          <div style={{background:"rgba(0,212,255,0.06)",border:"1px solid rgba(0,212,255,0.3)",borderRadius:3,padding:"10px 14px",marginBottom:14,display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{fontSize:20,flexShrink:0}}>🔥</div>
            <div>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:AC,letterSpacing:0.5,marginBottom:4}}>2026.06.05 — JPMORGAN 11년 만의 관점 전환</div>
              <div style={{fontSize:11,color:TX,lineHeight:1.7}}>
                Ryan Brinkman(2015~, $145 고수) → Rajat Gupta 교체 후 <strong style={{color:AC}}>Underweight → Neutral, $145 → $475 (+228%)</strong>.
                논거: "TSLA is at the forefront of physical AI" · 수직 통합 재평가 · EPS 2030 $7.50.
                <span style={{color:YL}}> ※ 당일 주가 -6.56% — Jamie Dimon의 SpaceX IPO 관련 머스크 초청(전날)과 타이밍 겹쳐 시장 불신 존재.</span>
              </div>
            </div>
          </div>
          {/* 목표가 테이블 */}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Pretendard',sans-serif",fontSize:10}}>
              <thead>
                <tr style={{borderBottom:"1px solid rgba(227,25,55,.3)"}}>
                  {["공시일","기관","애널리스트","레이팅","목표가","현재가 대비","핵심 논거"].map(h => (
                    <th key={h} style={{padding:"8px 10px",color:R,textAlign:"left",fontWeight:400,letterSpacing:1,whiteSpace:"nowrap",fontSize:12}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ANALYST_TARGETS.map((a,i) => {
                  const upside = ((a.tp / curPrice - 1) * 100).toFixed(1);
                  const isUp   = a.tp >= curPrice;
                  return (
                    <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,.04)",background:i%2?"var(--card-overlay)":"transparent"}}>
                      <td style={{padding:"8px 10px",color:MU,whiteSpace:"nowrap",fontSize:12}}>{a.date}</td>
                      <td style={{padding:"8px 10px",fontFamily:"'Pretendard',sans-serif",fontSize:12,fontWeight:700,color:"var(--text-1)",whiteSpace:"nowrap"}}>{a.inst}</td>
                      <td style={{padding:"8px 10px",color:MU,fontSize:12,whiteSpace:"nowrap"}}>{a.analyst}</td>
                      <td style={{padding:"8px 10px"}}>
                        <span style={{background:a.color+"15",border:"1px solid "+a.color+"40",color:a.color,fontSize:11,padding:"2px 6px",borderRadius:2,whiteSpace:"nowrap"}}>{a.rating}</span>
                      </td>
                      <td style={{padding:"8px 10px",fontFamily:"'Pretendard',sans-serif",fontSize:12,fontWeight:700,color:a.color,whiteSpace:"nowrap"}}>{"$"+a.tp.toLocaleString()}</td>
                      <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                        <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:isUp?GR:R}}>{(isUp?"▲":"▼")+Math.abs(upside)+"%"}</span>
                      </td>
                      <td style={{padding:"8px 10px",fontSize:10,color:MU,lineHeight:1.5}}>
                        {a.reason}
                        {a.badge && <span style={{marginLeft:6,background:"rgba(251,191,36,.15)",border:"1px solid rgba(255,214,0,.4)",color:YL,fontSize:10,padding:"1px 5px",borderRadius:2}}>{a.badge}</span>}
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

        {/* ── 섹션 구분: 기관 매매 ── */}
        <div style={{display:"flex",alignItems:"center",gap:12,margin:"4px 0 12px"}}>
          <div style={{flex:1,height:1,background:"var(--border-subtle)"}} />
          <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:MU,letterSpacing:0.5,whiteSpace:"nowrap"}}>
            🏦 기관 매수·매도 동향
          </div>
          <div style={{flex:1,height:1,background:"var(--border-subtle)"}} />
        </div>

        {/* 기관 매매 타임라인 */}
        <div style={card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:7}}>
            <div style={lbl}>{"기관 투자자 매수·매도 타임라인 ("+instActs.filter(d=>d.action!=="RATE").length+"건)"}</div>
            <div style={{display:"flex",gap:5}}>
              {["ALL","BUY","SELL","HOLD"].map(f => (
                <button key={f} style={{...fb(instFil===f),color:instFil===f&&f==="BUY"?GR:instFil===f&&f==="SELL"?R:instFil===f&&f==="RATE"?AC:undefined,borderColor:instFil===f&&f==="BUY"?GR:instFil===f&&f==="SELL"?R:instFil===f&&f==="RATE"?AC:undefined}} onClick={() => setInstFil(f)}>{f}</button>
              ))}
            </div>
          </div>
          {filtInst.map(d => (
            <div key={d.id} style={{display:"flex",gap:10,padding:"9px 11px",background:"var(--card-overlay)",borderRadius:3,border:"1px solid "+ACT_C[d.action]+"20",borderLeft:"3px solid "+ACT_C[d.action],marginBottom:6,flexWrap:"wrap",alignItems:"flex-start"}}>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:MU,minWidth:85,flexShrink:0}}>{d.date}</div>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fontWeight:700,color:"var(--text-1)",minWidth:110,flexShrink:0}}>{d.inst}</div>
              <span style={{background:ACT_C[d.action]+"18",border:"1px solid "+ACT_C[d.action]+"40",color:ACT_C[d.action],fontFamily:"'Pretendard',sans-serif",fontSize:11,padding:"2px 6px",borderRadius:2,flexShrink:0}}>{d.action}</span>
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:"var(--text-1)",minWidth:65}}>{d.amt}</div>
              <span style={{background:SENT_C[d.sent]+"15",border:"1px solid "+SENT_C[d.sent]+"35",color:SENT_C[d.sent],fontFamily:"'Pretendard',sans-serif",fontSize:11,padding:"2px 5px",borderRadius:2,flexShrink:0}}>{d.sent}</span>
              <div style={{flex:1,fontSize:11,color:MU,lineHeight:1.5,minWidth:130}}>{d.note}</div>
            </div>
          ))}
        </div>


      </div>
    );
  };

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */
  const TABS = [
    ["company","Overview"],["ceo","CEO"],["values","가치관"],
    ["perf","실적"],["roadmap","로드맵"],["risk","리스크"],
    ["earnings","어닝콜"],["xposts","X 발언"],["ownership","지분·목표가"],
  ];

  const anyLoading = Object.values(ld).some(Boolean) || ldStock;

  return (
    <div data-theme={theme} style={{background:"var(--bg)",minHeight:"100vh",color:"var(--text-1)",fontFamily:"'Pretendard','Noto Sans KR',sans-serif"}}>
      <style>{`
        :root {
          --bg: #0B1220;
          --bg-elev: #131A2B;
          --bg-card: #1A2236;
          --border: rgba(255,255,255,0.09);
          --border-subtle: rgba(255,255,255,0.05);
          --text-1: #F1F5F9;
          --text-2: #94A3B8;
          --text-3: #64748B;
          --card-overlay: rgba(255,255,255,0.04);
          --red-tint: rgba(227,25,55,0.06);
        }
        [data-theme="light"] {
          --bg: #F8F9FC;
          --bg-elev: #FFFFFF;
          --bg-card: #FFFFFF;
          --border: #E2E8F0;
          --border-subtle: #F1F5F9;
          --text-1: #0F172A;
          --text-2: #475569;
          --text-3: #94A3B8;
          --card-overlay: rgba(0,0,0,0.02);
          --red-tint: rgba(227,25,55,0.04);
        }
        body, #root { background: var(--bg); color: var(--text-1); }
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.4)}}
        .reveal{opacity:0;transform:translateY(20px);transition:opacity .6s ease,transform .6s ease}
        .reveal.in{opacity:1;transform:translateY(0)}
        .reveal-fast{opacity:0;transform:translateY(12px);transition:opacity .4s ease,transform .4s ease}
        .reveal-fast.in{opacity:1;transform:translateY(0)}
        @keyframes bounce-arrow{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
        .bounce-arrow{animation:bounce-arrow 1.8s ease-in-out infinite}
        section[id] { scroll-margin-top: 72px; }
        * { -webkit-font-smoothing: antialiased; word-break: keep-all; overflow-wrap: break-word; }
      `}</style>
      {/* ── 스크롤 진행 바 ── */}
      <div style={{position:"fixed",top:0,left:0,height:3,background:"linear-gradient(90deg,#38BDF8,#FB923C)",width:progress+"%",zIndex:200,transition:"width .1s ease",pointerEvents:"none"}} />
      <div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)",backgroundSize:"48px 48px",pointerEvents:"none",zIndex:0}} />

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}>
          <div style={{background:"var(--bg-card)",border:"2px solid "+R,borderRadius:6,padding:"36px 40px",width:340,boxShadow:"0 0 40px rgba(227,25,55,.3)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
              <div style={{width:26,height:26,background:R,clipPath:"polygon(20% 0%,80% 0%,80% 15%,57% 15%,57% 100%,43% 100%,43% 15%,20% 15%)",filter:"drop-shadow(0 0 6px rgba(227,25,55,.7))"}} />
              <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:13,fontWeight:900,letterSpacing:4,color:"var(--text-1)"}}>TESLA INTEL</div>
            </div>
            <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:R,letterSpacing:0.5,marginBottom:6}}>ADMIN ACCESS REQUIRED</div>
            <div style={{fontSize:12,color:"var(--text-2)",marginBottom:20,lineHeight:1.6}}>AI 업데이트 기능은 관리자 전용입니다.<br/>비밀번호를 입력하세요.</div>
            {lockoutUntil && Date.now() < lockoutUntil ? (
              <div style={{background:"rgba(227,25,55,.1)",border:"1px solid rgba(227,25,55,.4)",borderRadius:4,padding:"14px",textAlign:"center"}}>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:22,fontWeight:700,color:R,marginBottom:6}}>{lockRemain+"s"}</div>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:"var(--text-2)"}}>잠금 해제까지 대기</div>
              </div>
            ) : (
              <>
                <input type="password" placeholder="비밀번호 입력" value={pwInput}
                  onChange={e => setPwInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && verifyPw()} autoFocus
                  style={{width:"100%",background:"var(--border-subtle)",border:"1px solid "+(authError?"rgba(227,25,55,.6)":"var(--border)"),borderRadius:3,color:"var(--text-1)",padding:"10px 14px",fontFamily:"'Pretendard',sans-serif",fontSize:13,outline:"none",letterSpacing:0.5,boxSizing:"border-box",marginBottom:authError?8:16}} />
                {authError && <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,color:R,marginBottom:12,letterSpacing:1}}>{authError}</div>}
                <div style={{display:"flex",gap:10}}>
                  <button onClick={verifyPw} style={{flex:1,background:"rgba(227,25,55,.2)",border:"1px solid "+R,color:R,fontFamily:"'Pretendard',sans-serif",fontSize:10,letterSpacing:0.5,padding:"9px",borderRadius:3,cursor:"pointer"}}>확인</button>
                  <button onClick={() => { setShowAuthModal(false); setPwInput(""); setAuthError(""); pendingRef.current = null; }}
                    style={{flex:1,background:"transparent",border:"1px solid rgba(255,255,255,.15)",color:"var(--text-2)",fontFamily:"'Pretendard',sans-serif",fontSize:10,padding:"9px",borderRadius:3,cursor:"pointer"}}>취소</button>
                </div>
              </>
            )}
            {attempts > 0 && !lockoutUntil && (
              <div style={{display:"flex",gap:4,justifyContent:"center",marginTop:14}}>
                {Array.from({length:MAX_ATTEMPTS}).map((_,i) => (
                  <div key={i} style={{width:8,height:8,borderRadius:"50%",background:i<attempts?R:"var(--border)"}} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div ref={hdrRef} style={{background:"var(--bg)",borderBottom:"0.5px solid rgba(255,255,255,0.08)",padding:isMobile?"10px 14px":"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:11}}>
          <div style={{width:30,height:30,background:R,clipPath:"polygon(20% 0%,80% 0%,80% 15%,57% 15%,57% 100%,43% 100%,43% 15%,20% 15%)",filter:"drop-shadow(0 0 7px rgba(227,25,55,.7))"}} />
          <div>
            <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:isMobile?13:15,fontWeight:800,letterSpacing:isMobile?0:1,color:"var(--text-1)"}}>{isMobile?"Tesla Hub":"Tesla Intelligence Hub"}</div>
            {!isMobile && <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:MU,marginTop:1}}>EDGAR 실적 연동 · Yahoo Finance · by Rich Researcher</div>}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* 주가 칩 */}
          <div style={{display:"flex",alignItems:"center",gap:6,fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700}}>
            <span style={{color:"var(--text-1)"}}>{"$"+stock.price.toFixed(2)}</span>
            <span style={{fontSize:11,fontWeight:600,color:priceDiff.up?"#10b981":"#ef4444",background:priceDiff.up?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)",padding:"2px 7px",borderRadius:8}}>
              {(priceDiff.up?"▲ +":"▼ ")+priceDiff.p+"%"}
            </span>
          </div>
          {/* 다크/라이트 토글 */}
          <button onClick={toggleTheme}
            style={{width:36,height:36,borderRadius:10,background:"transparent",border:"1px solid var(--border)",color:"var(--text-1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          {/* ≡ 드로어 메뉴 */}
          <button onClick={() => setDrawerOpen(true)}
            style={{width:36,height:36,borderRadius:10,background:"transparent",border:"1px solid var(--border)",color:"var(--text-1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
            ☰
          </button>
          {/* 저장 토스트 */}
          {saveToast && (
            <div style={{background:saveToast.ok?"rgba(16,185,129,.15)":"rgba(227,25,55,.15)",border:"1px solid "+(saveToast.ok?"rgba(16,185,129,.5)":"rgba(227,25,55,.5)"),color:saveToast.ok?GR:R,fontFamily:"'Pretendard',sans-serif",fontSize:12,fontWeight:600,padding:"6px 14px",borderRadius:20}}>
              {saveToast.ok ? "💾 "+saveToast.msg : "⚠ "+saveToast.msg}
            </div>
          )}
        </div>
      </div>

      {/* ── 컴팩트 섹션 네비탭 ── */}
      <div style={{position:"sticky",top:hdrH,zIndex:49,background:"var(--bg)",borderBottom:"1px solid var(--border)",overflowX:"auto",scrollbarWidth:"none",display:"flex"}}>
        {[["#section-overview","Overview"],["#section-news","뉴스"],["#section-ceo","CEO"],["#section-perf","실적"],["#section-roadmap","로드맵"],["#section-risk","리스크"],["#section-earnings","어닝콜"],["#section-xposts","X 발언"],["#section-ownership","지분"]].map(([href,label]) => (
          <a key={href} href={href}
            onClick={e=>{e.preventDefault();const el=document.querySelector(href);if(el)el.scrollIntoView({behavior:"smooth"});}}
            style={{fontFamily:"'Pretendard',sans-serif",fontSize:12,fontWeight:activeSection===href.slice(1)?700:500,color:activeSection===href.slice(1)?"var(--text-1)":"var(--text-2)",padding:isMobile?"9px 12px":"9px 16px",whiteSpace:"nowrap",textDecoration:"none",borderBottom:"2px solid "+(activeSection===href.slice(1)?"#E31937":"transparent"),display:"inline-block",flexShrink:0,transition:"color .2s, border-color .2s"}}>
            {label}
          </a>
        ))}
      </div>

      {/* ── 드로어 백드롭 ── */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:90,backdropFilter:"blur(4px)"}} />
      )}

      {/* ── 드로어 패널 ── */}
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:isMobile?"80%":"320px",maxWidth:320,background:"var(--bg-elev)",borderLeft:"1px solid var(--border)",transform:drawerOpen?"translateX(0)":"translateX(100%)",transition:"transform .3s ease",zIndex:95,display:"flex",flexDirection:"column",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 20px 16px"}}>
          <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"var(--text-3)"}}>SECTIONS</div>
          <button onClick={() => setDrawerOpen(false)}
            style={{width:32,height:32,borderRadius:8,background:"transparent",border:"1px solid var(--border)",color:"var(--text-1)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{flex:1}}>
          {[["section-overview","00","Overview"],["section-news","01","📰 뉴스"],["section-ceo","02","CEO"],["section-values","03","가치관"],["section-perf","04","실적"],["section-roadmap","05","로드맵"],["section-risk","06","리스크"],["section-earnings","07","어닝콜"],["section-xposts","08","X 발언"],["section-ownership","09","지분·목표가"]].map(([id,num,label]) => (
            <a key={id} href={"#"+id} onClick={(e)=>{e.preventDefault();setDrawerOpen(false);const el=document.getElementById(id);if(el)el.scrollIntoView({behavior:"smooth"});}}
              style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px",borderBottom:"1px solid var(--border)",color:"var(--text-1)",textDecoration:"none",fontSize:15,fontWeight:500,fontFamily:"'Pretendard',sans-serif",cursor:"pointer"}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"var(--text-3)",minWidth:24}}>{num}</span>
              {label}
            </a>
          ))}
        </div>
        {visitors.total > 0 && (
          <div style={{padding:"16px 20px",borderTop:"1px solid var(--border)",display:"flex",gap:16,fontFamily:"'Pretendard',sans-serif",fontSize:12,color:"var(--text-3)"}}>
            <span>{"👁 오늘 "}<strong style={{color:"var(--text-1)"}}>{visitors.today}</strong></span>
            <span>{"총 "}<strong style={{color:AC}}>{visitors.total}</strong></span>
          </div>
        )}
      </div>

      {/* CONTENT — 단일 스크롤 섹션 */}
      <div style={{position:"relative",zIndex:1,maxWidth:isMobile?"100%":800,margin:"0 auto"}}>

        {/* ── HERO 섹션 ── */}
        <div style={{padding:isMobile?"28px 16px 32px":"40px 24px 48px",borderBottom:"1px solid var(--border)",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 600px 300px at 50% 0%, rgba(227,25,55,0.08), transparent)",pointerEvents:"none"}} />
          <div style={{position:"relative"}}>
            {/* 아이브로 레이블 */}
            <div style={{display:"inline-flex",alignItems:"center",gap:8,fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:600,color:AC,letterSpacing:"0.08em",marginBottom:16,padding:"6px 14px",borderRadius:100,border:"1px solid rgba(56,189,248,.25)",background:"rgba(56,189,248,.06)"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:AC,animation:"pulse 2s ease-in-out infinite"}} />
              {"TSLA · NASDAQ · "+stock.date}
            </div>
            {/* 메인 타이틀 */}
            <h1 style={{fontFamily:"'Pretendard',sans-serif",fontSize:isMobile?"clamp(28px,7vw,36px)":40,fontWeight:800,lineHeight:1.2,letterSpacing:"-0.03em",marginBottom:12,color:"var(--text-1)"}}>
              Tesla Intelligence<br/>
              <span style={{background:"linear-gradient(180deg, var(--text-1) 30%, #38BDF8 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Hub</span>
            </h1>
            <p style={{fontFamily:"'Pretendard',sans-serif",fontSize:isMobile?14:15,color:"var(--text-2)",lineHeight:1.6,marginBottom:20}}>
              SEC EDGAR · Yahoo Finance · by Rich Researcher
            </p>
            <Countdown />
            {/* 주가 + 등락 */}
            <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:24}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:isMobile?36:44,fontWeight:700,color:"var(--text-1)",letterSpacing:"-0.02em"}}>{"$"+stock.price.toFixed(2)}</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:600,color:priceDiff.up?"#10b981":"#ef4444",background:priceDiff.up?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)",padding:"4px 10px",borderRadius:8}}>
                {(priceDiff.up?"▲ +":"▼ ")+priceDiff.p+"%"}
              </span>
            </div>
            {/* Hero KPI 그리드 */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
              {[
                {label:"시가총액",value:mktCap,sub:"2026.06"},
                {label:"총이익률",value:"21.1%",sub:"Q1'26"},
                {label:"다음 실적",value:"7/22",sub:"Q2'26 컨센 $0.45"},
                {label:"기준일",value:stock.date.slice(5),sub:"Yahoo Finance"},
              ].map((k,i) => (
                <div key={i} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:12,padding:"12px 14px"}}>
                  <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:"var(--text-2)",marginBottom:6,fontWeight:500}}>{k.label}</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:isMobile?16:18,fontWeight:700,color:"var(--text-1)"}}>{k.value}</div>
                  <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,color:"var(--text-3)",marginTop:4}}>{k.sub}</div>
                </div>
              ))}
            </div>
            {/* 긴급뉴스 배너 (임팩트5) */}
            {breakingNews.length > 0 && (
              <div style={{marginTop:16,padding:"10px 14px",background:"rgba(227,25,55,.08)",
                border:"1px solid rgba(227,25,55,.3)",borderRadius:10}}>
                <div style={{fontFamily:"'Pretendard',sans-serif",fontSize:10,fontWeight:700,
                  color:R,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>
                  🔴 오늘의 긴급 뉴스
                </div>
                {breakingNews.slice(0,2).map((n,i) => (
                  <div key={i} style={{fontFamily:"'Pretendard',sans-serif",fontSize:isMobile?12:13,
                    color:"var(--text-1)",lineHeight:1.5,marginBottom:i<breakingNews.length-1?6:0,
                    paddingBottom:i<breakingNews.length-1?6:0,
                    borderBottom:i<breakingNews.length-1?"0.5px solid rgba(227,25,55,.2)":"none"}}>
                    <span style={{color:R,marginRight:6}}>▸</span>{n.titleKo}
                  </div>
                ))}
                <a href="#section-news" onClick={e=>{e.preventDefault();document.getElementById("section-news")?.scrollIntoView({behavior:"smooth"});}}
                  style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,color:AC,
                    textDecoration:"none",display:"inline-block",marginTop:6}}>
                  전체 뉴스 보기 →
                </a>
              </div>
            )}
            {/* 스크롤 힌트 화살표 */}
            <div style={{textAlign:"center",marginTop:24}}>
              <span className="bounce-arrow" style={{display:"inline-block",fontSize:20,color:"var(--text-3)"}}>↓</span>
            </div>
          </div>
        </div>

        {/* ── 각 섹션 ── */}
        <div style={{padding:isMobile?"0 0 60px":"0 0 80px"}}>
          <section id="section-overview" style={{padding:isMobile?"24px 16px":"32px 24px",borderBottom:"1px solid var(--border)"}}>
            <div className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"var(--text-3)"}}>00</span>
                <div style={{flex:1,height:1,background:"var(--border)"}} />
                <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Overview</span>
              </div>
              <CompanyTab />
            </div>
          </section>
          <section id="section-news" style={{padding:isMobile?"24px 16px":"32px 24px",borderBottom:"1px solid var(--border)"}}>
            <div className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"var(--text-3)"}}>01</span>
                <div style={{flex:1,height:1,background:"var(--border)"}} />
                <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>NEWS</span>
              </div>
              <NewsTab />
            </div>
          </section>
          <section id="section-ceo" style={{padding:isMobile?"24px 16px":"32px 24px",borderBottom:"1px solid var(--border)"}}>
            <div className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"var(--text-3)"}}>02</span>
                <div style={{flex:1,height:1,background:"var(--border)"}} />
                <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>CEO</span>
              </div>
              <CeoTab />
            </div>
          </section>
          <section id="section-values" style={{padding:isMobile?"24px 16px":"32px 24px",borderBottom:"1px solid var(--border)"}}>
            <div className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"var(--text-3)"}}>03</span>
                <div style={{flex:1,height:1,background:"var(--border)"}} />
                <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>가치관</span>
              </div>
              <ValuesTab />
            </div>
          </section>
          <section id="section-perf" style={{padding:isMobile?"24px 16px":"32px 24px",borderBottom:"1px solid var(--border)"}}>
            <div className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"var(--text-3)"}}>04</span>
                <div style={{flex:1,height:1,background:"var(--border)"}} />
                <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>실적</span>
              </div>
              <PerfTab />
            </div>
          </section>
          <section id="section-roadmap" style={{padding:isMobile?"24px 16px":"32px 24px",borderBottom:"1px solid var(--border)"}}>
            <div className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"var(--text-3)"}}>05</span>
                <div style={{flex:1,height:1,background:"var(--border)"}} />
                <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>로드맵</span>
              </div>
              <RoadmapTab />
            </div>
          </section>
          <section id="section-risk" style={{padding:isMobile?"24px 16px":"32px 24px",borderBottom:"1px solid var(--border)"}}>
            <div className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"var(--text-3)"}}>06</span>
                <div style={{flex:1,height:1,background:"var(--border)"}} />
                <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>리스크</span>
              </div>
              <RiskTab />
            </div>
          </section>
          <section id="section-earnings" style={{padding:isMobile?"24px 16px":"32px 24px",borderBottom:"1px solid var(--border)"}}>
            <div className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"var(--text-3)"}}>07</span>
                <div style={{flex:1,height:1,background:"var(--border)"}} />
                <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>어닝콜</span>
              </div>
              <EarningsTab />
            </div>
          </section>
          <section id="section-xposts" style={{padding:isMobile?"24px 16px":"32px 24px",borderBottom:"1px solid var(--border)"}}>
            <div className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"var(--text-3)"}}>08</span>
                <div style={{flex:1,height:1,background:"var(--border)"}} />
                <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>X 발언</span>
              </div>
              <XTab />
            </div>
          </section>
          <section id="section-ownership" style={{padding:isMobile?"24px 16px":"32px 24px"}}>
            <div className="reveal">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"var(--text-3)"}}>09</span>
                <div style={{flex:1,height:1,background:"var(--border)"}} />
                <span style={{fontFamily:"'Pretendard',sans-serif",fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>지분·목표가</span>
              </div>
              <OwnershipTab />
            </div>
          </section>
        </div>

        {/* UPDATE LOG */}
        {updateHistory.length > 0 && (
          <div style={{...card,marginTop:20,borderColor:"rgba(56,189,248,.2)"}}>
            <div style={{...lbl,color:AC}}>{"AI 업데이트 로그 (최근 "+updateHistory.length+"건)"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:8}}>
              {updateHistory.map((h,i) => (
                <div key={i} style={{display:"flex",gap:10,padding:"4px 8px",background:"var(--card-overlay)",borderRadius:3,fontSize:12,fontFamily:"'Pretendard',sans-serif",alignItems:"center"}}>
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

      <div style={{position:"relative",zIndex:1,textAlign:"center",padding:"16px 12px 12px",fontFamily:"'Pretendard',sans-serif",fontSize:11,color:"var(--border)",borderTop:"1px solid rgba(227,25,55,.12)",letterSpacing:0.5}}>
        {(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:8,fontFamily:"'Pretendard',sans-serif",fontSize:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:3,padding:"5px 14px"}}>
              <span style={{color:MU}}>오늘 방문</span>
              <span style={{color:TX,fontWeight:700,fontFamily:"'Pretendard',sans-serif",fontSize:11}}>{visitors.today.toLocaleString()}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(0,212,255,0.05)",border:"1px solid rgba(0,212,255,0.15)",borderRadius:3,padding:"5px 14px"}}>
              <span style={{color:MU}}>누적 방문</span>
              <span style={{color:AC,fontWeight:700,fontFamily:"'Pretendard',sans-serif",fontSize:11}}>{visitors.total.toLocaleString()}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4,color:MU}}>
              <span style={{fontSize:10,color:"var(--border)"}}>※ 세션 중복 제외 · Artifact Storage (공유)</span>
            </div>
          </div>
        )}
        <div style={{marginBottom:6,fontFamily:"'Pretendard',sans-serif",fontSize:11,color:"var(--border)",letterSpacing:1}}>
          © 2026 <span style={{color:"rgba(255,255,255,0.45)",fontWeight:600}}>Rich Researcher</span> · Tesla Intelligence Hub
        </div>
        TESLA INTELLIGENCE HUB v5.0 · SEC EDGAR · YAHOO FINANCE · NOT FINANCIAL ADVICE
      </div>
    </div>
  );
}
