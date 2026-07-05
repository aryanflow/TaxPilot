import { useState } from "react";

// ─────────────────────────────────────────────────────────────
//  ITR e-Filing PRACTICE PORTAL  ·  faithful sandbox of the real flow
//  Login → Dashboard → File ITR wizard → Select Schedule → Return Summary
//  Nothing is submitted. No real login. Session timer never expires.
//  Coach-mark dialogs on every screen (toggle: "Guidance").
//  Schedules can be checked/unchecked freely (mandatory pre-selected, not locked).
//  Every schedule opens an editable panel with pre-filled values that recompute
//  the return live. "Add More Schedules" returns to the selection screen.
//  Runtime-safe: no imports, global React hooks, CSS-in-JSX.
// ─────────────────────────────────────────────────────────────

// e-Filing portal palette, matched to the real site.
const NAVY  = "#2b3a8f";   // primary nav / buttons
const NAVY_D = "#24327a";
const BLUE  = "#0b57d0";   // links
const LINK  = "#1a5cc8";
const RED   = "#d32f2f";    // mandatory asterisk / errors
const GREEN = "#1e7e34";
const AMBER = "#c77700";
const INK   = "#1f2733";
const MUTE  = "#5a6675";
const FAINT = "#8a95a5";
const LINE  = "#dfe3ea";
const BG    = "#f3f5f9";
const CARD  = "#ffffff";
const TINT  = "#eef3fb";

// All identity is fictional. Numbers are round & fake but fully functional.
const SAMPLE = {
  pan: "ABCDE1234F", name: "SAMPLE TAXPAYER", first: "SAMPLE",
  aadhaar: "XXXXXXXX0000", mobile: "9000000000", email: "practice.user@example.com",
  dob: "1996-04-10", address: "42, Practice Lane, Sample Nagar, Bengaluru 560001",
  bankName: "Sample Bank of India", ifsc: "SMPL0001234", account: "XXXXXX0000",
  employer: "Practice Techworks Pvt Ltd", tan: "BLRP01234C",
  // Salary (Schedule S)
  grossSalary: 1250000, perquisites: 0, exemptAllow: 0,
  // House Property (Schedule HP)
  hpAnnualValue: 0, hpHomeLoanInterest: 0,
  // Other Sources (Schedule OS)
  savingsInterest: 3200, fdInterest: 7400, dividend: 850,
  // Capital Gains (Schedule CG / SI)
  stcg111A: 14000, stcgOther: 0, ltcg112A: 0,
  // Deductions (Schedule VI-A) - new regime ignores 80C/80D, keeps 80CCD(2)
  ded80C: 0, ded80D: 0, ded80CCD2: 0,
  // Exempt income (Schedule EI)
  exemptIncome: 0,
  // Foreign assets (Schedule FA)
  faCountry: "United States", faInstitution: "Sample Custodial LLC",
  faAccount: "SMP000000", faPeak: 0, faClosing: 0,
  // Taxes paid (Tax Paid schedule)
  tdsSalary: 9000, tdsOther: 0, advanceTax: 0, selfAssessment: 0,
};

const NEW_SLABS = [[0,400000,0],[400000,800000,0.05],[800000,1200000,0.10],[1200000,1600000,0.15],[1600000,2000000,0.20],[2000000,2400000,0.25],[2400000,Infinity,0.30]];
// Tax on normal-rate income, applying 87A rebate + marginal relief (new regime, 12L threshold).
function slabTax(ti) {
  let base = 0;
  for (const [lo, hi, rate] of NEW_SLABS) if (ti > lo) base += (Math.min(ti, hi) - lo) * rate;
  let rebate = 0, marginal = 0;
  if (ti <= 1200000) { rebate = base; base = 0; }
  else { const relief = base - (ti - 1200000); if (relief > 0) { marginal = relief; base -= relief; } }
  return { gross: Math.round(base + rebate + marginal), base: Math.round(base), rebate: Math.round(rebate), marginal: Math.round(marginal) };
}
const inr = (n) => "\u20B9" + Math.round(n || 0).toLocaleString("en-IN");
const num = (v) => Number(String(v).replace(/[^0-9.\-]/g, "")) || 0;

// Full return computation. Everything the summary & verification screens show.
function computeReturn(d) {
  const salary = Math.max(0, num(d.grossSalary) + num(d.perquisites) - num(d.exemptAllow) - 75000);
  const av = num(d.hpAnnualValue), hli = num(d.hpHomeLoanInterest);
  const hp = av > 0 ? Math.round(av - av * 0.30 - hli) : -Math.min(hli, 200000); // self-occupied loss capped 2L
  const os = num(d.savingsInterest) + num(d.fdInterest) + num(d.dividend);
  const stcgOther = num(d.stcgOther), stcg111A = num(d.stcg111A), ltcg112A = num(d.ltcg112A);
  const normal = Math.max(0, salary + hp + os + stcgOther);
  const ltcgTaxable = Math.max(0, ltcg112A - 125000);
  const tax111A = Math.round(stcg111A * 0.20);
  const tax112A = Math.round(ltcgTaxable * 0.125);
  const st = slabTax(normal);
  const beforeCess = st.base + tax111A + tax112A;
  const cess = Math.round(beforeCess * 0.04);
  const total = beforeCess + cess;
  const paid = num(d.tdsSalary) + num(d.tdsOther) + num(d.advanceTax) + num(d.selfAssessment);
  const balance = total - paid;
  const gti = salary + hp + os + stcgOther + stcg111A + ltcg112A;
  return { salary, hp, os, stcgOther, stcg111A, ltcg112A, normal, ltcgTaxable, tax111A, tax112A,
    slabBase: st.base, slabGross: st.gross, rebate: st.rebate, beforeCess, cess, total, paid, balance, gti };
}

// Schedule catalogue for the Select Schedule screen, by category.
const SCHEDULES = {
  General: [
    { code: "Part A-Gen", name: "Part A - General Personal Information", mand: true, desc: "Details of personal information and filing status" },
    { code: "Sch 5A", name: "Schedule 5A", desc: "Apportionment of income between spouses governed by Portuguese Civil Code" },
  ],
  Income: [
    { code: "S", name: "Schedule Salary", mand: true, desc: "Details of Income from Salary" },
    { code: "HP", name: "Schedule House Property", mand: true, desc: "Details of Income from House Property" },
    { code: "CG", name: "Schedule Capital Gains", desc: "Details of capital asset transferred" },
    { code: "112A", name: "Schedule 112A", desc: "From sale of equity share/unit on which STT is paid under section 112A" },
    { code: "OS", name: "Schedule Other Sources", mand: true, desc: "Income from other sources" },
    { code: "SI", name: "Schedule SI", mand: true, desc: "Income chargeable to tax at special rates" },
    { code: "EI", name: "Schedule EI", desc: "Details of Exempt Income (not included in total income)" },
    { code: "FSI", name: "Schedule FSI", desc: "Details of Income from outside India and tax relief" },
  ],
  Deduction: [
    { code: "VI-A", name: "Schedule VI-A", mand: true, desc: "Deductions under Chapter VI-A" },
    { code: "80G", name: "Schedule 80G", desc: "Details of donations entitled for deduction under section 80G" },
    { code: "80D", name: "Schedule 80D", desc: "Deduction under section 80D" },
    { code: "80C", name: "Schedule 80C", desc: "Life insurance premia, PF, etc. under section 80C" },
  ],
  Tax: [
    { code: "Part B-TI", name: "Part B - TI", mand: true, desc: "Computation of total income" },
    { code: "Part B-TTI", name: "Part B - TTI", mand: true, desc: "Computation of tax liability on total income" },
    { code: "TP", name: "Tax Paid", mand: true, desc: "Details of TDS, TCS, self-assessment and advance tax" },
    { code: "ESOP", name: "Tax deferred on ESOP", mand: true, desc: "Tax deferred relatable to perquisites u/s 17(2)(vi)" },
  ],
  Others: [
    { code: "CYLA", name: "Schedule CYLA", mand: true, desc: "Details of Income after set-off of current year losses" },
    { code: "BFLA", name: "Schedule BFLA", mand: true, desc: "Income after set-off of brought forward losses" },
    { code: "CFL", name: "Schedule CFL", mand: true, desc: "Details of losses to be carried forward to future years" },
    { code: "AMTC", name: "Schedule AMTC", mand: true, desc: "Computation of tax credit under section 115JC" },
    { code: "FA", name: "Schedule FA", desc: "Details of Foreign Assets and income from outside India" },
    { code: "AL", name: "Schedule AL", desc: "Assets and Liabilities (total income above Rs 1 Crore)" },
  ],
};
const CAT_ORDER = ["General", "Income", "Deduction", "Tax", "Others"];
const ALL = {}; CAT_ORDER.forEach((c) => SCHEDULES[c].forEach((x) => (ALL[x.code] = x)));

