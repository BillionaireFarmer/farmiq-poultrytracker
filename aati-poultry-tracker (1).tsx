import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IcHome    = () => <Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" />;
const IcFeed    = () => <Icon d="M3 6h18M3 12h18M3 18h18" />;
const IcExpense = () => <Icon d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 14H11v-4h2v4zm0-6H11V8h2v2z" />;
const IcRevenue = () => <Icon d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />;
const IcProfit  = () => <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />;
const IcSetup   = () => <Icon d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />;
const IcBatch   = () => <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />;
const IcChevron = ({ dir="right" }) => <Icon d={dir==="right"?"M9 18l6-6-6-6":"M15 18l-6-6 6-6"} size={16}/>;
const IcPlus    = () => <Icon d="M12 5v14M5 12h14" size={16}/>;
const IcLock    = () => <Icon d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4" size={16}/>;
const IcDownload= () => <Icon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={16}/>;
const IcTrash   = () => <Icon d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" size={16}/>;

// ─── Palette ──────────────────────────────────────────────────────────────────
const PIE_COLORS = ["#6366f1","#22d3ee","#f59e0b","#10b981","#f43f5e","#a78bfa"];
const GREEN = "#10b981", RED = "#f43f5e";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n, dec=0) => Number(n||0).toLocaleString("en-NG",{minimumFractionDigits:dec,maximumFractionDigits:dec});
const fmtN = (n, dec=2) => fmt(n,dec);
const daysBetween = (d1,d2) => Math.max(0, Math.floor((d2-d1)/86400000));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// ─── Storage keys ─────────────────────────────────────────────────────────────
const STORAGE_BATCHES = "farmiq_batches";
const STORAGE_ACTIVE  = "farmiq_active_batch";

// ─── Default batch factory ────────────────────────────────────────────────────
const makeBatch = (overrides = {}) => ({
  id: uid(), name: overrides.name || "Batch 1", status: "active",
  farm: {
    type: "broiler", birdsStocked: 500,
    dateStocked: new Date(Date.now() - 28*86400000).toISOString().split("T")[0],
    costPerChick: 350, feedCostPerBag: 8500, avgBagWeightKg: 25, slaughterAge: 42,
  },
  mortality: 8,
  feedLog: [
    { id:1, date:"2025-01-28", kgUsed:35, cost:11900 },
    { id:2, date:"2025-01-29", kgUsed:38, cost:12920 },
    { id:3, date:"2025-01-30", kgUsed:42, cost:14280 },
    { id:4, date:"2025-01-31", kgUsed:44, cost:14960 },
    { id:5, date:"2025-02-01", kgUsed:47, cost:15980 },
    { id:6, date:"2025-02-02", kgUsed:50, cost:17000 },
    { id:7, date:"2025-02-03", kgUsed:53, cost:18020 },
  ],
  expenses: [
    { id:1, category:"Medication",    amount:15000, note:"Newcastle vaccine" },
    { id:2, category:"Vaccination",   amount:8000,  note:"Gumboro" },
    { id:3, category:"Labour",        amount:25000, note:"2 farm workers" },
    { id:4, category:"Electricity",   amount:12000, note:"Generator fuel" },
    { id:5, category:"Miscellaneous", amount:5000,  note:"Litter" },
  ],
  broilerRev: { avgLiveWeightKg:2.4, sellingPricePerKg:2800, currentAvgWeightKg:1.8 },
  layerRev:   { eggsPerDay:380, pricePerCrate:2200, eggsPerCrate:30 },
  ...overrides,
});

const emptyBatch = (name="New Batch") => ({
  id: uid(), name, status: "active",
  farm: {
    type: "broiler", birdsStocked: 500,
    dateStocked: new Date().toISOString().split("T")[0],
    costPerChick: 350, feedCostPerBag: 8500, avgBagWeightKg: 25, slaughterAge: 42,
  },
  mortality: 0, feedLog: [], expenses: [],
  broilerRev: { avgLiveWeightKg:2.4, sellingPricePerKg:2800, currentAvgWeightKg:0 },
  layerRev:   { eggsPerDay:0, pricePerCrate:2200, eggsPerCrate:30 },
});

// ─── Batch financials calculator ──────────────────────────────────────────────
function calcBatch(batch) {
  const today   = new Date();
  const stocked = new Date(batch.farm.dateStocked);
  const ageInDays  = daysBetween(stocked, today);
  const ageInWeeks = Math.floor(ageInDays / 7);
  const slaughterAge = Number(batch.farm.slaughterAge) || 42;
  const safeMortality = Math.min(Number(batch.mortality)||0, batch.farm.birdsStocked);
  const aliveBirds    = Math.max(0, batch.farm.birdsStocked - safeMortality);
  const mortalityRate = ((safeMortality / batch.farm.birdsStocked)*100).toFixed(1);
  const totalFeedKg   = batch.feedLog.reduce((s,r)=>s+Number(r.kgUsed),0);
  const totalFeedCost = batch.feedLog.reduce((s,r)=>s+Number(r.cost),0);
  const feedPerBird   = aliveBirds ? (totalFeedKg/aliveBirds).toFixed(2) : 0;
  const currentAvgWeight = Number(batch.broilerRev.currentAvgWeightKg)||0;
  const totalBiomass = aliveBirds * currentAvgWeight;
  const fcrRaw = (batch.farm.type==="broiler" && totalBiomass>0) ? totalFeedKg/totalBiomass : null;
  const fcr    = fcrRaw ? fcrRaw.toFixed(2) : "N/A";
  const fcrStatus = fcrRaw==null ? null : fcrRaw>2.2?"poor":fcrRaw<1.6?"excellent":"good";
  const totalOther    = batch.expenses.reduce((s,e)=>s+Number(e.amount),0);
  const chickCost     = batch.farm.birdsStocked * batch.farm.costPerChick;
  const grandExpenses = chickCost + totalFeedCost + totalOther;
  const costPerBird   = aliveBirds ? (grandExpenses/aliveBirds).toFixed(2) : 0;
  const layerRevenueDaily      = batch.farm.type==="layer" ? (batch.layerRev.eggsPerDay/batch.layerRev.eggsPerCrate)*batch.layerRev.pricePerCrate : 0;
  const layerRevenueMonthly    = layerRevenueDaily*30;
  const layDaysActive          = batch.farm.type==="layer" ? Math.max(0,ageInDays-126) : 0;
  const layerRevenueCumulative = layerRevenueDaily*layDaysActive;
  const broilerRevTotal    = batch.farm.type==="broiler" ? aliveBirds * batch.broilerRev.avgLiveWeightKg * batch.broilerRev.sellingPricePerKg : 0;
  const broilerRevRealized = (batch.farm.type==="broiler" && ageInDays>=slaughterAge) ? broilerRevTotal : 0;
  const totalRevenue  = batch.farm.type==="broiler" ? broilerRevRealized : layerRevenueCumulative;
  const grossProfit   = totalRevenue - grandExpenses;
  const profitPerBird = aliveBirds ? (grossProfit/aliveBirds).toFixed(2) : 0;
  const margin        = totalRevenue ? ((grossProfit/totalRevenue)*100).toFixed(1) : 0;
  const breakEvenKg   = batch.farm.type==="broiler" && aliveBirds && batch.broilerRev.avgLiveWeightKg
    ? (grandExpenses/(aliveBirds*batch.broilerRev.avgLiveWeightKg)).toFixed(2) : null;
  const breakEvenCrate = batch.farm.type==="layer" && layDaysActive>0 && batch.layerRev.eggsPerDay && batch.layerRev.eggsPerCrate
    ? (grandExpenses/(layDaysActive*(batch.layerRev.eggsPerDay/batch.layerRev.eggsPerCrate))).toFixed(2) : null;
  const daysToMarket = batch.farm.type==="broiler" ? Math.max(0,slaughterAge-ageInDays) : null;
  const layerStage   = ageInWeeks<18?"Pullet / Grower":ageInWeeks<72?"Peak Production":"Late Lay / Spent";
  return {
    ageInDays,ageInWeeks,slaughterAge,safeMortality,aliveBirds,mortalityRate,
    totalFeedKg,totalFeedCost,feedPerBird,totalBiomass,fcr,fcrStatus,
    totalOther,chickCost,grandExpenses,costPerBird,
    layerRevenueDaily,layerRevenueMonthly,layDaysActive,layerRevenueCumulative,
    broilerRevTotal,broilerRevRealized,
    totalRevenue,grossProfit,profitPerBird,margin,
    breakEvenKg,breakEvenCrate,daysToMarket,layerStage,
  };
}