// Editable field definitions per schedule. Codes not listed here open a computed / info panel.
const FIELD_DEFS = {
  "S": { fields: [
    { k: "grossSalary", l: "Gross salary u/s 17(1)", note: "From Form 16 Part B - salary as per section 17(1)." },
    { k: "perquisites", l: "Value of perquisites u/s 17(2)", note: "From Form 12BA. Usually 0 if no car / ESOP / housing." },
    { k: "exemptAllow", l: "Exempt allowances u/s 10", note: "HRA, LTA etc. Under the new regime most of these are nil." },
  ], ro: [["Standard deduction u/s 16(ia)", 75000]] },
  "HP": { fields: [
    { k: "hpAnnualValue", l: "Annual value (rent received)", note: "Enter 0 for a self-occupied house." },
    { k: "hpHomeLoanInterest", l: "Interest on housing loan", note: "For a self-occupied home, the loss is capped at 2,00,000." },
  ] },
  "OS": { fields: [
    { k: "savingsInterest", l: "Interest from savings bank", note: "Add up SFT-016(SB) entries in your AIS." },
    { k: "fdInterest", l: "Interest from fixed/term deposits", note: "From SFT-016(TD) in your AIS." },
    { k: "dividend", l: "Dividend income", note: "Total dividends credited during the year." },
  ] },
  "CG": { fields: [
    { k: "stcg111A", l: "STCG u/s 111A (equity, STT paid)", note: "Taxed at a flat 20%." },
    { k: "stcgOther", l: "STCG - other (non-111A)", note: "Debt/gold funds etc. Taxed at your slab rate." },
    { k: "ltcg112A", l: "LTCG u/s 112A (equity, STT paid)", note: "First 1,25,000 is exempt; the rest is taxed at 12.5%." },
  ] },
  "112A": { fields: [
    { k: "ltcg112A", l: "LTCG u/s 112A (equity, STT paid)", note: "First 1,25,000 exempt each year; balance at 12.5%." },
  ] },
  "VI-A": { fields: [
    { k: "ded80CCD2", l: "80CCD(2) - employer NPS", note: "The only Chapter VI-A deduction allowed under the new regime." },
    { k: "ded80C", l: "80C - PF, ELSS, LIC (old regime)", note: "Ignored under the new regime - shown for comparison only." },
    { k: "ded80D", l: "80D - health insurance (old regime)", note: "Ignored under the new regime - shown for comparison only." },
  ] },
  "TP": { fields: [
    { k: "tdsSalary", l: "TDS on salary", note: "From Form 16 / 26AS. Deducted by your employer." },
    { k: "tdsOther", l: "TDS on other income", note: "TDS on interest, dividend etc." },
    { k: "advanceTax", l: "Advance tax paid", note: "Any advance tax challans during the year." },
    { k: "selfAssessment", l: "Self-assessment tax paid", note: "Pay any balance here via Challan 280, then enter it to zero the balance." },
  ] },
  "EI": { fields: [
    { k: "exemptIncome", l: "Total exempt income", note: "PPF interest, agricultural income up to limits etc." },
  ] },
  "FA": { fields: [
    { k: "faCountry", l: "Country / region", t: "text" },
    { k: "faInstitution", l: "Financial institution", t: "text" },
    { k: "faAccount", l: "Account number", t: "text" },
    { k: "faPeak", l: "Peak balance during year (INR)" },
    { k: "faClosing", l: "Closing balance (INR)" },
  ] },
};

export default function PracticePortal({ onExit }) {
  const [view, setView] = useState("login1");
  const [coach, setCoach] = useState(true);
  const [data, setData] = useState(SAMPLE);
  const [ay, setAy] = useState("2026-27");
  const [mode, setMode] = useState("online");
  const [status, setStatus] = useState("Individual");
  const [form, setForm] = useState("ITR2");
  // Schedule selection lifted to app level so Return Summary + "Add More" share it.
  const [sel, setSel] = useState(() => {
    const s = {};
    CAT_ORDER.forEach((c) => SCHEDULES[c].forEach((x) => { if (x.mand) s[x.code] = true; }));
    ["S", "HP", "OS", "SI", "CG"].forEach((c) => (s[c] = true));
    return s;
  });
  const [conf, setConf] = useState({});           // confirmed schedules
  const [edit, setEdit] = useState(null);          // schedule code being edited

  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));
  const go = (v) => { setView(v); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const authed = !["login1", "login2"].includes(view);
  const R = computeReturn(data);

  const shared = { coach, data, set, ay, setAy, mode, setMode, status, setStatus, form, setForm, go, sel, setSel, conf, setConf, setEdit, R };

  return (
    <div className="sandbox-viewport" style={{ background: authed ? BG : "#fbfcfe" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0}
        button{font-family:inherit}
        a{color:${LINK};text-decoration:none}
        .link{color:${LINK};cursor:pointer;background:none;border:none;font:inherit;padding:0}
        .link:hover{text-decoration:underline}
        .req::after{content:" *";color:${RED}}
        .btn{font-weight:700;font-size:15px;border-radius:6px;padding:12px 26px;cursor:pointer;border:1.5px solid transparent;transition:background .15s,box-shadow .15s;display:inline-flex;align-items:center;gap:8px}
        .btn:focus-visible,.fld:focus-visible,.link:focus-visible,.opt:focus-visible,.navlink:focus-visible,.schedrow:focus-visible,.chk:focus-visible{outline:3px solid ${AMBER};outline-offset:2px}
        .btn-p{background:${NAVY};color:#fff}.btn-p:hover{background:${NAVY_D}}
        .btn-p:disabled{background:#c3cbe0;cursor:not-allowed}
        .btn-o{background:#fff;color:${NAVY};border-color:${NAVY}}.btn-o:hover{background:${TINT}}
        .card{background:${CARD};border:1px solid ${LINE};border-radius:8px}
        .fld{width:100%;border:1px solid #b9c1cf;border-radius:6px;padding:12px 14px;font-size:15px;color:${INK};font-family:inherit;background:#fff}
        .fld:focus{border-color:${NAVY};box-shadow:0 0 0 3px rgba(43,58,143,0.12)}
        .fld[readonly]{background:#eef1f6;color:${MUTE}}
        .lbl{display:block;font-size:14px;color:${INK};margin-bottom:7px}
        .coach{background:#fff8e6;border:1px solid #f0d98b;border-left:4px solid ${AMBER};border-radius:8px;padding:13px 15px;display:flex;gap:11px;margin-bottom:20px;animation:cf .3s ease}
        @keyframes cf{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
        .coach .ic{flex:none;width:22px;height:22px;border-radius:50%;background:${AMBER};color:#fff;display:grid;place-items:center;font-size:13px;font-weight:700}
        .navlink{color:#fff;font-size:15px;font-weight:600;background:none;border:none;cursor:pointer;padding:20px 4px;position:relative;display:inline-flex;align-items:center;gap:5px}
        .navlink.on::after{content:"";position:absolute;bottom:12px;left:0;right:0;height:3px;background:#fff;border-radius:2px}
        .crumb{font-size:14px;color:${MUTE}}
        .crumb b{color:${INK};font-weight:600}
        .crumb a{color:${LINK}}
        .opt{display:flex;align-items:center;gap:12px;border:1.5px solid ${LINE};border-radius:8px;padding:18px 22px;cursor:pointer;background:#fff;font-size:16px;transition:border-color .15s}
        .opt.on{border-color:${NAVY};box-shadow:0 0 0 1px ${NAVY}}
        .radio{width:20px;height:20px;border-radius:50%;border:2px solid #b9c1cf;flex:none;display:grid;place-items:center}
        .radio.on{border-color:${NAVY}}.radio.on::after{content:"";width:10px;height:10px;border-radius:50%;background:${NAVY}}
        .sandbox{position:fixed;bottom:14px;right:14px;z-index:60;background:${RED};color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;padding:7px 13px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.25);pointer-events:none}
        .watermark{position:fixed;inset:0;pointer-events:none;z-index:0;display:grid;place-items:center;overflow:hidden}
        .watermark span{font-weight:800;font-size:min(15vw,200px);color:rgba(43,58,143,0.035);transform:rotate(-24deg);white-space:nowrap}
        .sesbox{display:inline-flex;gap:3px;margin-left:6px}
        .sesbox b{background:#1c2870;color:#fff;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:14px}
        .catrow{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;cursor:pointer;font-size:15px;color:${INK};background:#fff;width:100%;border:none;border-bottom:1px solid ${LINE};text-align:left}
        .catrow.on{background:${TINT};border-left:3px solid ${NAVY};font-weight:700}
        .catcount{background:${TINT};color:${INK};font-size:13px;font-weight:700;min-width:26px;height:26px;border-radius:6px;display:grid;place-items:center}
        .chk{width:22px;height:22px;border-radius:5px;border:2px solid #b9c1cf;flex:none;display:grid;place-items:center;cursor:pointer;background:#fff}
        .chk.on{background:${NAVY};border-color:${NAVY};color:#fff;font-size:14px;font-weight:700}
        .codebox{width:52px;height:52px;border-radius:6px;background:${BLUE};color:#fff;display:grid;place-items:center;font-size:12px;font-weight:700;flex:none;text-align:center;line-height:1.1;padding:2px}
        .schedrow{display:flex;gap:16px;align-items:flex-start;padding:18px 8px;border-bottom:1px solid ${LINE};background:none;border-left:none;border-right:none;border-top:none;width:100%;text-align:left;cursor:pointer}
        .steptri{display:flex;align-items:flex-start;gap:0}
        .itr-steps{margin:28px 0;max-width:640px;width:100%}
        .itr-step{display:flex;align-items:flex-start;flex:1;min-width:0}
        .itr-step-col{display:flex;flex-direction:column;align-items:center;width:clamp(88px,26vw,130px);flex-shrink:0}
        .itr-step-label{font-size:12.5px;color:${MUTE};text-align:center;margin-top:8px;line-height:1.35}
        .itr-intro-grid>div:first-child{border-bottom:none !important}
        .itr-intro-actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:4px}
        .stepbox{width:44px;height:44px;border:1px solid ${LINE};border-radius:6px;display:grid;place-items:center;font-size:20px;font-weight:700;background:#fff;flex-shrink:0}
        .stepline{flex:1;height:1px;background:${LINE};min-width:24px;margin-top:22px}
        .ovl{position:fixed;inset:0;z-index:80;background:rgba(20,26,40,.5);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto;animation:cf .2s ease}
        .sheet{background:#fff;border-radius:12px;width:100%;max-width:640px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
        .pill{font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px}
        .qcard{background:#fff;border:1.5px solid ${LINE};border-radius:8px;padding:16px 14px;text-align:left;cursor:pointer;transition:border-color .15s,box-shadow .15s}
        .qcard:hover{border-color:${NAVY};box-shadow:0 2px 10px rgba(43,58,143,.08)}
        .qcard:focus-visible{outline:3px solid ${AMBER};outline-offset:2px}
        .efwrap{position:relative}
        .efmenu{position:absolute;top:100%;left:0;background:#fff;border:1px solid ${LINE};border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.18);min-width:260px;z-index:50;overflow:hidden}
        .efitem{display:block;width:100%;text-align:left;padding:13px 18px;font-size:14.5px;color:${INK};background:#fff;border:none;border-bottom:1px solid ${LINE};cursor:pointer}
        .efitem:last-child{border-bottom:none}.efitem:hover{background:${TINT}}
        .page-main{padding:20px clamp(14px,4vw,22px) 90px;width:100%;max-width:1200px;margin:0 auto;min-width:0}
        .portal-table-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
        .portal-table-wrap table{min-width:520px}
        .top-emblem{width:44px;height:44px;flex-shrink:0}
        .top-brand-title{font-size:22px;font-weight:700;color:${NAVY}}
        .top-brand-sub{font-size:11.5px;color:${NAVY}}
        .top-bar-inner{max-width:1200px;margin:0 auto;padding:10px clamp(14px,4vw,22px);display:flex;align-items:center;justify-content:space-between;gap:14px;min-width:0}
        .top-bar-brand{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
        .top-bar-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:flex-end}
        .portal-nav-inner{max-width:1200px;margin:0 auto;padding:0 clamp(14px,4vw,22px);display:flex;align-items:center;gap:20px;overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap}
        .navlink{white-space:nowrap;flex-shrink:0}
        .grid2,.schedwrap,.grid3,.split2{min-width:0}
        .login-h1{font-size:clamp(1.75rem,4.5vw,2.375rem) !important}
        .page-h1{font-size:clamp(1.5rem,4vw,2rem) !important;line-height:1.2}
        .summary-row{flex-wrap:wrap}
        .summary-row .link{margin-left:auto}
        .schedrow>span:last-child{min-width:0;flex:1}
        .footer-inner{max-width:1200px;margin:0 auto;padding:22px clamp(14px,4vw,22px);text-align:center;color:${MUTE};font-size:13px;line-height:1.7}
        .exit-pilot{position:fixed;bottom:14px;left:14px;z-index:70;background:#0D0F14;color:#FFB84D;border:1px solid rgba(255,184,77,0.35);border-radius:999px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:0.04em;box-shadow:0 4px 16px rgba(0,0,0,0.2)}
        .navbtns{display:flex;justify-content:space-between;margin-top:30px;flex-wrap:wrap;gap:12px}
        .sandbox-viewport{width:100%;min-height:100vh;overflow-x:clip;color:${INK};font-family:'Open Sans',system-ui,sans-serif}
        @media(max-width:1024px){
          .grid2,.schedwrap,.grid3,.split2{grid-template-columns:1fr !important}
          .grid2>div:first-child{border-right:none !important;border-bottom:1px solid ${LINE}}
          .split2 .vdiv{display:none !important}
          .hide-md{display:none !important}
          .top-brand-title{font-size:17px !important}
          .top-brand-sub{font-size:10px !important}
          .top-emblem{width:36px !important;height:36px !important;font-size:8px !important}
          .navlink{padding:14px 0;font-size:14px}
          .page-main{padding-bottom:72px}
          .summary-row .link{width:100%;margin-left:0;margin-top:8px;text-align:left}
          .itr-steps{max-width:100%}
          .steptri.itr-steps{flex-direction:column;gap:0}
          .itr-step{flex:none;width:100%;padding:14px 0;border-bottom:1px solid ${LINE};gap:0}
          .itr-step:last-child{border-bottom:none}
          .itr-step-col{flex-direction:row;width:100%;align-items:flex-start;gap:14px}
          .itr-step-label{text-align:left;margin-top:10px;flex:1;font-size:14px}
          .itr-step .stepline{display:none}
        }
        @media(max-width:860px){
          .hide-sm{display:none !important}
          .top-bar-inner{flex-wrap:wrap}
          .top-bar-actions{width:100%;justify-content:flex-start}
          .top-user-meta{display:none !important}
          .itr-intro-actions{flex-direction:column-reverse;margin-top:20px}
          .itr-intro-actions .btn{width:100%;justify-content:center}
          .sandbox{bottom:14px;top:auto;left:auto;right:14px;font-size:9px;padding:6px 12px;max-width:calc(100% - 130px);text-align:center}
          .exit-pilot{bottom:14px;top:auto;left:14px;font-size:11px;padding:7px 12px}
          .ovl{padding:0;align-items:flex-end}
          .sheet{border-radius:12px 12px 0 0;max-height:92vh;overflow:auto}
          .schedrow{padding:14px 4px;gap:12px}
          .codebox{width:44px;height:44px;font-size:11px}
          .navbtns{flex-direction:column-reverse}
          .navbtns .btn{width:100%;justify-content:center}
          .page-main{padding-bottom:72px}
        }
        @media(max-width:480px){
          .opt{padding:14px 16px;font-size:15px}
          .qcard{padding:14px 12px}
          .fld{font-size:16px}
          .btn{font-size:14px;padding:11px 20px}
        }
        @media(prefers-reduced-motion:reduce){.coach,.ovl{animation:none}}
      `}</style>

      <div className="watermark"><span>PRACTICE</span></div>
      <div className="sandbox">SANDBOX · NOT THE REAL PORTAL</div>
      {onExit && (
        <button type="button" className="exit-pilot" onClick={onExit}>
          {"\u2190"} TaxPilot
        </button>
      )}

      <TopBar authed={authed} data={data} coach={coach} setCoach={setCoach} view={view} go={go} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {view === "login1" && <Login1 {...shared} />}
        {view === "login2" && <Login2 {...shared} />}
        {view === "dashboard" && <Dashboard {...shared} />}
        {view === "itr_year" && <ItrYear {...shared} />}
        {view === "itr_status" && <ItrStatus {...shared} />}
        {view === "itr_form" && <ItrForm {...shared} />}
        {view === "itr_intro" && <ItrIntro {...shared} />}
        {view === "itr_reasons" && <ItrReasons {...shared} />}
        {view === "itr_schedule" && <SelectSchedule {...shared} />}
        {view === "itr_summary" && <ReturnSummary {...shared} />}
        {view === "itr_verify" && <Verify {...shared} />}
        {view === "itr_done" && <Done {...shared} />}
        {view === "form26as" && <Form26AS {...shared} />}
        {view === "ais" && <AIS {...shared} />}
        {view === "epay" && <EpayTax {...shared} />}
      </div>

      {edit && <SchedEditor code={edit} data={data} set={set} coach={coach} R={R}
        onClose={() => setEdit(null)}
        onConfirm={() => { setConf((c) => ({ ...c, [edit]: true })); setEdit(null); }} />}

      <Footer authed={authed} />
    </div>
  );
}

function TopBar({ authed, data, coach, setCoach, view, go }) {
  const inWizard = view.startsWith("itr_");
  return (
    <>
      <div style={{ background: "#fff", borderBottom: `1px solid ${LINE}` }}>
        <div className="top-bar-inner">
          <button className="link top-bar-brand" onClick={() => go(authed ? "dashboard" : "login1")}>
            <span className="top-emblem" style={{ borderRadius: "50%", border: `2px solid ${RED}`, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: RED, textAlign: "center", lineHeight: 1 }}>ITD</span>
            <span style={{ textAlign: "left", minWidth: 0 }}>
              <span className="top-brand-title">e-Filing <span style={{ color: RED, fontStyle: "italic", fontSize: 13 }}>Anywhere Anytime</span></span>
              <span className="top-brand-sub" style={{ display: "block", borderTop: `1px solid ${GREEN}`, paddingTop: 2 }}>Income Tax Department, Government of India</span>
            </span>
          </button>
          <div className="top-bar-actions">
            <span className="hide-md">{"\u260E"} Call Us {"\u25BE"}</span>
            <span className="hide-md">{"\uD83C\uDF10"} English {"\u25BE"}</span>
            <span className="hide-md" style={{ color: FAINT }}>A- A A+</span>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", background: TINT, border: `1px solid ${LINE}`, padding: "6px 12px", borderRadius: 999, color: NAVY, fontWeight: 600 }}>
              <input type="checkbox" checked={coach} onChange={(e) => setCoach(e.target.checked)} style={{ accentColor: NAVY, width: 15, height: 15 }} /> Guidance
            </label>
            {authed ? (
              <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span style={{ width: 34, height: 34, borderRadius: 4, background: "#dde3ee", display: "grid", placeItems: "center", color: MUTE, fontSize: 16, flexShrink: 0 }}>{"\uD83D\uDC64"}</span>
                <span className="top-user-meta" style={{ textAlign: "left", lineHeight: 1.1, minWidth: 0 }}><b style={{ fontSize: 14 }}>{data.name} {"\u25BE"}</b><span style={{ display: "block", fontSize: 12, color: MUTE }}>Individual</span></span>
              </span>
            ) : (
              <span style={{ fontSize: 14 }}>Do not have an account? <span style={{ color: LINK, fontWeight: 700 }}>Register</span></span>
            )}
          </div>
        </div>
      </div>

      {authed && (
        <nav style={{ background: NAVY, position: "sticky", top: 0, zIndex: 40 }}>
          <div className="portal-nav-inner">
            <button className={"navlink" + (view === "dashboard" ? " on" : "")} onClick={() => go("dashboard")}>Dashboard</button>
            <EfileMenu view={view} inWizard={inWizard} go={go} />
            <button className="navlink hide-sm">Authorised Partners {"\u25BE"}</button>
            <button className="navlink hide-sm">Services {"\u25BE"}</button>
            <button className={"navlink" + (view === "ais" ? " on" : "")} onClick={() => go("ais")}>AIS</button>
            <button className="navlink hide-sm">Pending Actions {"\u25BE"}</button>
            <button className="navlink hide-sm">Grievances {"\u25BE"}</button>
            <button className="navlink hide-sm">Help</button>
            <span className="hide-md" style={{ marginLeft: "auto", color: "#fff", fontSize: 13, display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
              Session Time <span className="sesbox"><b>1</b><b>4</b>:<b>5</b><b>9</b></span>
            </span>
          </div>
        </nav>
      )}
    </>
  );
}

function Coach({ show, title, children }) {
  if (!show) return null;
  return (
    <div className="coach" role="note">
      <span className="ic">i</span>
      <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#6b5710" }}>
        <strong style={{ display: "block", color: "#5a4700", marginBottom: 2 }}>{title}</strong>{children}
      </div>
    </div>
  );
}

function Crumbs({ items }) {
  return (
    <div className="crumb" style={{ marginBottom: 22, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          {i > 0 && <span style={{ color: FAINT }}>{"\u203A"}</span>}
          {i === items.length - 1 ? <b>{it}</b> : <a>{it}</a>}
        </span>
      ))}
    </div>
  );
}

function Mandatory() {
  return <div style={{ textAlign: "right", color: MUTE, fontSize: 14, marginBottom: 8 }}><span style={{ color: RED }}>*</span> Indicates mandatory fields</div>;
}

// ── Login step 1 ─────────────────────────────────────────────
function Login1({ data, go, coach }) {
  const [uid, setUid] = useState("");
  return (
    <main className="page-main">
      <Mandatory />
      <div className="card grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "clamp(28px,4vw,52px)", borderRight: `1px solid ${LINE}` }}>
          <h1 className="login-h1" style={{ fontWeight: 700, color: "#4a4a4a", marginBottom: 30 }}>Login</h1>
          <Coach show={coach} title="Practice login">No real credentials needed. The User ID is pre-filled with the practice PAN, <strong>{data.pan}</strong>. Just click Continue.</Coach>
          <label className="lbl req">Enter your User ID</label>
          <input className="fld" value={uid} onChange={(e) => setUid(e.target.value)} placeholder="PAN/ AADHAAR/ OTHER USER ID" />
          <button className="btn btn-p" style={{ width: "100%", justifyContent: "center", marginTop: 24, background: uid ? NAVY : "#d3d8e4", color: uid ? "#fff" : "#8a91a3" }} onClick={() => go("login2")}>Continue {"\u203A"}</button>
          <p style={{ marginTop: 30, fontSize: 15 }}>Other ways to access your account</p>
          <p style={{ marginTop: 12, color: MUTE, display: "flex", alignItems: "center", gap: 10 }}>{"\uD83C\uDFDB"} Net Banking</p>
          <p style={{ marginTop: 20, fontSize: 13, color: FAINT }}>Tip: type anything, or leave it blank, then Continue.</p>
        </div>
        <div className="hide-sm" style={{ padding: "clamp(28px,4vw,52px)" }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: "#4a4a4a", marginBottom: 24 }}>Know about your <span style={{ color: NAVY }}>User ID</span></h2>
          {[["PAN (Permanent Account Number)", "For individuals and non-individuals (Company, Trust, AOP, Firm, HUF, LLP)."], ["Aadhaar Number", "For individuals only."], ["Other than PAN users", "CA, ERI, Tax Deductor, TIN 2.0 stakeholders, and non-residents without PAN."]].map(([t, d]) => (
            <div key={t} style={{ padding: "16px 0", borderBottom: `1px solid ${LINE}` }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{t}</div>
              <p style={{ color: MUTE, fontSize: 14, marginTop: 5, lineHeight: 1.5 }}>{d}</p>
            </div>
          ))}
          <button className="link" style={{ marginTop: 16, fontWeight: 700 }}>Show More</button>
        </div>
      </div>
    </main>
  );
}

// ── Login step 2 ─────────────────────────────────────────────
function Login2({ data, go, coach }) {
  const [ok, setOk] = useState(false);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const ready = ok && pw.length > 0;
  return (
    <main className="page-main">
      <Mandatory />
      <div className="card grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "clamp(28px,4vw,52px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ width: 78, height: 78, borderRadius: 6, background: "#dde3ee", display: "grid", placeItems: "center", color: MUTE, fontSize: 34, flexShrink: 0 }}>{"\uD83D\uDC64"}</span>
            <div><h1 className="login-h1" style={{ fontWeight: 700, color: "#4a4a4a" }}>Login</h1><div style={{ marginTop: 6, fontSize: 15 }}>PAN : <b>{data.pan}</b></div></div>
          </div>
          <Coach show={coach} title="Secure Access Message">The real portal shows a personal phrase you set, so you know the page is genuine. Tick the box, type any password, and Continue. Nothing is checked here.</Coach>
          <p style={{ fontSize: 15, margin: "18px 0 8px" }}>Secure Access Message</p>
          <div style={{ background: TINT, border: `1px solid ${LINE}`, borderRadius: 6, padding: "16px 18px", fontWeight: 700 }}>Practice Login</div>
          <label style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 16, cursor: "pointer" }}>
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ accentColor: NAVY, width: 20, height: 20, marginTop: 1 }} />
            <span className="req" style={{ fontSize: 15, lineHeight: 1.4 }}>Please confirm your secure access message displayed above</span>
          </label>
          <p style={{ fontSize: 15, margin: "22px 0 8px" }}>Enter password for your e-Filing account</p>
          <label className="lbl req">Password</label>
          <div style={{ position: "relative" }}>
            <input className="fld" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} style={{ paddingRight: 44 }} />
            <button className="link" onClick={() => setShow((s) => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: MUTE }}>{show ? "\uD83D\uDE48" : "\uD83D\uDC41"}</button>
          </div>
          <button className="link" style={{ marginTop: 12, fontWeight: 700 }}>Forgot Password?</button>
          <button className="btn btn-p" style={{ width: "100%", justifyContent: "center", marginTop: 22, background: ready ? NAVY : "#d3d8e4", color: ready ? "#fff" : "#8a91a3" }} disabled={!ready} onClick={() => go("dashboard")}>Continue {"\u203A"}</button>
          <button className="btn btn-o" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={() => go("login1")}>{"\u2039"} Back</button>
        </div>
        <div className="hide-sm" style={{ display: "grid", placeItems: "center", background: "#fafbfe" }}>
          <div style={{ width: 150, height: 170, borderRadius: 18, background: NAVY, display: "grid", placeItems: "center", color: "#fff", fontSize: 60 }}>{"\uD83D\uDD13"}</div>
        </div>
      </div>
    </main>
  );
}

// ── Dashboard ────────────────────────────────────────────────
function Dashboard({ data, go, coach }) {
  return (
    <main className="page-main">
      <Crumbs items={["Dashboard"]} />
      <Coach show={coach} title="You are on the dashboard">This mirrors the real e-Filing home. To file a return, open <strong>e-File</strong> in the blue bar, or use the shortcut button below.</Coach>
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 22, alignItems: "start" }} className="grid2">
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Welcome Back, {data.first}</h2>
          <div style={{ fontSize: 15, lineHeight: 2 }}>
            <div style={{ fontWeight: 700 }}>{data.pan}</div>
            <div>{data.aadhaar}</div>
            <div>{data.mobile}</div>
            <div>{data.email}</div>
          </div>
          <div style={{ marginTop: 18, borderTop: `1px solid ${LINE}`, paddingTop: 16, fontSize: 15 }}>
            {[["Contact Details", "Update"], ["Bank Account", "Update"]].map(([a, b]) => (
              <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: MUTE }}>{a}</span><span className="link" style={{ fontWeight: 600 }}>{b}</span></div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 22 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>File your Income Tax Return</h3>
            <p style={{ color: MUTE, fontSize: 14.5, lineHeight: 1.6, marginBottom: 18 }}>Start a fresh ITR for AY 2026-27. Pick your status, form and schedules, edit the pre-filled data, and watch the tax recompute, exactly like the live portal.</p>
            <button className="btn btn-p" onClick={() => go("itr_year")}>File Income Tax Return {"\u203A"}</button>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><h3 style={{ fontSize: 18, fontWeight: 700 }}>View ITR Status</h3><span style={{ color: FAINT }}>{"\u25BE"}</span></div>
            <div style={{ background: "#eaf7ee", border: "1px solid #bfe3c9", borderRadius: 8, padding: 16, color: GREEN, fontWeight: 700 }}>No return filed yet in this practice session.</div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Your tax records</h3>
            <p style={{ color: MUTE, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>Cross-check what the department already has on file before you file. These are pre-filled from the same sandbox data.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }} className="grid3">
              {[["View Form 26AS", "form26as", "\uD83D\uDCC4", "TDS, taxes paid & refunds"],
                ["View AIS", "ais", "\uD83D\uDCCA", "Annual Information Statement"],
                ["e-Pay Tax", "epay", "\uD83D\uDCB3", "Pay & track challans"]].map(([t, v, ic, d]) => (
                <button key={v} className="qcard" onClick={() => go(v)}>
                  <span style={{ fontSize: 24 }}>{ic}</span>
                  <span style={{ fontWeight: 700, fontSize: 14.5, color: NAVY, display: "block", marginTop: 8 }}>{t}</span>
                  <span style={{ fontSize: 12.5, color: MUTE, display: "block", marginTop: 3, lineHeight: 1.4 }}>{d}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Page({ children, maxWidth }) {
  const style = maxWidth ? { maxWidth } : undefined;
  return <main className="page-main" style={style}>{children}</main>;
}
function NavBtns({ onBack, onNext, nextLabel = "Continue", disabled }) {
  return (
    <div className="navbtns">
      <button className="btn btn-o" onClick={onBack}>{"\u2039"} Back</button>
      <button className="btn btn-p" onClick={onNext} disabled={disabled}>{nextLabel} {"\u203A"}</button>
    </div>
  );
}

// ── ITR wizard: year + mode ──────────────────────────────────
function ItrYear({ ay, setAy, mode, setMode, go, coach }) {
  return (
    <Page>
      <Crumbs items={["Dashboard", "e-file", "Income Tax Return", "File Income Tax Return"]} />
      <h1 className="page-h1" style={{ fontWeight: 700, marginBottom: 6 }}>Income Tax Return (ITR)</h1>
      <Mandatory />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 22, alignItems: "start" }} className="grid2">
        <div className="card" style={{ padding: 30 }}>
          <Coach show={coach} title="Pick the year and mode">Choose <strong>AY 2026-27</strong> (for income earned in FY 2025-26). Keep <strong>Online</strong> mode, it is the guided flow.</Coach>
          <label className="lbl req">Select Assessment year</label>
          <select className="fld" value={ay} onChange={(e) => setAy(e.target.value)} style={{ maxWidth: 420 }}>
            <option value="2026-27">2026-27 (Current A.Y.)</option>
            <option value="2025-26">2025-26</option>
          </select>
          <label className="lbl req" style={{ marginTop: 26 }}>Select Mode of Filing</label>
          <div style={{ display: "flex", gap: 30, marginTop: 4 }}>
            {[["online", "Online (Recommended)"], ["offline", "Offline"]].map(([k, l]) => (
              <label key={k} style={{ display: "flex", gap: 9, alignItems: "center", cursor: "pointer" }}>
                <span className={"radio" + (mode === k ? " on" : "")} onClick={() => setMode(k)} />
                <span onClick={() => setMode(k)}>{l}</span>
              </label>
            ))}
          </div>
          <div style={{ background: TINT, borderRadius: 6, padding: "14px 16px", marginTop: 22, fontSize: 14.5 }}><b>Note:</b> You can select the type of ITR applicable later.</div>
        </div>
        <div style={{ background: TINT, border: `1px solid ${LINE}`, borderRadius: 8, padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>Information</div>
          <p style={{ color: MUTE, fontSize: 14, lineHeight: 1.6 }}>Online mode fills your data for you; offline mode uploads a JSON prepared with the utility.</p>
        </div>
      </div>
      <NavBtns onBack={() => go("dashboard")} onNext={() => go("itr_status")} />
    </Page>
  );
}

// ── Select status ────────────────────────────────────────────
function ItrStatus({ status, setStatus, go, coach }) {
  return (
    <Page>
      <Crumbs items={["Dashboard", "e-file", "Income Tax Return", "Select Status"]} />
      <h1 className="page-h1" style={{ fontWeight: 700, lineHeight: 1.2, maxWidth: 760 }}>Please select the status applicable to you to proceed further</h1>
      <p style={{ color: MUTE, fontSize: 15, marginTop: 14, lineHeight: 1.6 }}>Based on last year's data we have pre-selected a status. You may change it if it is not correct.</p>
      <Coach show={coach} title="Choose your status">Most salaried taxpayers are an <strong>Individual</strong>. Keep Individual and Proceed.</Coach>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18, marginTop: 26, maxWidth: 900 }}>
        {["Individual", "HUF", "Others"].map((s) => (
          <button key={s} className={"opt" + (status === s ? " on" : "")} onClick={() => setStatus(s)}>
            <span className={"radio" + (status === s ? " on" : "")} /> {s}
          </button>
        ))}
      </div>
      <NavBtns onBack={() => go("itr_year")} onNext={() => go("itr_form")} nextLabel="Proceed" />
    </Page>
  );
}

// ── Select ITR form ──────────────────────────────────────────
function ItrForm({ form, setForm, go, coach }) {
  return (
    <Page>
      <Crumbs items={["Dashboard", "e-file", "Income Tax Return", "Select Status", "Select ITR Form"]} />
      <div style={{ color: MUTE, fontSize: 16 }}>Income Tax Returns</div>
      <h1 className="page-h1" style={{ fontWeight: 700, margin: "6px 0 26px" }}>You need to choose an ITR Form to proceed</h1>
      <Coach show={coach} title="Which form?">Salaried with simple income? Choose <strong>ITR-1</strong>. Have capital gains or foreign assets? Pick <strong>ITR-2</strong>. Select a form and Proceed.</Coach>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 30, maxWidth: 960 }} className="grid2 split2">
        <div>
          <p style={{ fontSize: 16, marginBottom: 18 }}>Help me decide which ITR Form to file</p>
          <button className="btn btn-p" onClick={() => go("itr_form")}>Proceed {"\u203A"}</button>
        </div>
        <div style={{ background: LINE }} className="hide-sm vdiv" />
        <div>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>I know which ITR Form I need to file</p>
          <select className="fld" value={form} onChange={(e) => setForm(e.target.value)}>
            <option value="ITR1">ITR - 1</option>
            <option value="ITR2">ITR - 2</option>
            <option value="ITR3">ITR - 3</option>
            <option value="ITR4">ITR - 4</option>
          </select>
        </div>
      </div>
      <NavBtns onBack={() => go("itr_status")} onNext={() => go("itr_intro")} nextLabel="Proceed" />
    </Page>
  );
}

const FORM_META = {
  ITR1: { title: "ITR 1 - (Sahaj)", sub: "For resident individuals having income from salary, one house property and other sources (total income up to Rs 50 lakh)." },
  ITR2: { title: "ITR 2 - (Income Tax Return 2)", sub: "For Individuals and HUFs not having income from profits and gains of business or profession." },
  ITR3: { title: "ITR 3 - (Income Tax Return 3)", sub: "For individuals and HUFs having income from profits and gains of business or profession." },
  ITR4: { title: "ITR 4 - (Sugam)", sub: "For resident individuals, HUFs and firms with presumptive income (total income up to Rs 50 lakh)." },
};

// ── Form intro ───────────────────────────────────────────────
function ItrIntro({ form, go, coach }) {
  const m = FORM_META[form];
  const steps = ["Validate your Returns breakup (Pre-filled)", "Confirm your Return Summary", "Verify & Submit your Return"];
  return (
    <Page>
      <Crumbs items={["Dashboard", "e-file", "Income Tax Return", "Select Status", "Select ITR Form", "ITR"]} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "clamp(20px,4vw,30px)", alignItems: "start" }} className="grid2 itr-intro-grid">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-h1" style={{ fontWeight: 700 }}>{m.title}</h1>
          <p style={{ color: MUTE, fontSize: "clamp(14px,2.5vw,15.5px)", marginTop: 8, lineHeight: 1.6 }}>{m.sub}</p>
          <Coach show={coach} title="Three stages ahead">You will (1) check your pre-filled breakup, (2) confirm the return summary, and (3) verify and submit. Click Let's Get Started.</Coach>
          <div className="steptri itr-steps" role="list" aria-label="Filing steps">
            {steps.map((s, i) => (
              <div key={i} className="itr-step" role="listitem">
                <div className="itr-step-col">
                  <span className="stepbox" aria-hidden="true">{i + 1}</span>
                  <span className="itr-step-label">{s}</span>
                </div>
                {i < 2 && <span className="stepline" aria-hidden="true" />}
              </div>
            ))}
          </div>
          <div className="itr-intro-actions">
            <button className="btn btn-o" onClick={() => go("itr_form")}>{"\u2039"} Back</button>
            <button className="btn btn-p" onClick={() => go("itr_reasons")}>Let's Get Started {"\u203A"}</button>
          </div>
        </div>
        <div className="hide-sm" style={{ display: "grid", placeItems: "center", paddingTop: 8 }}>
          <div style={{ width: "min(200px,100%)", aspectRatio: "10/11", borderRadius: 16, background: TINT, display: "grid", placeItems: "center", fontSize: "clamp(48px,12vw,76px)" }}>{"\uD83D\uDCCB"}</div>
        </div>
      </div>
    </Page>
  );
}

// ── Filing reasons ───────────────────────────────────────────
function ItrReasons({ go, coach }) {
  const [pick, setPick] = useState("above");
  return (
    <Page maxWidth={1100}>
      <Crumbs items={["Dashboard", "e-file", "Income Tax Return", "Select Status", "Select ITR Form", "ITR"]} />
      <h1 className="page-h1" style={{ fontWeight: 700, marginBottom: 22 }}>Please answer the following questions to proceed further</h1>
      <Coach show={coach} title="Why are you filing?">If your income crosses the basic exemption limit (the usual case), keep the <strong>first option</strong>. Then Continue.</Coach>
      <div className="card" style={{ padding: 28 }}>
        <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Are you filing the income tax return for any of the following reasons?</p>
        {[["above", "Taxable income is more than basic exemption limit"], ["proviso", "Filing return due to fulfilling conditions under Seventh Proviso to section 139(1)"], ["others", "Others"]].map(([k, l]) => (
          <label key={k} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", cursor: "pointer" }}>
            <span className={"radio" + (pick === k ? " on" : "")} onClick={() => setPick(k)} style={{ marginTop: 2 }} />
            <span onClick={() => setPick(k)} style={{ fontSize: 15.5, lineHeight: 1.5 }}>{l}</span>
          </label>
        ))}
      </div>
      <NavBtns onBack={() => go("itr_intro")} onNext={() => go("itr_schedule")} />
    </Page>
  );
}

// ── Select Schedule (all toggleable, mandatory pre-selected) ──
function SelectSchedule({ go, coach, sel, setSel }) {
  const [cat, setCat] = useState("General");
  const [q, setQ] = useState("");
  const toggle = (x) => setSel((s) => ({ ...s, [x.code]: !s[x.code] }));
  const count = (c) => SCHEDULES[c].filter((x) => sel[x.code]).length;
  const total = Object.values(sel).filter(Boolean).length;
  const list = SCHEDULES[cat].filter((x) => !q || (x.name + " " + x.desc).toLowerCase().includes(q.toLowerCase()));
  const incomeOK = SCHEDULES.Income.some((x) => sel[x.code]);

  return (
    <Page>
      <Crumbs items={["Dashboard", "e-file", "Income Tax Return", "Select Status", "Select ITR Form", "ITR", "Select Schedule"]} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="page-h1" style={{ fontWeight: 700 }}>Select Schedule</h1>
          <p style={{ color: MUTE, fontSize: 15, marginTop: 6 }}>Select the schedules which are applicable to you <span style={{ color: FAINT }}>(mandatory schedules are pre-selected, but you can change any of them)</span></p>
        </div>
        <input className="fld" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Schedule" style={{ maxWidth: 320 }} />
      </div>
      <p style={{ marginTop: 18, fontSize: 15 }}><b>{total}</b> schedules are selected</p>
      <Coach show={coach} title="What to pick here">Everything is now a toggle - even the pre-selected mandatory ones. They start ticked because they normally apply, but if a schedule isn't yours (say House Property, when you rent), just uncheck it. Add Capital Gains if you sold shares, VI-A for deductions. Move through the category tabs on the left, then Continue.</Coach>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 22, alignItems: "start", marginTop: 12 }} className="schedwrap">
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
          {CAT_ORDER.map((c) => (
            <button key={c} className={"catrow" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>
              <span>{c}</span><span className="catcount">{count(c)}</span>
            </button>
          ))}
        </div>

        <div>
          <div style={{ background: incomeOK ? TINT : "#fff4f4", border: incomeOK ? "none" : `1px solid #f2c4c4`, borderRadius: 8, padding: "14px 18px", fontSize: 14.5, marginBottom: 14, display: "flex", gap: 10, color: incomeOK ? INK : RED }}>
            <span style={{ color: incomeOK ? NAVY : RED }}>{"\u2139"}</span> Note: Please select at least one schedule from the Income category to proceed further.
          </div>
          <div className="card" style={{ padding: "6px 22px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: `1px solid ${LINE}` }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{cat}</span>
              <span style={{ fontSize: 13.5, color: MUTE }}>Learn More <span className="link">Show</span> {"|"} <span className="link">Hide</span></span>
            </div>
            {list.map((x) => {
              const on = !!sel[x.code];
              return (
                <button key={x.code} className="schedrow" onClick={() => toggle(x)} aria-pressed={on}>
                  <span className={"chk" + (on ? " on" : "")}>{on ? "\u2713" : ""}</span>
                  <span className="codebox">{x.code}</span>
                  <span>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{x.name}{x.mand && <span style={{ fontWeight: 400, color: MUTE }}> (Mandatory)</span>}</span>
                    <p style={{ color: MUTE, fontSize: 14, lineHeight: 1.5, marginTop: 3 }}>{x.desc}</p>
                  </span>
                </button>
              );
            })}
            {list.length === 0 && <p style={{ color: MUTE, fontSize: 14.5, padding: "20px 0" }}>No schedule matches your search.</p>}
          </div>
        </div>
      </div>
      <NavBtns onBack={() => go("itr_reasons")} onNext={() => go("itr_summary")} disabled={!incomeOK} />
    </Page>
  );
}

// ── Return Summary (rows derived from selection; each opens editor) ──
function ReturnSummary({ go, coach, sel, conf, setEdit, R }) {
  const rows = [];
  CAT_ORDER.forEach((c) => SCHEDULES[c].forEach((x) => { if (sel[x.code]) rows.push(x); }));
  const confirmedCount = rows.filter((x) => conf[x.code]).length;
  return (
    <Page>
      <Crumbs items={["Dashboard", "e-file", "Income Tax Return", "Select Status", "Select ITR Form", "ITR", "Select Schedule", "Return Summary"]} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <h1 className="page-h1" style={{ fontWeight: 700 }}>Return Summary</h1>
        <span style={{ fontSize: 14.5, color: MUTE }}><b style={{ color: INK }}>{confirmedCount}</b> of {rows.length} confirmed</span>
      </div>
      <Coach show={coach} title="Confirm each schedule">Open each row with <strong>Provide your confirmation</strong>. You will see the pre-filled numbers, edit any of them, and the tax at the end updates live. Confirmed rows turn green. Then Proceed to Verification.</Coach>

      <div style={{ background: TINT, borderRadius: 8, padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, fontSize: 15 }}>
        <span>Gross total income <b>{inr(R.gti)}</b></span>
        <span>Total tax liability <b>{inr(R.total)}</b></span>
        <span>{R.balance > 0 ? "Balance payable" : "Refund due"} <b style={{ color: R.balance > 0 ? RED : GREEN }}>{inr(Math.abs(R.balance))}</b></span>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {rows.map((x, i) => {
          const done = conf[x.code];
          return (
            <div key={x.code} className="summary-row" style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 22px", borderBottom: i < rows.length - 1 ? `1px solid ${LINE}` : "none", background: done ? "#f4fbf6" : "#fff" }}>
              <span className="codebox" style={{ background: done ? GREEN : BLUE }}>{done ? "\u2713" : x.code}</span>
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{x.name}{x.mand && <span style={{ fontWeight: 400, color: MUTE }}> (Mandatory)</span>}</span>
                <p style={{ color: MUTE, fontSize: 14, marginTop: 3 }}>{x.desc}</p>
              </span>
              <button className="link" style={{ fontWeight: 600, whiteSpace: "nowrap" }} onClick={() => setEdit(x.code)}>
                {done ? "Edit " : "Provide your confirmation "}{"\u203A"}
              </button>
            </div>
          );
        })}
        {rows.length === 0 && <p style={{ padding: 22, color: MUTE }}>No schedules selected. Use Add More Schedules below.</p>}
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-o" style={{ fontSize: 14, padding: "10px 18px" }} onClick={() => go("itr_schedule")}>+ Add More Schedules</button>
      </div>
      <NavBtns onBack={() => go("itr_schedule")} onNext={() => go("itr_verify")} nextLabel="Proceed To Verification" />
    </Page>
  );
}

// ── Schedule editor (prefilled + editable + live recompute) ──
function SchedEditor({ code, data, set, onClose, onConfirm, coach, R }) {
  const meta = ALL[code] || { name: code, desc: "" };
  const def = FIELD_DEFS[code];

  const field = (f) => (
    <div key={f.k} style={{ marginBottom: 18 }}>
      <label className="lbl" style={{ fontWeight: 600 }}>{f.l}</label>
      {f.t === "text" ? (
        <input className="fld" value={data[f.k]} onChange={(e) => set(f.k, e.target.value)} />
      ) : (
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: MUTE }}>{"\u20B9"}</span>
          <input className="fld" type="number" value={data[f.k]} onChange={(e) => set(f.k, e.target.value === "" ? 0 : Number(e.target.value))} style={{ paddingLeft: 28 }} />
        </div>
      )}
      {f.note && <p style={{ color: FAINT, fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>{f.note}</p>}
    </div>
  );

  const infoTable = (rows) => (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
      {rows.map(([a, b, strong], i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < rows.length - 1 ? `1px solid ${LINE}` : "none", background: strong ? TINT : "#fff", fontSize: 15 }}>
          <span style={{ color: strong ? INK : MUTE, fontWeight: strong ? 700 : 400 }}>{a}</span>
          <b style={{ fontWeight: strong ? 800 : 600 }}>{b}</b>
        </div>
      ))}
    </div>
  );

  let body;
  if (def) {
    body = <>{def.fields.map(field)}{def.ro && def.ro.map(([l, v]) => (
      <div key={l} style={{ marginBottom: 18 }}>
        <label className="lbl" style={{ fontWeight: 600 }}>{l}</label>
        <input className="fld" readOnly value={inr(v)} />
        <p style={{ color: FAINT, fontSize: 12.5, marginTop: 6 }}>Auto-applied by the portal - not editable.</p>
      </div>
    ))}</>;
  } else if (code === "Part A-Gen") {
    body = <>
      {[["name", "Name"], ["pan", "PAN"], ["dob", "Date of birth"], ["address", "Address"], ["mobile", "Mobile"], ["email", "Email"]].map(([k, l]) => (
        <div key={k} style={{ marginBottom: 16 }}>
          <label className="lbl" style={{ fontWeight: 600 }}>{l}</label>
          <input className="fld" value={data[k]} onChange={(e) => set(k, e.target.value)} />
        </div>
      ))}
    </>;
  } else if (code === "Part B-TI") {
    body = infoTable([
      ["Income from Salary", inr(R.salary)],
      ["Income from House Property", inr(R.hp)],
      ["Capital Gains (STCG + LTCG)", inr(R.stcgOther + R.stcg111A + R.ltcg112A)],
      ["Income from Other Sources", inr(R.os)],
      ["Gross Total Income", inr(R.gti), true],
      ["Less: Chapter VI-A deductions", inr(0)],
      ["Total Income", inr(R.gti), true],
    ]);
  } else if (code === "Part B-TTI") {
    body = infoTable([
      ["Tax on normal-rate income (after 87A/relief)", inr(R.slabBase)],
      ["Tax on STCG 111A @ 20%", inr(R.tax111A)],
      ["Tax on LTCG 112A @ 12.5%", inr(R.tax112A)],
      ["Health & education cess @ 4%", inr(R.cess)],
      ["Total tax liability", inr(R.total), true],
      ["Less: taxes paid", inr(R.paid)],
      [R.balance > 0 ? "Balance tax payable" : "Refund due", inr(Math.abs(R.balance)), true],
    ]);
  } else if (code === "SI") {
    body = infoTable([
      ["STCG 111A (equity, STT paid) @ 20%", inr(R.stcg111A) + " -> " + inr(R.tax111A)],
      ["LTCG 112A above 1.25L @ 12.5%", inr(R.ltcgTaxable) + " -> " + inr(R.tax112A)],
      ["Total special-rate tax", inr(R.tax111A + R.tax112A), true],
    ]);
  } else if (["CYLA", "BFLA", "CFL", "AMTC"].includes(code)) {
    body = <div style={{ background: TINT, borderRadius: 8, padding: 18, fontSize: 14.5, lineHeight: 1.6, color: MUTE }}>
      No losses to set off or carry forward in this practice profile, so this schedule computes to nil. It is still confirmed as part of the return. Add a House Property loss in Schedule HP to see numbers appear here.
    </div>;
  } else {
    body = <div style={{ background: TINT, borderRadius: 8, padding: 18, fontSize: 14.5, lineHeight: 1.6, color: MUTE }}>
      Nothing to enter for this schedule in the current practice profile. Review the description and confirm to continue.
    </div>;
  }

  return (
    <div className="ovl" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 24px", borderBottom: `1px solid ${LINE}` }}>
          <span className="codebox">{code}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{meta.name}</div>
            <p style={{ color: MUTE, fontSize: 13.5, marginTop: 2 }}>{meta.desc}</p>
          </div>
          <button className="link" onClick={onClose} style={{ fontSize: 22, color: MUTE }}>{"\u2715"}</button>
        </div>
        <div style={{ padding: "22px 24px" }}>
          <Coach show={coach && !!def} title="Edit the pre-filled values">These come pre-filled just like the real portal. Change any figure and the tax at the bottom of the return recomputes instantly. Nothing is sent anywhere.</Coach>
          {body}
          <div style={{ background: "#f4fbf6", border: "1px solid #bfe3c9", borderRadius: 8, padding: "12px 16px", marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 14.5 }}>
            <span style={{ color: MUTE }}>Return {R.balance > 0 ? "balance payable" : "refund"} so far</span>
            <b style={{ color: R.balance > 0 ? RED : GREEN }}>{inr(Math.abs(R.balance))}</b>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "16px 24px", borderTop: `1px solid ${LINE}` }}>
          <button className="btn btn-o" onClick={onClose}>Cancel</button>
          <button className="btn btn-p" onClick={onConfirm}>Confirm {"\u2713"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Verify ───────────────────────────────────────────────────
function Verify({ data, go, coach, R }) {
  const [agree, setAgree] = useState(true);
  return (
    <Page maxWidth={860}>
      <Crumbs items={["Dashboard", "e-file", "Income Tax Return", "ITR", "Return Summary", "Verification"]} />
      <h1 className="page-h1" style={{ fontWeight: 700, marginBottom: 8 }}>Verify & Submit your Return</h1>
      <Coach show={coach} title="The bottom line">Green means a refund, red means tax still payable. Anything you edited in the schedules is reflected here. Tick the declaration and Submit.</Coach>
      <div className="card" style={{ padding: 26 }}>
        {[["Name / PAN", data.name + " \u00B7 " + data.pan], ["Assessment year", "AY 2026-27 \u00B7 New regime"], ["Income from Salary", inr(R.salary)], ["Income from House Property", inr(R.hp)], ["Income from Other Sources", inr(R.os)], ["Capital Gains", inr(R.stcgOther + R.stcg111A + R.ltcg112A)], ["Gross total income", inr(R.gti)], ["Total tax liability", inr(R.total)], ["Total tax paid", inr(R.paid)]].map(([a, b]) => (
          <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${LINE}`, fontSize: 15 }}><span style={{ color: MUTE }}>{a}</span><b>{b}</b></div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16 }}>
          <b style={{ fontSize: 17 }}>{R.balance > 0 ? "Balance tax payable" : "Refund due"}</b>
          <b style={{ fontSize: 26, color: R.balance > 0 ? RED : GREEN }}>{inr(Math.abs(R.balance))}</b>
        </div>
      </div>
      {R.balance > 0 && <p style={{ color: MUTE, fontSize: 13.5, marginTop: 12, lineHeight: 1.5 }}>Tip: open the <b>Tax Paid</b> schedule from the Return Summary and enter a self-assessment tax amount to bring this balance to zero.</p>}
      <label style={{ display: "flex", gap: 12, marginTop: 20, fontSize: 14.5, color: MUTE, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ accentColor: NAVY, width: 18, height: 18, marginTop: 2 }} />
        I declare that the information given is correct and complete. <em style={{ color: FAINT }}>(practice declaration)</em>
      </label>
      <NavBtns onBack={() => go("itr_summary")} onNext={() => go("itr_done")} nextLabel="Submit" disabled={!agree} />
    </Page>
  );
}

function Done({ data, go }) {
  const ack = "AY26-PRAC-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  return (
    <Page maxWidth={640}>
      <div className="card" style={{ padding: "clamp(26px,4vw,44px)", textAlign: "center", marginTop: 30 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#eaf7ee", color: GREEN, display: "grid", placeItems: "center", fontSize: 34, margin: "0 auto 18px" }}>{"\u2713"}</div>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Practice return submitted.</h1>
        <p style={{ color: MUTE, fontSize: 15, lineHeight: 1.6, marginTop: 12 }}>Well done, {data.first}. In the live portal you would now e-Verify within 30 days. Nothing here was sent anywhere.</p>
        <div style={{ background: TINT, border: `1px solid ${LINE}`, borderRadius: 8, padding: 18, marginTop: 22, textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${LINE}` }}><span style={{ color: MUTE }}>Acknowledgement (mock)</span><b>{ack}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}><span style={{ color: MUTE }}>Status</span><b style={{ color: AMBER }}>Pending e-Verification</b></div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
          <button className="btn btn-o" onClick={() => go("dashboard")}>Back to Dashboard</button>
          <button className="btn btn-p" onClick={() => go("itr_year")}>File another (practice)</button>
        </div>
      </div>
    </Page>
  );
}

// ── e-File dropdown menu (Dashboard nav) ─────────────────────
function EfileMenu({ view, inWizard, go }) {
  const [open, setOpen] = useState(false);
  const items = [
    ["Income Tax Return \u203A", "itr_year"],
    ["View Form 26AS", "form26as"],
    ["e-Pay Tax", "epay"],
    ["View Annual Information Statement (AIS)", "ais"],
  ];
  return (
    <span className="efwrap" onMouseLeave={() => setOpen(false)}>
      <button className={"navlink" + (inWizard || ["form26as","ais","epay"].includes(view) ? " on" : "")}
        onClick={() => setOpen((o) => !o)} onMouseEnter={() => setOpen(true)} aria-expanded={open}>
        e-File {"\u25BE"}
      </button>
      {open && (
        <div className="efmenu" role="menu">
          {items.map(([label, v]) => (
            <button key={v} className="efitem" role="menuitem"
              onClick={() => { setOpen(false); go(v); }}>{label}</button>
          ))}
        </div>
      )}
    </span>
  );
}

// ── Shared record-screen helpers ─────────────────────────────
function RecordTable({ head, rows }) {
  return (
    <div className="portal-table-wrap" style={{ border: `1px solid ${LINE}`, borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr style={{ background: TINT }}>
          {head.map((h, i) => (
            <th key={i} style={{ textAlign: typeof h === "object" ? h.a : "left", padding: "12px 14px", fontWeight: 700, color: INK, borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap" }}>
              {typeof h === "object" ? h.t : h}
            </th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderBottom: `1px solid ${LINE}` }}>
              {r.map((c, ci) => (
                <td key={ci} style={{ padding: "12px 14px", textAlign: typeof c === "object" ? c.a : "left", color: typeof c === "object" ? (c.c || INK) : INK, fontWeight: typeof c === "object" && c.b ? 700 : 400 }}>
                  {typeof c === "object" ? c.t : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const R2 = (a) => ({ t: a, a: "right" });

// ── View Form 26AS ───────────────────────────────────────────
function Form26AS({ data, go, coach, R }) {
  const salTds = num(data.tdsSalary), othTds = num(data.tdsOther);
  const adv = num(data.advanceTax), sat = num(data.selfAssessment);
  return (
    <Page>
      <Crumbs items={[<a key="d" onClick={() => go("dashboard")}>Dashboard</a>, "Form 26AS"]} />
      <Coach show={coach} title="This is your Form 26AS (Annual Tax Statement)">Form 26AS shows every rupee of tax credited against your PAN, TDS deducted for you, and any tax you paid yourself. The totals here feed the <strong>Tax Paid</strong> schedule of your return.</Coach>
      <h1 className="page-h1" style={{ fontWeight: 800, marginBottom: 4 }}>Form 26AS</h1>
      <p style={{ color: MUTE, fontSize: 14, marginBottom: 20 }}>Annual Tax Statement under Section 203AA {"\u00B7"} PAN {data.pan} {"\u00B7"} AY 2026-27</p>

      <div className="card" style={{ padding: 22, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Part A {"\u2013"} TDS on Salary</h3>
        <RecordTable
          head={["Deductor", "TAN", R2("Amount paid"), R2("Tax deducted"), R2("TDS deposited")]}
          rows={[[data.employer, data.tan, R2(inr(data.grossSalary)), R2(inr(salTds)), R2(inr(salTds))]]} />
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Part A {"\u2013"} TDS on other income</h3>
        <RecordTable
          head={["Deductor", "Section", R2("Amount paid"), R2("Tax deducted"), R2("TDS deposited")]}
          rows={ othTds > 0
            ? [[data.bankName, "194A", R2(inr(num(data.fdInterest))), R2(inr(othTds)), R2(inr(othTds))]]
            : [[{ t: "No TDS on other income for this year.", a: "left" }, "", R2("\u2013"), R2("\u2013"), R2("\u2013")]] } />
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Part C {"\u2013"} Tax paid (other than TDS/TCS)</h3>
        <RecordTable
          head={["Major head", "Minor head", "Challan / BSR", R2("Amount")]}
          rows={ (adv + sat) > 0
            ? [
                ...(adv > 0 ? [["Income Tax (0021)", "Advance Tax (100)", "0000762 / 00001700", R2(inr(adv))]] : []),
                ...(sat > 0 ? [["Income Tax (0021)", "Self-Assessment Tax (300)", "0000762 / 00001703", R2(inr(sat))]] : []),
              ]
            : [[{ t: "No self-assessment or advance tax paid yet. Use e-Pay Tax to pay any balance.", a: "left" }, "", "", R2("\u2013")]] } />
      </div>

      <div className="card" style={{ padding: 22, background: TINT, borderColor: "#c9d6ef" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: NAVY }}>
          <span>Total tax credit available (26AS)</span>
          <span>{inr(salTds + othTds + adv + sat)}</span>
        </div>
        <p style={{ color: MUTE, fontSize: 13, marginTop: 8 }}>This equals the {"\u201C"}Taxes Paid{"\u201D"} figure of {inr(R.paid)} used in your return computation.</p>
      </div>

      <div style={{ marginTop: 26, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn btn-o" onClick={() => go("dashboard")}>{"\u2039"} Go To Dashboard</button>
        <button className="btn btn-p" onClick={() => go("epay")}>Go to e-Pay Tax {"\u203A"}</button>
      </div>
    </Page>
  );
}

// ── View AIS (Annual Information Statement) ───────────────────
function AIS({ data, go, coach, R }) {
  const rows = [
    ["Salary", "Income received", inr(data.grossSalary), data.employer],
    ["Interest from savings bank", "SFT-016(SB)", inr(data.savingsInterest), data.bankName],
    ["Interest from deposits", "SFT-016(TD)", inr(data.fdInterest), data.bankName],
    ["Dividend received", "SFT-015", inr(data.dividend), "Registrar & Transfer Agent"],
    ["Sale of securities (STCG u/s 111A)", "SFT-017", inr(data.stcg111A), "Depository / Broker"],
    ...(num(data.ltcg112A) > 0 ? [["Sale of securities (LTCG u/s 112A)", "SFT-018", inr(data.ltcg112A), "Depository / Broker"]] : []),
    ["TDS on salary", "Form 26Q/24Q", inr(data.tdsSalary), data.employer],
  ];
  return (
    <Page>
      <Crumbs items={[<a key="d" onClick={() => go("dashboard")}>Dashboard</a>, "Annual Information Statement"]} />
      <Coach show={coach} title="This is your AIS (Annual Information Statement)">AIS is the widest view of what third parties reported about you {"\u2013"} salary, interest, dividends, and securities trades. Reconcile every line here against your own records before filing; if something is wrong, you can submit feedback on the real portal.</Coach>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Annual Information Statement</h1>
      <p style={{ color: MUTE, fontSize: 14, marginBottom: 20 }}>PAN {data.pan} {"\u00B7"} {data.name} {"\u00B7"} Financial Year 2025-26 (AY 2026-27)</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }} className="grid2">
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: MUTE, fontWeight: 600 }}>Taxpayer Information Summary (TIS)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: NAVY, marginTop: 6 }}>{inr(R.gti + 75000)}</div>
          <div style={{ fontSize: 13, color: MUTE, marginTop: 4 }}>Gross reported income across all sources</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: MUTE, fontWeight: 600 }}>Total tax credit reported</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: GREEN, marginTop: 6 }}>{inr(R.paid)}</div>
          <div style={{ fontSize: 13, color: MUTE, marginTop: 4 }}>TDS + advance/self-assessment tax</div>
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Information details</h3>
        <RecordTable
          head={["Information", "Source / SFT code", R2("Amount"), "Reported by"]}
          rows={rows.map((r) => [r[0], r[1], R2(r[2]), r[3]])} />
      </div>

      <div style={{ marginTop: 26, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn btn-o" onClick={() => go("dashboard")}>{"\u2039"} Go To Dashboard</button>
        <button className="btn btn-p" onClick={() => go("form26as")}>View Form 26AS {"\u203A"}</button>
      </div>
    </Page>
  );
}

// ── e-Pay Tax ────────────────────────────────────────────────
function EpayTax({ data, set, go, coach, R }) {
  const [tab, setTab] = useState("challans");
  const [paying, setPaying] = useState(false);
  const balance = R.balance;
  const sat = num(data.selfAssessment);

  // Challans reflect what has actually been paid in this session, plus a fixed
  // "failed" attempt so the screen mirrors the real portal's history view.
  const challans = [];
  if (sat > 0) challans.push({ crn: "0000762" + (10000 + Math.round(sat) % 9000), type: "Self-Assessment Tax (300)", ay: "2026-27", amt: sat, mode: "Net Banking", status: "Paid", statusColor: GREEN, date: "05-Jul-2026 11:20:14" });
  if (balance > 0) challans.push({ crn: "0000762" + (20000 + Math.round(balance) % 9000), type: "Self-Assessment Tax (300)", ay: "2026-27", amt: balance, mode: "Payment Gateway", status: "Payment failed", statusColor: RED, date: "05-Jul-2026 10:47:52" });

  const payNow = () => {
    setPaying(true);
    setTimeout(() => {
      set("selfAssessment", num(data.selfAssessment) + Math.max(0, balance));
      setPaying(false);
      setTab("challans");
    }, 700);
  };

  return (
    <Page>
      <Crumbs items={[<a key="d" onClick={() => go("dashboard")}>Dashboard</a>, "e-Pay Tax -1961"]} />
      <Coach show={coach} title="This is e-Pay Tax">This is where you pay any balance tax (self-assessment) and track your challans. When there is a balance due, pay it here {"\u2013"} the amount flows straight into your return{"\u2019"}s Tax Paid schedule and the balance drops to zero.</Coach>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>e-Pay Tax</h1>
          <p style={{ color: MUTE, fontSize: 14, maxWidth: 620, lineHeight: 1.6 }}>Pay tax through Net Banking, Debit Card, Over the Counter, NEFT/RTGS or Payment Gateway. Challans generated through e-Filing appear below.</p>
        </div>
        <button className="btn btn-o" onClick={() => setTab("new")}>+ New Payment</button>
      </div>

      <div className="card" style={{ padding: 0, marginTop: 22, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${LINE}` }}>
          {[["challans", "Generated Challans"], ["history", "Payment History"], ["new", "New Payment"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding: "16px 22px", fontSize: 14.5, fontWeight: 700, background: "none", border: "none", cursor: "pointer",
                color: tab === id ? BLUE : MUTE, borderBottom: tab === id ? `3px solid ${BLUE}` : "3px solid transparent" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: 22 }}>
          {tab === "new" && (
            <div>
              <div style={{ background: balance > 0 ? "#fff4f4" : "#eaf7ee", border: `1px solid ${balance > 0 ? "#f2c2c2" : "#bfe3c9"}`, borderRadius: 8, padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 14, color: MUTE, fontWeight: 600 }}>Balance payable (from your return)</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: balance > 0 ? RED : GREEN, marginTop: 4 }}>{balance > 0 ? inr(balance) : inr(0)}</div>
                {balance <= 0 && <div style={{ fontSize: 13.5, color: GREEN, marginTop: 6, fontWeight: 600 }}>{"\u2713"} Nothing to pay {"\u2013"} you have a refund or your taxes are fully covered.</div>}
              </div>
              <div style={{ fontSize: 14, marginBottom: 8, fontWeight: 600 }}>Select Applicable Income Tax Act</div>
              <div className="opt on" style={{ marginBottom: 20 }}>
                <span className="radio on" /><span>Income-tax Act, 1961 {"\u2013"} Self-Assessment Tax for AY 2026-27</span>
              </div>
              <button className="btn btn-p" disabled={balance <= 0 || paying} onClick={payNow}>
                {paying ? "Processing payment\u2026" : balance > 0 ? `Pay ${inr(balance)} now \u203A` : "No payment due"}
              </button>
            </div>
          )}

          {tab === "challans" && (
            challans.length > 0 ? (
              <RecordTable
                head={["CRN", "Type of Payment", "AY", R2("Amount"), "Mode", "Status", "Created On"]}
                rows={challans.map((c) => [c.crn, c.type, c.ay, R2(inr(c.amt)), c.mode, { t: c.status, c: c.statusColor, b: true }, c.date])} />
            ) : (
              <div style={{ padding: "30px 0", textAlign: "center", color: MUTE }}>No challans generated yet. Open <strong>New Payment</strong> to pay any balance.</div>
            )
          )}

          {tab === "history" && (
            <RecordTable
              head={["CRN", "Type of Payment", "AY", R2("Amount"), "Mode", "Status", "Created On"]}
              rows={ sat > 0
                ? [["000076211703", "Self-Assessment Tax (300)", "2026-27", R2(inr(sat)), "Net Banking", { t: "Paid", c: GREEN, b: true }, "05-Jul-2026 11:20:14"]]
                : [[{ t: "No completed payments in this session yet.", a: "left" }, "", "", R2("\u2013"), "", "", ""]] } />
          )}
        </div>
      </div>

      <p style={{ fontSize: 13, color: MUTE, marginTop: 16 }}><strong>Note:</strong> Challans generated and remitted through e-Filing are only available in this section.</p>

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-o" onClick={() => go("dashboard")}>{"\u2039"} Go To Dashboard</button>
      </div>
    </Page>
  );
}

function Footer({ authed }) {
  return (
    <footer style={{ background: authed ? "#eceff5" : "#fff", borderTop: `1px solid ${LINE}`, position: "relative", zIndex: 1 }}>
      <div className="footer-inner">
        <div style={{ marginBottom: 6 }}><span className="link">Feedback</span> | <span className="link">Website Policies</span> | <span className="link">Accessibility Statement</span> | <span className="link">Site Map</span> | <span className="link">Browser Support</span></div>
        This is a <b>practice sandbox</b> for learning, not the real portal. Nothing is submitted to the Income Tax Department.
        <div style={{ marginTop: 4 }}>Best viewed in 1024 x 768 with the latest Chrome, Firefox, Safari or Edge.</div>
      </div>
    </footer>
  );
}