// ─── PDF Export (pure JS — no html2canvas needed) ────────────────────────────
function exportPDF(batch, calc) {
  // Build styled HTML, open in new window, trigger print-to-PDF
  const dateStr  = new Date().toLocaleDateString("en-NG", { day:"2-digit", month:"long", year:"numeric" });
  const fmtPDF   = (n, dec=0) => "₦" + Number(n||0).toLocaleString("en-NG",{minimumFractionDigits:dec,maximumFractionDigits:dec});
  const profitable = calc.grossProfit >= 0;
  const summary = profitable
    ? `This batch is <strong>profitable</strong> with a gross margin of <strong>${calc.margin}%</strong>. Total profit stands at ${fmtPDF(calc.grossProfit)} across ${calc.aliveBirds.toLocaleString()} alive birds.`
    : `This batch is currently <strong>operating at a loss</strong> of ${fmtPDF(Math.abs(calc.grossProfit))}. Cost recovery requires immediate attention to feed efficiency and mortality management.`;

  const row = (label, value, bold=false) =>
    `<tr><td style="padding:7px 12px;color:#64748b;font-size:13px;">${label}</td>
     <td style="padding:7px 12px;text-align:right;font-size:13px;font-weight:${bold?"700":"500"};color:#1e293b;">${value}</td></tr>`;

  const section = (title, rows) =>
    `<div style="margin-bottom:24px;">
      <div style="background:#6366f1;color:#fff;padding:8px 14px;border-radius:8px 8px 0 0;font-size:13px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">${title}</div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        ${rows}
      </table>
    </div>`;

  const kpiBox = (label, value, color="#1e293b") =>
    `<div style="flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;min-width:130px;">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">${label}</div>
      <div style="font-size:20px;font-weight:800;color:${color};">${value}</div>
    </div>`;

  const typeSpecificSection = batch.farm.type === "broiler"
    ? section("Broiler Details", [
        row("Slaughter Age",         `Day ${calc.slaughterAge}`),
        row("Avg Slaughter Weight",  `${batch.broilerRev.avgLiveWeightKg} kg`),
        row("Selling Price / kg",    fmtPDF(batch.broilerRev.sellingPricePerKg)),
        row("Current Live Weight",   `${batch.broilerRev.currentAvgWeightKg} kg`),
        row("FCR",                   calc.fcr),
        row("Total Biomass",         `${Number(calc.totalBiomass).toFixed(1)} kg`),
        row("Break-even Price / kg", calc.breakEvenKg ? fmtPDF(calc.breakEvenKg) : "N/A", true),
      ].join(""))
    : section("Layer Details", [
        row("Eggs Collected / Day",  Number(batch.layerRev.eggsPerDay).toLocaleString()),
        row("Eggs per Crate",        batch.layerRev.eggsPerCrate),
        row("Price per Crate",       fmtPDF(batch.layerRev.pricePerCrate)),
        row("Daily Revenue",         fmtPDF(calc.layerRevenueDaily)),
        row("Monthly Revenue",       fmtPDF(calc.layerRevenueMonthly)),
        row("Active Lay Days",       calc.layDaysActive),
        row("Cumulative Revenue",    fmtPDF(calc.layerRevenueCumulative), true),
        row("Break-even Crate Price",calc.breakEvenCrate ? fmtPDF(calc.breakEvenCrate) : "N/A", true),
      ].join(""));

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>FarmIQ Report – ${batch.name}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#1e293b;padding:32px;}
      @media print{body{padding:0;background:#fff;}
        .no-print{display:none!important;}
        @page{margin:18mm 14mm;size:A4;}}
      table tr:nth-child(even){background:#f8fafc;}
    </style></head><body>
    <!-- Print button -->
    <div class="no-print" style="text-align:right;margin-bottom:20px;">
      <button onclick="window.print()" style="background:#6366f1;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
        ⬇ Save / Print PDF
      </button>
    </div>

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#6366f1);border-radius:14px;padding:28px 32px;margin-bottom:28px;color:#fff;">
      <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.8;margin-bottom:4px;">FarmIQ – PoultryTracker</div>
      <div style="font-size:26px;font-weight:800;margin-bottom:6px;">${batch.name}</div>
      <div style="display:flex;gap:24px;font-size:13px;opacity:.85;flex-wrap:wrap;">
        <span>🐓 ${batch.farm.type.charAt(0).toUpperCase()+batch.farm.type.slice(1)}</span>
        <span>📅 Stocked: ${batch.farm.dateStocked}</span>
        <span>🗓 Report Date: ${dateStr}</span>
        <span>⏱ Age: ${calc.ageInWeeks} weeks (${calc.ageInDays} days)</span>
        <span style="padding:2px 10px;background:${profitable?"rgba(16,185,129,.3)":"rgba(244,63,94,.3)"};border-radius:20px;font-weight:700;">
          ${profitable?"▲ Profitable":"▼ Loss-making"}
        </span>
      </div>
    </div>

    <!-- KPI strip -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px;">
      ${kpiBox("Total Revenue", fmtPDF(calc.totalRevenue), "#10b981")}
      ${kpiBox("Total Expenses", fmtPDF(calc.grandExpenses))}
      ${kpiBox("Gross Profit", fmtPDF(calc.grossProfit), profitable?"#10b981":"#f43f5e")}
      ${kpiBox("Profit Margin", calc.margin+"%", profitable?"#10b981":"#f43f5e")}
      ${kpiBox("Profit / Bird", fmtPDF(calc.profitPerBird), profitable?"#10b981":"#f43f5e")}
    </div>

    <!-- Executive Summary -->
    <div style="background:${profitable?"#ecfdf5":"#fff1f2"};border-left:4px solid ${profitable?"#10b981":"#f43f5e"};border-radius:8px;padding:14px 18px;margin-bottom:28px;font-size:14px;line-height:1.7;color:#334155;">
      <strong>Executive Summary:</strong> ${summary}
    </div>

    <!-- Sections -->
    ${section("Flock Overview", [
      row("Birds Stocked",  Number(batch.farm.birdsStocked).toLocaleString()),
      row("Birds Alive",    calc.aliveBirds.toLocaleString()),
      row("Mortality",      `${calc.safeMortality} birds (${calc.mortalityRate}%)`),
      row("Date Stocked",   batch.farm.dateStocked),
      row("Bird Age",       `${calc.ageInWeeks} weeks / ${calc.ageInDays} days`),
    ].join(""))}

    ${section("Cost Breakdown", [
      row("Chick Cost",      fmtPDF(calc.chickCost)),
      row("Total Feed Cost", fmtPDF(calc.totalFeedCost)),
      row("Total Feed Used", `${Number(calc.totalFeedKg).toFixed(1)} kg`),
      row("Feed per Bird",   `${calc.feedPerBird} kg`),
      row("Other Expenses",  fmtPDF(calc.totalOther)),
      row("Grand Total",     fmtPDF(calc.grandExpenses), true),
      row("Cost per Bird",   fmtPDF(calc.costPerBird), true),
    ].join(""))}

    ${typeSpecificSection}

    ${section("Profit Summary", [
      row("Total Revenue",   fmtPDF(calc.totalRevenue), true),
      row("Total Expenses",  fmtPDF(calc.grandExpenses)),
      row("Gross Profit",    fmtPDF(calc.grossProfit), true),
      row("Profit per Bird", fmtPDF(calc.profitPerBird)),
      row("Profit Margin",   calc.margin + "%"),
    ].join(""))}

    <!-- Footer -->
    <div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:14px;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;">
      <span>FarmIQ – PoultryTracker &nbsp;|&nbsp; Confidential Investor Report</span>
      <span>Generated: ${dateStr}</span>
    </div>
  </body></html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("Please allow popups to export the PDF report."); return; }
  win.document.write(html);
  win.document.close();
}

// ─── Reusable UI ──────────────────────────────────────────────────────────────
const KPI = ({ label, value, sub, accent, danger }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-1">
    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
    <p className={`text-2xl font-bold ${danger?"text-rose-500":accent?"text-emerald-500":"text-slate-800"}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400">{sub}</p>}
  </div>
);
const Card = ({ children, className="" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-6 ${className}`}>{children}</div>
);
const Input = ({ label, type="text", value, onChange, options, min, max, disabled }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</label>
    {options ? (
      <select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}
        className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white disabled:opacity-50">
        {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
      </select>
    ) : (
      <input type={type} value={value} min={min} max={max} disabled={disabled} onChange={e=>onChange(e.target.value)}
        className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 disabled:bg-slate-50" />
    )}
  </div>
);
const Btn = ({ children, onClick, variant="primary", small, disabled }) => {
  const cls = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white",
    danger:  "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200",
    ghost:   "bg-slate-100 hover:bg-slate-200 text-slate-700",
    warning: "bg-amber-500 hover:bg-amber-600 text-white",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white",
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${cls} ${small?"px-3 py-1 text-xs":"px-4 py-2 text-sm"} rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2`}>
      {children}
    </button>
  );
};
const AlertCard = ({ type="warning", title, message }) => {
  const s = { warning:"bg-amber-50 border-amber-200 text-amber-800", danger:"bg-rose-50 border-rose-200 text-rose-800", success:"bg-emerald-50 border-emerald-200 text-emerald-800", info:"bg-indigo-50 border-indigo-200 text-indigo-800" };
  const ic = { warning:"⚠️", danger:"🚨", success:"✅", info:"💡" };
  return (
    <div className={`rounded-xl border px-4 py-3 flex gap-3 items-start ${s[type]}`}>
      <span className="text-base mt-0.5">{ic[type]}</span>
      <div><p className="text-xs font-bold uppercase tracking-wide mb-0.5">{title}</p>
        <p className="text-xs leading-relaxed">{message}</p></div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// APP
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── PART 1: Initialise from localStorage ──────────────────────────────────
  const [batches, setBatches] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_BATCHES);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [makeBatch({ name:"Batch Jan 2026" })];
  });

  const [activeBatchId, setActiveBatchId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVE);
      if (saved) return saved;
    } catch {}
    return batches[0]?.id;
  });

  // ── PART 1: Persist on every change ───────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(STORAGE_BATCHES, JSON.stringify(batches)); } catch {}
  }, [batches]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_ACTIVE, activeBatchId); } catch {}
  }, [activeBatchId]);

  const [page, setPage]               = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newBatchName, setNewBatchName] = useState("");
  const [showNewBatch, setShowNewBatch] = useState(false);

  const activeBatch = useMemo(() =>
    batches.find(b=>b.id===activeBatchId) || batches[0], [batches,activeBatchId]);
  const isClosed = activeBatch?.status === "closed";
  const calc     = useMemo(() => activeBatch ? calcBatch(activeBatch) : null, [activeBatch]);

  // ── Batch mutators ─────────────────────────────────────────────────────────
  const updateBatch   = useCallback((id, updater) => setBatches(p=>p.map(b=>b.id===id?updater(b):b)), []);
  const patchFarm     = (k,v) => updateBatch(activeBatch.id, b=>({...b,farm:{...b.farm,[k]:v}}));
  const patchBroilerRev=(k,v)=> updateBatch(activeBatch.id, b=>({...b,broilerRev:{...b.broilerRev,[k]:v}}));
  const patchLayerRev =(k,v)=> updateBatch(activeBatch.id, b=>({...b,layerRev:{...b.layerRev,[k]:v}}));
  const patchMortality= (v) => updateBatch(activeBatch.id, b=>({...b,mortality:Math.min(Number(v)||0,b.farm.birdsStocked)}));
  const patchFeedLog  = (fn)=> updateBatch(activeBatch.id, b=>({...b,feedLog:fn(b.feedLog)}));
  const patchExpenses = (fn)=> updateBatch(activeBatch.id, b=>({...b,expenses:fn(b.expenses)}));

  const createBatch = () => {
    const name = newBatchName.trim() || `Batch ${batches.length+1}`;
    const nb   = emptyBatch(name);
    setBatches(p=>[...p,nb]);
    setActiveBatchId(nb.id);
    setNewBatchName(""); setShowNewBatch(false); setPage("overview");
  };
  const closeBatch  = () => { if (!window.confirm(`Close "${activeBatch.name}"? It will become read-only.`)) return; updateBatch(activeBatch.id, b=>({...b,status:"closed"})); };
  const reopenBatch = () => updateBatch(activeBatch.id, b=>({...b,status:"active"}));

  // ── PART 1: Reset all data ─────────────────────────────────────────────────
  const resetAllData = () => {
    if (!window.confirm("Reset ALL data? This will erase every batch and cannot be undone.")) return;
    const def = [makeBatch({ name:"Batch Jan 2026" })];
    setBatches(def);
    setActiveBatchId(def[0].id);
    try { localStorage.removeItem(STORAGE_BATCHES); localStorage.removeItem(STORAGE_ACTIVE); } catch {}
    setPage("overview");
  };

  // ── Cash flow data ─────────────────────────────────────────────────────────
  const cashFlowData = useMemo(() => {
    if (!activeBatch||!calc) return [];
    const { ageInDays, slaughterAge, grandExpenses, broilerRevTotal, layerRevenueDaily } = calc;
    const totalDays = Math.max(ageInDays,1);
    const steps     = Math.min(totalDays,40);
    const interval  = Math.max(1, Math.ceil(totalDays/steps));
    const pts = [];
    for (let d=0; d<=totalDays; d+=interval) {
      const dayCost = (grandExpenses/totalDays)*d;
      const dayRevenue = activeBatch.farm.type==="broiler"
        ? (d>=slaughterAge ? broilerRevTotal : 0)
        : layerRevenueDaily * Math.max(0, d-126);
      pts.push({ day:`D${d}`, "Cumulative Cost":Math.round(dayCost), "Cumulative Revenue":Math.round(dayRevenue) });
    }
    return pts;
  }, [activeBatch, calc]);

  const expensePieData = useMemo(() => {
    if (!activeBatch||!calc) return [];
    return [
      { name:"Chick Cost", value:calc.chickCost },
      { name:"Feed",       value:calc.totalFeedCost },
      ...activeBatch.expenses.map(e=>({ name:e.category, value:Number(e.amount) }))
    ].filter(d=>d.value>0);
  }, [activeBatch, calc]);

  const revenueBarData = useMemo(() => {
    if (!activeBatch||!calc) return [];
    if (activeBatch.farm.type==="broiler")
      return [{ name:"At Slaughter", Revenue:calc.broilerRevTotal, Cost:calc.grandExpenses }];
    return [
      { name:"Daily",      Revenue:calc.layerRevenueDaily,       Cost:calc.grandExpenses/Math.max(calc.layDaysActive,1) },
      { name:"Monthly",    Revenue:calc.layerRevenueMonthly,     Cost:calc.grandExpenses/Math.max(calc.layDaysActive/30,1) },
      { name:"Cumulative", Revenue:calc.layerRevenueCumulative,  Cost:calc.grandExpenses },
    ];
  }, [activeBatch, calc]);

  const advisories = useMemo(() => {
    if (!activeBatch||!calc) return [];
    const msgs = [];
    const { mortalityRate, fcrStatus, fcr, aliveBirds, feedPerBird, ageInWeeks, daysToMarket, broilerRevRealized } = calc;
    if (Number(mortalityRate)>10) msgs.push({ type:"danger",  title:"Critical Mortality", message:`Mortality at ${mortalityRate}% exceeds 10%. Immediate veterinary review required.` });
    else if (Number(mortalityRate)>5) msgs.push({ type:"warning", title:"Elevated Mortality", message:`Mortality at ${mortalityRate}% is above 5%. Monitor closely.` });
    if (activeBatch.farm.type==="broiler") {
      if (fcrStatus==="poor")      msgs.push({ type:"warning", title:"Poor Feed Efficiency",     message:`FCR of ${fcr} is above 2.2. Review feed quality and flock health.` });
      if (fcrStatus==="excellent") msgs.push({ type:"success", title:"Excellent Feed Conversion", message:`FCR of ${fcr} is below 1.6 — outstanding performance.` });
      if (daysToMarket===0 && broilerRevRealized===0) msgs.push({ type:"info", title:"Batch Ready for Sale", message:"Birds have reached slaughter age. Record sale to realise revenue." });
      if (daysToMarket>0) msgs.push({ type:"info", title:"Revenue Not Yet Realised", message:`Broilers generate revenue only at slaughter (Day ${calc.slaughterAge}). ${daysToMarket} days remaining.` });
    }
    if (activeBatch.farm.type==="layer") {
      const eggRate = aliveBirds>0 ? activeBatch.layerRev.eggsPerDay/aliveBirds : 0;
      if (ageInWeeks>=18 && eggRate<0.6) msgs.push({ type:"warning", title:"Low Laying Rate", message:`${(eggRate*100).toFixed(1)}% hen-day production. Target ≥60%.` });
      if (Number(feedPerBird)>0.14)       msgs.push({ type:"info",    title:"High Feed Per Bird", message:`Feed per bird is ${feedPerBird} kg — above typical 0.11–0.13 kg for layers.` });
    }
    if (msgs.length===0) msgs.push({ type:"success", title:"All Systems Normal", message:"No alerts. Farm metrics are within acceptable ranges." });
    return msgs;
  }, [activeBatch, calc]);

  const nav = [
    { id:"overview",   label:"Overview",      Icon:IcHome },
    { id:"feed",       label:"Feed",          Icon:IcFeed },
    { id:"expenses",   label:"Expenses",      Icon:IcExpense },
    { id:"revenue",    label:"Revenue",       Icon:IcRevenue },
    { id:"profit",     label:"Profit",        Icon:IcProfit },
    { id:"setup",      label:"Farm Setup",    Icon:IcSetup },
    { id:"comparison", label:"Batch Compare", Icon:IcBatch },
  ];

  if (!activeBatch||!calc) return <div className="p-8 text-slate-500">No batches found.</div>;
  const profitable = calc.grossProfit >= 0;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`${sidebarOpen?"w-56":"w-16"} flex-shrink-0 bg-slate-900 flex flex-col transition-all duration-200`}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
          <span className="text-2xl">🐔</span>
          {sidebarOpen && <span className="text-white font-bold text-sm leading-tight">FarmIQ<br/><span className="text-indigo-400 font-normal text-xs">PoultryTracker</span></span>}
          <button onClick={()=>setSidebarOpen(p=>!p)} className="ml-auto text-slate-400 hover:text-white">
            <IcChevron dir={sidebarOpen?"left":"right"}/>
          </button>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2">
          {nav.map(({id,label,Icon:Ic})=>(
            <button key={id} onClick={()=>setPage(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium
                ${page===id?"bg-indigo-600 text-white":"text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
              <span className="flex-shrink-0"><Ic/></span>
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-slate-700">
          <div className={`flex items-center gap-2 ${!sidebarOpen&&"justify-center"}`}>
            <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">F</div>
            {sidebarOpen && <div><p className="text-white text-xs font-medium">FarmIQ Admin</p><p className="text-slate-400 text-xs">Farm Manager</p></div>}
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <select value={activeBatchId}
              onChange={e=>{setActiveBatchId(e.target.value);setPage("overview");}}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white max-w-[200px]">
              {batches.map(b=><option key={b.id} value={b.id}>{b.name}{b.status==="closed"?" 🔒":""}</option>)}
            </select>
            {isClosed && <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg"><IcLock/> Closed</span>}
            {!isClosed && <button onClick={closeBatch} className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-600 border border-slate-200 hover:border-amber-300 px-2 py-1 rounded-lg transition-colors"><IcLock/> Close Batch</button>}
            {isClosed  && <button onClick={reopenBatch} className="text-xs text-indigo-600 border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-50">Reopen</button>}
          </div>
          <div className="flex items-center gap-2">
            {showNewBatch ? (
              <>
                <input value={newBatchName} onChange={e=>setNewBatchName(e.target.value)}
                  placeholder="Batch name…" onKeyDown={e=>e.key==="Enter"&&createBatch()}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-36"/>
                <Btn onClick={createBatch} small>Create</Btn>
                <Btn onClick={()=>setShowNewBatch(false)} variant="ghost" small>Cancel</Btn>
              </>
            ) : (
              <button onClick={()=>setShowNewBatch(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors">
                <IcPlus/> New Batch
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {calc.mortalityRate>10 && <span className="text-xs font-semibold px-3 py-1 rounded-full bg-rose-100 text-rose-600">🚨 High Mortality</span>}
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${profitable?"bg-emerald-50 text-emerald-600":"bg-rose-50 text-rose-600"}`}>
              {profitable?"▲ Profitable":"▼ Loss-making"}
            </span>
          </div>
        </header>

        <div className="px-8 py-6 flex-1">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{nav.find(n=>n.id===page)?.label}</h1>
              <p className="text-xs text-slate-400">{activeBatch.name} · {activeBatch.farm.type==="broiler"?"🐓 Broiler":"🥚 Layer"} · {calc.aliveBirds.toLocaleString()} alive birds · Age {calc.ageInWeeks}wk</p>
            </div>
            {/* PDF export shortcut on profit page */}
            {page==="profit" && (
              <Btn variant="success" onClick={()=>exportPDF(activeBatch, calc)}>
                <IcDownload/> Export Investor Report
              </Btn>
            )}
          </div>

          {/* ════ OVERVIEW ══════════════════════════════════════════════════ */}
          {page==="overview" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <KPI label="Birds Alive"    value={calc.aliveBirds.toLocaleString()} sub={`of ${activeBatch.farm.birdsStocked.toLocaleString()} stocked`}/>
                <KPI label="Age"            value={`${calc.ageInWeeks} wks`} sub={`${calc.ageInDays} days`}/>
                <KPI label="Mortality Rate" value={`${calc.mortalityRate}%`} sub={`${calc.safeMortality} birds`} danger={Number(calc.mortalityRate)>5}/>
                {activeBatch.farm.type==="broiler"
                  ? <KPI label="Days to Market" value={calc.daysToMarket===0?"Ready!":calc.daysToMarket===null?"N/A":`${calc.daysToMarket}d`} sub={`Slaughter at day ${calc.slaughterAge}`} accent={calc.daysToMarket===0}/>
                  : <KPI label="Production Stage" value={calc.layerStage} sub={`Wk ${calc.ageInWeeks}`} accent/>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <KPI label={activeBatch.farm.type==="layer"?"Cumulative Revenue":"Revenue (at sale)"} value={`₦${fmt(calc.totalRevenue)}`} accent/>
                <KPI label="Total Expenses"  value={`₦${fmt(calc.grandExpenses)}`}/>
                <KPI label="Gross Profit"    value={`₦${fmt(calc.grossProfit)}`}  accent={profitable} danger={!profitable}/>
                <KPI label="Profit / Bird"   value={`₦${fmt(calc.profitPerBird)}`} accent={Number(calc.profitPerBird)>=0} danger={Number(calc.profitPerBird)<0}/>
              </div>
              <div className="mb-5">
                <h2 className="text-sm font-semibold text-slate-600 mb-3">📋 Farm Intelligence Advisories</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {advisories.map((a,i)=><AlertCard key={i} {...a}/>)}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <Card>
                  <h3 className="text-sm font-semibold text-slate-600 mb-4">Daily Feed Usage (kg)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={activeBatch.feedLog}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={d=>d.slice(5)}/>
                      <YAxis tick={{fontSize:10}}/><Tooltip/>
                      <Line type="monotone" dataKey="kgUsed" stroke="#6366f1" strokeWidth={2} dot={{r:3}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <h3 className="text-sm font-semibold text-slate-600 mb-4">Cost Breakdown</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                        label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {expensePieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={v=>`₦${fmt(v)}`}/>
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </div>
              <Card>
                <h3 className="text-sm font-semibold text-slate-600 mb-1">Cumulative Cash Flow — Break-Even Visualisation</h3>
                <p className="text-xs text-slate-400 mb-4">
                  {activeBatch.farm.type==="broiler"
                    ? `Revenue spike at slaughter (Day ${calc.slaughterAge}). Break-even where green crosses red.`
                    : "Revenue ramps after lay onset (~18 wks). Break-even where green crosses red."}
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="day" tick={{fontSize:10}} interval={Math.ceil(cashFlowData.length/8)}/>
                    <YAxis tick={{fontSize:10}} tickFormatter={v=>`₦${(v/1000).toFixed(0)}k`}/>
                    <Tooltip formatter={v=>`₦${fmt(v)}`}/><Legend/>
                    <Line type="monotone" dataKey="Cumulative Cost"    stroke={RED}   strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="Cumulative Revenue" stroke={GREEN} strokeWidth={2} dot={false} strokeDasharray="5 3"/>
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}

          {page==="feed"     && <FeedPage batch={activeBatch} calc={calc} isClosed={isClosed} patchFeedLog={patchFeedLog} patchBroilerRev={patchBroilerRev}/>}
          {page==="expenses" && <ExpensesPage batch={activeBatch} calc={calc} isClosed={isClosed} patchExpenses={patchExpenses} expensePieData={expensePieData}/>}
          {page==="revenue"  && <RevenuePage batch={activeBatch} calc={calc} isClosed={isClosed} patchBroilerRev={patchBroilerRev} patchLayerRev={patchLayerRev} revenueBarData={revenueBarData}/>}
          {page==="profit"   && <ProfitPage batch={activeBatch} calc={calc} onExport={()=>exportPDF(activeBatch,calc)}/>}
          {page==="setup"    && <SetupPage batch={activeBatch} calc={calc} isClosed={isClosed} patchFarm={patchFarm} patchMortality={patchMortality} updateBatch={updateBatch} onReset={resetAllData}/>}
          {page==="comparison" && <BatchComparison batches={batches} activeBatchId={activeBatchId} onSwitch={id=>{setActiveBatchId(id);setPage("overview");}}/>}
        </div>
      </main>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FEED PAGE
// ═════════════════════════════════════════════════════════════════════════════
function FeedPage({ batch, calc, isClosed, patchFeedLog, patchBroilerRev }) {
  const [form, setForm] = useState({ date:new Date().toISOString().split("T")[0], kgUsed:"", cost:"" });
  const add = () => {
    if (!form.kgUsed||!form.cost) return;
    patchFeedLog(l=>[...l,{id:uid(),...form,kgUsed:Number(form.kgUsed),cost:Number(form.cost)}]);
    setForm(f=>({...f,kgUsed:"",cost:""}));
  };
  const del = id => patchFeedLog(l=>l.filter(r=>r.id!==id));
  const fcrBadge = {
    poor:      { cls:"bg-rose-100 text-rose-700",       label:"⚠ Poor FCR" },
    good:      { cls:"bg-amber-100 text-amber-700",     label:"✓ Acceptable" },
    excellent: { cls:"bg-emerald-100 text-emerald-700", label:"★ Excellent" },
  };
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI label="Total Feed Used" value={`${fmt(calc.totalFeedKg)} kg`}/>
        <KPI label="Total Feed Cost" value={`₦${fmt(calc.totalFeedCost)}`}/>
        <KPI label="Feed / Bird"     value={`${calc.feedPerBird} kg`}/>
        {batch.farm.type==="broiler" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">FCR (Live Weight)</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-slate-800">{calc.fcr}</p>
              {calc.fcrStatus && <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${fcrBadge[calc.fcrStatus].cls}`}>{fcrBadge[calc.fcrStatus].label}</span>}
            </div>
            <p className="text-xs text-slate-400">Biomass: {fmt(calc.totalBiomass,1)} kg</p>
          </div>
        )}
      </div>
      {batch.farm.type==="broiler" && (
        <Card className="mb-6">
          <h3 className="text-sm font-semibold text-slate-600 mb-4">FCR Inputs — Current Live Weight</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Current Avg Weight (kg)" type="number" min="0" disabled={isClosed}
              value={batch.broilerRev.currentAvgWeightKg} onChange={v=>patchBroilerRev("currentAvgWeightKg",Number(v))}/>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Alive Birds</label>
              <div className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-400 bg-slate-50">{calc.aliveBirds.toLocaleString()}</div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Biomass (kg)</label>
              <div className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-indigo-50 text-indigo-700 font-semibold">{fmt(calc.totalBiomass,1)} kg</div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">FCR = Total Feed ÷ Total Live Biomass (not projected slaughter weight)</p>
        </Card>
      )}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <h3 className="text-sm font-semibold text-slate-600 mb-4">Daily Feed Usage (kg)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={batch.feedLog}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={d=>d.slice(5)}/>
              <YAxis tick={{fontSize:10}}/><Tooltip/>
              <Line type="monotone" dataKey="kgUsed" stroke="#6366f1" strokeWidth={2} dot={{r:3}} name="kg Used"/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-slate-600 mb-4">Daily Feed Cost (₦)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={batch.feedLog}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={d=>d.slice(5)}/>
              <YAxis tick={{fontSize:10}}/><Tooltip formatter={v=>`₦${fmt(v)}`}/>
              <Bar dataKey="cost" fill="#22d3ee" radius={[4,4,0,0]} name="Cost (₦)"/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card>
        <h3 className="text-sm font-semibold text-slate-600 mb-4">Log Feed Entry</h3>
        {isClosed && <p className="text-xs text-amber-600 mb-3">🔒 Batch is closed. Feed entries are read-only.</p>}
        {!isClosed && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Input label="Date" type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/>
            <Input label="Feed Used (kg)" type="number" value={form.kgUsed} onChange={v=>setForm(f=>({...f,kgUsed:v}))} min="0"/>
            <Input label="Cost (₦)" type="number" value={form.cost} onChange={v=>setForm(f=>({...f,cost:v}))} min="0"/>
            <div className="flex items-end"><Btn onClick={add}>Add Entry</Btn></div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100">
              {["Date","Feed (kg)","Cost (₦)","₦/kg",""].map(h=>(
                <th key={h} className="text-left text-xs font-medium text-slate-500 pb-2 pr-4">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[...batch.feedLog].reverse().map(r=>(
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 pr-4">{r.date}</td>
                  <td className="py-2 pr-4">{r.kgUsed}</td>
                  <td className="py-2 pr-4">₦{fmt(r.cost)}</td>
                  <td className="py-2 pr-4">₦{fmtN(r.cost/r.kgUsed)}</td>
                  <td className="py-2">{!isClosed&&<Btn onClick={()=>del(r.id)} variant="danger" small>Remove</Btn>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPENSES PAGE
// ═════════════════════════════════════════════════════════════════════════════
function ExpensesPage({ batch, calc, isClosed, patchExpenses, expensePieData }) {
  const cats = ["Medication","Vaccination","Labour","Electricity","Miscellaneous"];
  const [form, setForm] = useState({ category:"Medication", amount:"", note:"" });
  const add = () => {
    if (!form.amount) return;
    patchExpenses(l=>[...l,{id:uid(),...form,amount:Number(form.amount)}]);
    setForm(f=>({...f,amount:"",note:""}));
  };
  const del = id => patchExpenses(l=>l.filter(e=>e.id!==id));
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI label="Chick Cost"     value={`₦${fmt(calc.chickCost)}`}/>
        <KPI label="Feed Cost"      value={`₦${fmt(calc.totalFeedCost)}`}/>
        <KPI label="Other Expenses" value={`₦${fmt(calc.totalOther)}`}/>
        <KPI label="Total / Bird"   value={`₦${fmt(calc.costPerBird)}`} sub={`${calc.aliveBirds.toLocaleString()} alive birds`}/>
      </div>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <h3 className="text-sm font-semibold text-slate-600 mb-1">Total: <span className="text-rose-500 font-bold">₦{fmt(calc.grandExpenses)}</span></h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {expensePieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
              </Pie>
              <Tooltip formatter={v=>`₦${fmt(v)}`}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-slate-600 mb-4">Add Expense</h3>
          {isClosed ? <p className="text-xs text-amber-600">🔒 Batch is closed.</p> : (
            <div className="flex flex-col gap-3">
              <Input label="Category" value={form.category} onChange={v=>setForm(f=>({...f,category:v}))} options={cats}/>
              <Input label="Amount (₦)" type="number" value={form.amount} onChange={v=>setForm(f=>({...f,amount:v}))} min="0"/>
              <Input label="Note" value={form.note} onChange={v=>setForm(f=>({...f,note:v}))}/>
              <Btn onClick={add}>Add Expense</Btn>
            </div>
          )}
        </Card>
      </div>
      <Card>
        <h3 className="text-sm font-semibold text-slate-600 mb-4">Expense Log</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-100">
            {["Category","Amount (₦)","Note",""].map(h=>(
              <th key={h} className="text-left text-xs font-medium text-slate-500 pb-2 pr-4">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {batch.expenses.map(e=>(
              <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-2 pr-4"><span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700">{e.category}</span></td>
                <td className="py-2 pr-4 font-medium">₦{fmt(e.amount)}</td>
                <td className="py-2 pr-4 text-slate-500">{e.note}</td>
                <td className="py-2">{!isClosed&&<Btn onClick={()=>del(e.id)} variant="danger" small>Remove</Btn>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// REVENUE PAGE
// ═════════════════════════════════════════════════════════════════════════════
function RevenuePage({ batch, calc, isClosed, patchBroilerRev, patchLayerRev, revenueBarData }) {
  const broilerPerBird = batch.broilerRev.avgLiveWeightKg * batch.broilerRev.sellingPricePerKg;
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {batch.farm.type==="broiler" ? <>
          <KPI label="Revenue / Bird"    value={`₦${fmt(broilerPerBird)}`}/>
          <KPI label="Projected Revenue" value={`₦${fmt(calc.broilerRevTotal)}`}/>
          <KPI label="Realised Revenue"  value={`₦${fmt(calc.broilerRevRealized)}`} accent sub={calc.daysToMarket>0?`At Day ${calc.slaughterAge}`:"Sold"}/>
          <KPI label="Price / kg"        value={`₦${fmt(batch.broilerRev.sellingPricePerKg)}`}/>
        </> : <>
          <KPI label="Eggs / Day"         value={fmt(batch.layerRev.eggsPerDay)}/>
          <KPI label="Crates / Day"       value={(batch.layerRev.eggsPerDay/batch.layerRev.eggsPerCrate).toFixed(1)}/>
          <KPI label="Daily Revenue"      value={`₦${fmt(calc.layerRevenueDaily)}`}/>
          <KPI label="Cumulative Revenue" value={`₦${fmt(calc.layerRevenueCumulative)}`} accent sub={`Over ${calc.layDaysActive} lay days`}/>
        </>}
      </div>
      {batch.farm.type==="broiler" && calc.daysToMarket>0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-5 text-xs text-amber-700">
          <strong>Revenue not yet realised.</strong> Broilers generate revenue only at slaughter (Day {calc.slaughterAge}). {calc.daysToMarket} days remaining. Projected: ₦{fmt(calc.broilerRevTotal)}.
        </div>
      )}
      {batch.farm.type==="layer" && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3 mb-5 text-xs text-indigo-700">
          <strong>Note:</strong> Cumulative Revenue (₦{fmt(calc.layerRevenueCumulative)}) is used for P&L. Monthly projection (₦{fmt(calc.layerRevenueMonthly)}) is for planning only.
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-semibold text-slate-600 mb-4">Revenue vs Cost</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:10}}/>
              <Tooltip formatter={v=>`₦${fmt(v)}`}/><Legend/>
              <Bar dataKey="Revenue" fill="#10b981" radius={[4,4,0,0]}/>
              <Bar dataKey="Cost"    fill="#f43f5e" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-slate-600 mb-4">Revenue Settings</h3>
          {batch.farm.type==="broiler" ? (
            <div className="flex flex-col gap-3">
              <Input label="Avg Slaughter Weight (kg)" type="number" min="0" disabled={isClosed}
                value={batch.broilerRev.avgLiveWeightKg} onChange={v=>patchBroilerRev("avgLiveWeightKg",Number(v))}/>
              <Input label="Selling Price / kg (₦)" type="number" min="0" disabled={isClosed}
                value={batch.broilerRev.sellingPricePerKg} onChange={v=>patchBroilerRev("sellingPricePerKg",Number(v))}/>
              <div className="mt-2 bg-emerald-50 rounded-xl p-4">
                <p className="text-xs text-slate-500">Revenue per bird</p>
                <p className="text-2xl font-bold text-emerald-600">₦{fmt(broilerPerBird)}</p>
                <p className="text-xs text-slate-500 mt-1">× {calc.aliveBirds.toLocaleString()} birds = <strong>₦{fmt(calc.broilerRevTotal)}</strong></p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Input label="Eggs / Day" type="number" min="0" disabled={isClosed}
                value={batch.layerRev.eggsPerDay} onChange={v=>patchLayerRev("eggsPerDay",Number(v))}/>
              <Input label="Eggs per Crate" type="number" min="1" disabled={isClosed}
                value={batch.layerRev.eggsPerCrate} onChange={v=>patchLayerRev("eggsPerCrate",Number(v))}/>
              <Input label="Price per Crate (₦)" type="number" min="0" disabled={isClosed}
                value={batch.layerRev.pricePerCrate} onChange={v=>patchLayerRev("pricePerCrate",Number(v))}/>
              <div className="mt-2 bg-emerald-50 rounded-xl p-4">
                <p className="text-xs text-slate-500">Cumulative revenue</p>
                <p className="text-2xl font-bold text-emerald-600">₦{fmt(calc.layerRevenueCumulative)}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PROFIT PAGE — updated with PDF export button
// ═════════════════════════════════════════════════════════════════════════════
function ProfitPage({ batch, calc, onExport }) {
  const profitable = calc.grossProfit >= 0;
  return (
    <>
      <div className={`rounded-2xl p-6 mb-6 ${profitable?"bg-emerald-50 border border-emerald-200":"bg-rose-50 border border-rose-200"}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`text-5xl font-black ${profitable?"text-emerald-600":"text-rose-600"}`}>{profitable?"▲":"▼"}</div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-widest ${profitable?"text-emerald-500":"text-rose-500"}`}>{profitable?"Profit":"Loss"}</p>
              <p className={`text-4xl font-black ${profitable?"text-emerald-700":"text-rose-700"}`}>₦{fmt(Math.abs(calc.grossProfit))}</p>
              <p className="text-sm text-slate-500 mt-1">Margin: {calc.margin}% · Per bird: ₦{fmt(calc.profitPerBird)}
                {batch.farm.type==="layer"&&<span className="ml-2 text-indigo-500 text-xs">(Cumulative basis)</span>}
              </p>
            </div>
          </div>
          <Btn variant="success" onClick={onExport}>
            <IcDownload/> Export Investor Report
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI label={batch.farm.type==="layer"?"Cumulative Revenue":"Total Revenue"} value={`₦${fmt(calc.totalRevenue)}`} accent/>
        {batch.farm.type==="layer"&&<KPI label="Monthly Projection" value={`₦${fmt(calc.layerRevenueMonthly)}`} sub="Planning only"/>}
        <KPI label="Total Expenses" value={`₦${fmt(calc.grandExpenses)}`}/>
        <KPI label="Gross Profit"   value={`₦${fmt(calc.grossProfit)}`} accent={profitable} danger={!profitable}/>
        <KPI label="Profit Margin"  value={`${calc.margin}%`}           accent={profitable} danger={!profitable}/>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-semibold text-slate-600 mb-4">Cost Waterfall</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[
              { name:"Chick Cost", value:calc.chickCost },
              { name:"Feed",       value:calc.totalFeedCost },
              { name:"Other",      value:calc.totalOther },
              { name:"Revenue",    value:calc.totalRevenue },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:10}}/>
              <Tooltip formatter={v=>`₦${fmt(v)}`}/>
              <Bar dataKey="value" radius={[4,4,0,0]}>
                {[0,1,2,3].map(i=><Cell key={i} fill={i===3?GREEN:PIE_COLORS[i%3]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-slate-600 mb-4">Break-Even Analysis</h3>
          <div className="space-y-4">
            {batch.farm.type==="broiler"&&calc.breakEvenKg&&(
              <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Break-even price per kg</p>
                <p className="text-3xl font-bold text-indigo-600">₦{fmt(calc.breakEvenKg)}</p>
                <p className="text-xs text-slate-400 mt-1">Min sell price per kg to break even</p>
              </div>
            )}
            {batch.farm.type==="layer"&&calc.breakEvenCrate&&(
              <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Break-even price per crate</p>
                <p className="text-3xl font-bold text-indigo-600">₦{fmt(calc.breakEvenCrate)}</p>
                <p className="text-xs text-slate-400 mt-1">Min crate price to recoup all costs</p>
              </div>
            )}
            <div className="space-y-2 text-sm">
              {[
                ["Chick Cost",    `₦${fmt(calc.chickCost)}`],
                ["Feed Cost",     `₦${fmt(calc.totalFeedCost)}`],
                ["Other Costs",   `₦${fmt(calc.totalOther)}`],
                ["Total Expenses",`₦${fmt(calc.grandExpenses)}`],
                [batch.farm.type==="layer"?"Cumulative Revenue":"Revenue",`₦${fmt(calc.totalRevenue)}`],
              ].map(([k,v])=>(
                <div key={k} className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-semibold text-slate-700">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SETUP PAGE — with Reset All Data button
// ═════════════════════════════════════════════════════════════════════════════
function SetupPage({ batch, calc, isClosed, patchFarm, patchMortality, updateBatch, onReset }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI label="Bird Age"    value={`${calc.ageInWeeks} wks`} sub={`${calc.ageInDays} days`}/>
        <KPI label="Mortality"   value={`${calc.mortalityRate}%`} sub={`${calc.safeMortality} birds`} danger={Number(calc.mortalityRate)>5}/>
        {batch.farm.type==="broiler"
          ? <KPI label="Days to Market" value={calc.daysToMarket===0?"Ready!":`${calc.daysToMarket}d`} accent={calc.daysToMarket===0}/>
          : <KPI label="Stage" value={calc.layerStage} accent/>}
        <KPI label="Alive Birds" value={calc.aliveBirds.toLocaleString()}/>
      </div>

      {Number(calc.mortalityRate)>10&&<div className="mb-4"><AlertCard type="danger" title="Critical Mortality Alert" message={`Mortality at ${calc.mortalityRate}% exceeds 10% threshold.`}/></div>}
      {Number(calc.mortalityRate)>5&&Number(calc.mortalityRate)<=10&&<div className="mb-4"><AlertCard type="warning" title="Elevated Mortality" message={`Mortality at ${calc.mortalityRate}% above 5% warning threshold.`}/></div>}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <h3 className="text-sm font-semibold text-slate-600 mb-4">Farm Configuration</h3>
          <div className="grid grid-cols-1 gap-4">
            <Input label="Batch Name" value={batch.name} disabled={isClosed} onChange={v=>updateBatch(batch.id,b=>({...b,name:v}))}/>
            <Input label="Farm Type"  value={batch.farm.type} disabled={isClosed} onChange={v=>patchFarm("type",v)}
              options={[{value:"broiler",label:"🐓 Broiler"},{value:"layer",label:"🥚 Layer"}]}/>
            <Input label="Birds Stocked" type="number" min="1" disabled={isClosed}
              value={batch.farm.birdsStocked} onChange={v=>patchFarm("birdsStocked",Number(v))}/>
            <Input label="Date Stocked" type="date" disabled={isClosed}
              value={batch.farm.dateStocked} onChange={v=>patchFarm("dateStocked",v)}/>
            {batch.farm.type==="broiler"&&(
              <Input label="Slaughter Age (days)" type="number" min="1" disabled={isClosed}
                value={batch.farm.slaughterAge} onChange={v=>patchFarm("slaughterAge",Number(v))}/>
            )}
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-slate-600 mb-4">Cost Parameters</h3>
          <div className="grid grid-cols-1 gap-4">
            <Input label="Cost per Chick (₦)" type="number" min="0" disabled={isClosed}
              value={batch.farm.costPerChick} onChange={v=>patchFarm("costPerChick",Number(v))}/>
            <Input label="Feed Cost per Bag (₦)" type="number" min="0" disabled={isClosed}
              value={batch.farm.feedCostPerBag} onChange={v=>patchFarm("feedCostPerBag",Number(v))}/>
            <Input label="Avg Bag Weight (kg)" type="number" min="1" disabled={isClosed}
              value={batch.farm.avgBagWeightKg} onChange={v=>patchFarm("avgBagWeightKg",Number(v))}/>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                Total Mortality (max: {batch.farm.birdsStocked})
              </label>
              <div className="flex items-center gap-3">
                <input type="number" min="0" max={batch.farm.birdsStocked} disabled={isClosed}
                  value={batch.mortality} onChange={e=>patchMortality(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full disabled:opacity-50"/>
                <span className={`text-sm font-semibold px-2 py-1 rounded-lg whitespace-nowrap
                  ${Number(calc.mortalityRate)>10?"bg-rose-100 text-rose-700":Number(calc.mortalityRate)>5?"bg-amber-100 text-amber-700":"bg-emerald-50 text-emerald-600"}`}>
                  {calc.mortalityRate}%
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* PART 1: Reset All Data */}
      <Card className="border-rose-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-sm font-semibold text-rose-600 mb-1">Danger Zone</h3>
            <p className="text-xs text-slate-500">Permanently erase all batches and reset to factory defaults. This cannot be undone.</p>
          </div>
          <button onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl font-medium bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors">
            <IcTrash/> Reset All Data
          </button>
        </div>
      </Card>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BATCH COMPARISON PAGE — with PDF export per batch
// ═════════════════════════════════════════════════════════════════════════════
function BatchComparison({ batches, activeBatchId, onSwitch }) {
  const [sortKey, setSortKey] = useState("grossProfit");
  const [sortDir, setSortDir] = useState("desc");

  const rows = useMemo(() => batches.map(b => {
    const c = calcBatch(b);
    return { id:b.id, name:b.name, status:b.status, type:b.farm.type,
      birdsStocked:b.farm.birdsStocked, mortalityPct:Number(c.mortalityRate),
      grandExpenses:c.grandExpenses, totalRevenue:c.totalRevenue,
      grossProfit:c.grossProfit, margin:Number(c.margin),
      profitPerBird:Number(c.profitPerBird), ageInWeeks:c.ageInWeeks,
      _batch:b, _calc:c };
  }), [batches]);

  const sorted = useMemo(() => [...rows].sort((a,b) => {
    const av=a[sortKey], bv=b[sortKey];
    if (typeof av==="string") return sortDir==="asc"?av.localeCompare(bv):bv.localeCompare(av);
    return sortDir==="asc"?av-bv:bv-av;
  }), [rows,sortKey,sortDir]);

  const toggleSort = key => {
    if (sortKey===key) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const SortTh = ({ col, label }) => (
    <th onClick={()=>toggleSort(col)}
      className="text-left text-xs font-medium text-slate-500 pb-3 pr-4 cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap">
      {label} {sortKey===col?(sortDir==="asc"?"↑":"↓"):"↕"}
    </th>
  );
  const best  = Math.max(...rows.map(r=>r.grossProfit));

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI label="Total Batches"  value={batches.length}/>
        <KPI label="Active Batches" value={batches.filter(b=>b.status==="active").length}/>
        <KPI label="Closed Batches" value={batches.filter(b=>b.status==="closed").length}/>
        <KPI label="Best Profit"    value={`₦${fmt(best)}`} accent={best>=0} danger={best<0}/>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-600">Batch Performance Comparison</h3>
            <p className="text-xs text-slate-400 mt-0.5">Click column headers to sort. Click a row to switch batch.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <SortTh col="name"          label="Batch"/>
                <SortTh col="type"          label="Type"/>
                <SortTh col="ageInWeeks"    label="Age (wk)"/>
                <SortTh col="birdsStocked"  label="Stocked"/>
                <SortTh col="mortalityPct"  label="Mortality %"/>
                <SortTh col="grandExpenses" label="Total Cost"/>
                <SortTh col="totalRevenue"  label="Revenue"/>
                <SortTh col="grossProfit"   label="Gross Profit"/>
                <SortTh col="margin"        label="Margin %"/>
                <SortTh col="profitPerBird" label="₦/Bird"/>
                <th className="text-left text-xs font-medium text-slate-500 pb-3 pr-4">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 pb-3">Report</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r=>{
                const isActive = r.id===activeBatchId;
                const isBest   = r.grossProfit===best && rows.length>1;
                return (
                  <tr key={r.id} onClick={()=>onSwitch(r.id)}
                    className={`border-b border-slate-50 cursor-pointer transition-colors ${isActive?"bg-indigo-50 hover:bg-indigo-100":"hover:bg-slate-50"}`}>
                    <td className="py-3 pr-4 font-semibold text-slate-800">
                      {r.name}
                      {isBest&&<span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">🏆</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${r.type==="broiler"?"bg-orange-50 text-orange-700":"bg-yellow-50 text-yellow-700"}`}>
                        {r.type==="broiler"?"🐓":"🥚"} {r.type}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{r.ageInWeeks}</td>
                    <td className="py-3 pr-4 text-slate-600">{r.birdsStocked.toLocaleString()}</td>
                    <td className={`py-3 pr-4 font-medium ${r.mortalityPct>10?"text-rose-600":r.mortalityPct>5?"text-amber-600":"text-slate-600"}`}>{r.mortalityPct.toFixed(1)}%</td>
                    <td className="py-3 pr-4 text-slate-700">₦{fmt(r.grandExpenses)}</td>
                    <td className="py-3 pr-4 text-slate-700">₦{fmt(r.totalRevenue)}</td>
                    <td className={`py-3 pr-4 font-bold ${r.grossProfit>=0?"text-emerald-600":"text-rose-600"}`}>
                      {r.grossProfit>=0?"":"−"}₦{fmt(Math.abs(r.grossProfit))}
                    </td>
                    <td className={`py-3 pr-4 font-medium ${r.margin>=0?"text-emerald-600":"text-rose-600"}`}>{r.margin.toFixed(1)}%</td>
                    <td className={`py-3 pr-4 font-medium ${r.profitPerBird>=0?"text-emerald-600":"text-rose-600"}`}>₦{fmt(r.profitPerBird)}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${r.status==="closed"?"bg-slate-100 text-slate-500":"bg-green-50 text-green-700"}`}>
                        {r.status==="closed"?"🔒 Closed":"● Active"}
                      </span>
                    </td>
                    <td className="py-3" onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>exportPDF(r._batch, r._calc)}
                        className="flex items-center gap-1 text-xs text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                        <IcDownload/> PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-8">
          <h4 className="text-sm font-semibold text-slate-600 mb-4">Profit Comparison</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sorted.map(r=>({ name:r.name.length>12?r.name.slice(0,11)+"…":r.name, Profit:r.grossProfit, Cost:r.grandExpenses }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:10}}/>
              <Tooltip formatter={v=>`₦${fmt(v)}`}/><Legend/>
              <Bar dataKey="Profit" radius={[4,4,0,0]}>
                {sorted.map((r,i)=><Cell key={i} fill={r.grossProfit>=0?GREEN:RED}/>)}
              </Bar>
              <Bar dataKey="Cost" fill="#6366f1" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );
}
