// ─────────────────────────────────────────────────────────────
//  TAXPILOT. "Your co-pilot for filing ITR."
//  Neutral slate UI. Deep near-black base. Amber accent.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import PracticePortal from "./PracticePortal.jsx";

const BG      = "#090A0E";
const CARD    = "#10141C";
const SURFACE = "#151A22";
const LINE    = "rgba(255,255,255,0.06)";
const TEXT    = "#E8EBF0";
const MUTE    = "#8E97A8";
const FAINT   = "#5E6678";
const INK     = "#090A0E";
const AMBER   = "#FFB84D";
const GOOD    = "#7BD88F";

const FORMS = {
  ITR1: { tag: "ITR-1", name: "Sahaj", line: "The simple one.",
    who: "Resident salaried people with straightforward income.", income: "Up to Rs 50 lakh",
    fits: ["Salary or pension", "Up to two house properties", "Interest & dividend income", "LTCG 112A up to Rs 1.25 lakh", "Agricultural income up to Rs 5,000"],
    breaks: ["Capital gains over Rs 1.25 lakh", "Any foreign asset or account", "You are an NRI or a director", "You own unlisted shares", "Income above Rs 50 lakh"] },
  ITR2: { tag: "ITR-2", name: "For investors", line: "Salary meets the market.",
    who: "People with capital gains or foreign assets, but no business income.", income: "No upper limit",
    fits: ["Everything ITR-1 allows", "Capital gains on shares, MF, property, gold", "Foreign shares & accounts (Schedule FA)", "More than two house properties", "NRI, RNOR, directors, unlisted shares"],
    breaks: ["You run a business or profession", "F&O or intraday trading", "You need presumptive taxation"] },
  ITR3: { tag: "ITR-3", name: "For business", line: "You earn from your own work.",
    who: "Individuals and HUFs with business or professional income.", income: "No upper limit",
    fits: ["Business or professional income", "F&O and intraday trading", "Everything ITR-2 covers", "Partner in a firm", "Books of accounts where needed"],
    breaks: ["You only have salary and investments", "Presumptive scheme fits you better"] },
  ITR4: { tag: "ITR-4", name: "Sugam", line: "Presumptive and light.",
    who: "Small business and professionals opting for presumptive taxation.", income: "Up to Rs 50 lakh",
    fits: ["Presumptive income under 44AD / 44ADA / 44AE", "Salary alongside a small business", "One house property", "Interest and other simple income"],
    breaks: ["Turnover crosses the presumptive limit", "Capital gains or foreign assets", "You are a company director"] },
};

const DOCS = [
  { n: "Form 16", why: "Your employer's salary and TDS summary.", check: "Header must match the year you picked. Confirm both Part A and Part B.", forms: ["ITR1","ITR2","ITR3","ITR4"] },
  { n: "Form 26AS", why: "Every rupee of tax deducted against your PAN.", check: "Download from TRACES for the year you selected. The filename often lies, so read the header.", forms: ["ITR1","ITR2","ITR3","ITR4"] },
  { n: "AIS", why: "The department's full picture of your income.", check: "Cross-check salary, dividend and bank interest carefully.", forms: ["ITR1","ITR2","ITR3","ITR4"] },
  { n: "Bank interest certificates", why: "Savings and FD interest that is taxable.", check: "Add every account. This income is self-assessed, so it is easy to forget.", forms: ["ITR1","ITR2","ITR3","ITR4"] },
  { n: "Capital gains statement", why: "Consolidated gains from your broker or AMC.", check: "Match the quarterly breakup in Schedule CG. Mismatches trigger validation errors.", forms: ["ITR2","ITR3"] },
  { n: "80C / 80D proofs", why: "Deduction evidence, only under the old regime.", check: "Skip entirely if you are on the new regime with nothing to claim.", forms: ["ITR1","ITR2","ITR3","ITR4"] },
];

const SOLUTIONS = [
  { cat: "Refund", q: "ITR is 'Processed' but the refund has not reached my bank.", a: "The processing cycle and the payment cycle run separately, so a processed return can still be waiting. Most stuck refunds trace back to bank pre-validation. Check e-File > View Filed Returns for a refund-failure code, confirm your account is pre-validated and EVC-enabled under My Profile > My Bank Account, then raise a Refund Reissue request for that year. CPC usually re-issues within 2 to 4 weeks." },
  { cat: "Refund", q: "Refund failed citing wrong IFSC even though my details are correct.", a: "Validation can fail even with correct details if the account is inactive, the name or PAN linkage does not match the bank's records, or the email/mobile registered with the bank differs. Re-validate the account, and if it keeps failing add a second bank account and set that as the refund account. Many filers report offline-utility filing pushes validation through within 24 hours." },
  { cat: "Payment", q: "I paid tax by UPI but it is not showing in the ITR, and it asks me to pay again.", a: "Do not pay again immediately. Go to e-Pay Tax > Payment History or Generated Challan. If the entry appears in any status, open the three-dot menu and download the receipt, it carries the BSR code and challan number. Enter those under Taxes Paid > Self-Assessment Tax in your return. If money was debited but no challan exists at all, it usually auto-reverses in 3 to 7 days, then pay again." },
  { cat: "Payment", q: "For larger tax dues, which payment mode is safest?", a: "Prefer net banking over UPI for larger amounts. UPI on the portal gateway can debit your bank yet fail to reconcile, leaving you chasing a challan near the deadline. Net banking generates the challan more reliably." },
  { cat: "Mismatch", q: "My TDS or income does not match Form 26AS / AIS.", a: "The department cross-checks your return against 26AS and AIS, so mismatches delay refunds or trigger notices. Download both, compare against Form 16 and bank records, and submit feedback in the AIS portal for any wrong entry. If a deductor used the wrong PAN or filed late, ask them to file a correction return on TRACES. If you cannot resolve it in time, claim only the TDS actually reflected in 26AS to avoid a hold." },
  { cat: "Mismatch", q: "AIS shows income that is not mine, or shows it twice.", a: "Duplicate reporting and income landing under the wrong PAN or year are common. In the AIS portal, open the entry and submit feedback (Information is duplicate, Not my income, or Relates to another year). The source entity gets 30 days to respond. File your return with your correct figures and keep supporting documents, you are not required to accept a wrong AIS amount." },
  { cat: "Notice", q: "I received a defective-return notice under Section 139(9).", a: "This means the return failed a validation check, commonly TDS claimed without reporting the matching income, gross receipts in 26AS higher than income declared, or the wrong form. You get 15 days to respond via e-Proceedings: either agree and upload a corrected JSON, or disagree with a written explanation. Ignoring it makes the original return invalid, treated as if you never filed." },
  { cat: "Notice", q: "I got a Section 143(1) intimation with an adjustment.", a: "This is the automated processing summary. It compares your return with 26AS/AIS and may add tax or reduce your refund. If you agree, pay any demand. If you disagree, file a rectification under Section 154 or a response on the portal with documents. Read the reason column carefully, it names the exact head that was adjusted." },
  { cat: "Form", q: "I filed ITR-1 but I have capital gains. Is that a problem?", a: "Yes. Capital gains over the small 112A limit, foreign assets, more than two house properties, or being a director all rule out ITR-1. Filing the wrong form almost guarantees a defective-return notice. Move to ITR-2 (investments) or ITR-3 (business or F&O). Use the form finder to confirm which one fits you." },
  { cat: "Form", q: "The portal greyed out ITR-1 / ITR-4 for me.", a: "The portal blocks a form when your profile or pre-filled data disqualifies it, for example certain TDS sections in 26AS, crypto or gaming income, or income above the threshold. Read what it flags, then pick the correct form rather than forcing the simpler one." },
  { cat: "Verification", q: "e-Verification or Aadhaar OTP keeps failing.", a: "Confirm your mobile number is linked to Aadhaar and your PAN-Aadhaar link is active, OTP fails silently otherwise. Alternatives: e-Verify through net banking, or via a validated and EVC-enabled bank or demat account. Remember an unverified return is not legally filed, and you have 30 days from filing to verify." },
  { cat: "Verification", q: "How long do I have to verify, and what if I miss it?", a: "You have 30 days from the date of filing. Miss it and the return is treated as not filed, you would need to file a fresh belated or revised return and verify that promptly. Verifying the same day by Aadhaar OTP is the safest habit." },
  { cat: "Regime", q: "New regime or old, which should I pick?", a: "If your deductions are low or you are salaried with little to claim, the new regime usually wins thanks to the Rs 75,000 standard deduction, lower slabs and the enhanced 87A rebate (income up to Rs 12 lakh effectively tax-free). If you have heavy 80C, 80D, HRA and home-loan interest, run both, old can still win. Use the calculator, do not guess." },
  { cat: "Regime", q: "How do I opt for the old regime if I have business income?", a: "Salaried filers simply choose the regime while filing. But if you have business or professional income, opting out of the new regime needs Form 10-IEA filed on or before the due date. For business income this switch is largely a once-in-a-lifetime choice, so decide carefully." },
  { cat: "Deadline", q: "What are the due dates for this year, and can I file late?", a: "For AY 2026-27, individuals filing ITR-1/ITR-2 have 31 July 2026, and ITR-3/ITR-4 (non-audit) have 31 August 2026 under the staggered calendar. Miss it and you can still file a belated return under 139(4), but with late fees and restricted loss carry-forward. A revised return under 139(5) is allowed up to 31 December of the assessment year." },
  { cat: "Upload", q: "JSON upload fails or the utility shows a validation error.", a: "Usually the JSON came from an outdated utility or the wrong form. Download the latest offline utility, select the correct ITR, and regenerate the JSON. Clear the browser cache before uploading. If a schedule refuses to validate with 'fill mandatory fields' while it looks complete, delete that schedule and re-enter it, or switch to the offline Excel utility." },
];

function useReveal(dep) {
  useEffect(() => {
    const els = document.querySelectorAll(".rise:not(.in)");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}

function filingYears(now) {
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const baseAY = m >= 4 ? y : y - 1, list = [];
  for (let i = 0; i < 5; i++) {
    const ayStart = baseAY - i, fyStart = ayStart - 1;
    list.push({ ay: ayStart + "-" + String(ayStart + 1).slice(2), fy: fyStart + "-" + String(fyStart + 1).slice(2), current: i === 0 });
  }
  return list;
}

// Tax engine for FY 2025-26 (AY 2026-27), returns per-slab breakdown.
const NEW_SLABS = [[0,400000,0],[400000,800000,0.05],[800000,1200000,0.10],[1200000,1600000,0.15],[1600000,2000000,0.20],[2000000,2400000,0.25],[2400000,Infinity,0.30]];
const OLD_SLABS = [[0,250000,0],[250000,500000,0.05],[500000,1000000,0.20],[1000000,Infinity,0.30]];
function compute(regime, gross, salaried, deductions) {
  const sd = regime === "new" ? (salaried ? 75000 : 0) : (salaried ? 50000 : 0);
  const ded = regime === "old" ? Math.max(0, deductions) : 0;
  const ti = Math.max(0, gross - sd - ded);
  const slabs = regime === "new" ? NEW_SLABS : OLD_SLABS;
  const rows = [];
  let base = 0;
  for (const [lo, hi, rate] of slabs) {
    if (ti > lo) { const amt = Math.min(ti, hi) - lo; const t = amt * rate; base += t; if (rate > 0) rows.push({ lo, hi, rate, amt, t }); }
  }
  const rebateCap = regime === "new" ? 1200000 : 500000;
  let rebate = 0, marginal = 0;
  if (ti <= rebateCap) { rebate = base; base = 0; }
  else if (regime === "new") { const relief = base - (ti - 1200000); if (relief > 0) { marginal = relief; base -= relief; } }
  const cess = Math.round(base * 0.04);
  const total = Math.round(base) + cess;
  return { sd, ded, ti, rows, base: Math.round(base), rebate: Math.round(rebate), marginal: Math.round(marginal), cess, total };
}
const inr = (n) => "Rs " + Math.round(n).toLocaleString("en-IN");
const inrShort = (n) => n >= 10000000 ? (n/10000000).toFixed(2)+"Cr" : n >= 100000 ? (n/100000).toFixed(1)+"L" : (n/1000).toFixed(0)+"k";

// Where each number on your documents goes in the return.
// Grouped by the paper in your hand; each row tagged with the forms it applies to.
const MAPPING = [
  { src: "Form 16 (from your employer)", tag: "SALARY", rows: [
    { from: "Gross salary, Part B, 17(1)", to: "Salary > Gross salary u/s 17(1)", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "The pre-filled figure should match this. Read Part B, not just Part A." },
    { from: "Perquisites, 17(2)", to: "Salary > Perquisites u/s 17(2)", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "Car, ESOP, rent-free housing. Cross-check with Form 12BA. Zero means leave it blank." },
    { from: "HRA / LTA exemption", to: "Allowances exempt u/s 10", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "Old regime only. The new regime ignores these, so they stay taxable there." },
    { from: "Standard deduction", to: "Auto-applied by the portal", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "Rs 75,000 new, Rs 50,000 old. Do not enter it yourself." },
    { from: "Professional tax", to: "Deduction from salary", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "Old regime only, capped at Rs 2,500." },
    { from: "TDS on salary, Part A", to: "Taxes Paid > TDS (Schedule TDS1)", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "Must reconcile with Form 26AS. Claim only what 26AS shows." },
  ]},
  { src: "Form 26AS / AIS", tag: "TAX CREDIT", rows: [
    { from: "TDS by employer / others", to: "Taxes Paid > Schedule TDS1 & TDS2", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "26AS is the source of truth for tax credit. Mismatches delay refunds." },
    { from: "Advance / self-assessment tax", to: "Taxes Paid > Schedule IT", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "Enter BSR code, challan number and date from the challan." },
    { from: "Dividend income", to: "Other Sources > Dividend", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "Taxable at slab. AIS lists it payer-wise; total it." },
  ]},
  { src: "Bank interest certificate", tag: "INTEREST", rows: [
    { from: "Savings account interest", to: "Other Sources > Interest from savings", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "Claim up to Rs 10,000 back under 80TTA (old regime), Rs 50,000 under 80TTB if senior." },
    { from: "Fixed deposit interest", to: "Other Sources > Interest from deposits", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "Fully taxable. Report the accrued amount even if not yet paid out." },
  ]},
  { src: "Broker / AMC capital gains statement", tag: "CAPITAL GAINS", rows: [
    { from: "Equity & equity MF, short term", to: "Schedule CG > 111A", forms: ["ITR2","ITR3"], note: "20% flat. Rules out ITR-1." },
    { from: "Equity & equity MF, long term", to: "Schedule CG > 112A", forms: ["ITR2","ITR3"], note: "12.5% above Rs 1.25 lakh/year. Needs scrip-wise detail." },
    { from: "Property / gold / unlisted, long term", to: "Schedule CG > 112", forms: ["ITR2","ITR3"], note: "12.5% without indexation. Report buyer and sale-deed details for property." },
    { from: "F&O / intraday", to: "Business income (Schedule BP)", forms: ["ITR3"], note: "This is business income, not capital gains. It forces ITR-3." },
  ]},
  { src: "Deduction proofs (80C / 80D / home loan)", tag: "OLD REGIME", rows: [
    { from: "80C, PF, ELSS, LIC, tuition", to: "Deductions > Chapter VI-A > 80C", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "Capped at Rs 1.5 lakh. Old regime only." },
    { from: "80D, health insurance", to: "Deductions > 80D", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "Up to Rs 25,000, or Rs 50,000 if senior. Old regime only." },
    { from: "Home loan interest", to: "House Property > Interest u/s 24(b)", forms: ["ITR1","ITR2","ITR3","ITR4"], note: "Up to Rs 2 lakh for self-occupied. Old regime only." },
  ]},
  { src: "Business books (P&L, balance sheet)", tag: "BUSINESS", rows: [
    { from: "Net profit / turnover", to: "Schedule BP > Business income", forms: ["ITR3"], note: "Full books. Audit may apply above turnover limits." },
    { from: "Presumptive receipts", to: "Schedule BP > 44AD / 44ADA / 44AE", forms: ["ITR4"], note: "Declare 6%/8% (business) or 50% (profession). No detailed books needed up to Rs 50 lakh / 2-3 crore." },
  ]},
];

const wrap = { maxWidth: 1080, margin: "0 auto", padding: "0 clamp(14px, 4vw, 24px)" };
const eye = { fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: FAINT, fontFamily: "'JetBrains Mono',monospace" };
const h2s = { fontSize: "clamp(2rem,4.4vw,3.1rem)", fontWeight: 600, marginTop: 12, letterSpacing: "-0.015em", lineHeight: 1.05 };

const TOOLS = [["finder","Find my form"],["mapping","What goes where"],["calc","Calculator"],["solutions","Solutions"]];

export default function App() {
  const [view, setView] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const years = useMemo(() => filingYears(new Date()), []);
  const [yi, setYi] = useState(0);

  const go = (v) => { setView(v); setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (view === "practice") {
    return <PracticePortal onExit={() => go("home")} />;
  }

  return (
    <div className="app-root" style={{ background: `linear-gradient(165deg, #0B0C10 0%, ${BG} 48%, #060708 100%)`, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0}
        .app-root{--text-primary:rgba(255,255,255,0.92)}
        button{color:inherit;font-family:inherit}
        html{scroll-behavior:smooth;scroll-padding-top:70px;background:${BG};overflow-x:clip}
        body{background:${BG};overflow-x:clip;min-height:100vh}
        ::selection{background:${AMBER};color:${INK}}
        .disp{font-family:'Space Grotesk',sans-serif}
        .mono{font-family:'JetBrains Mono',monospace}
        .rise{opacity:0;transform:translateY(20px);transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1)}
        .rise.in{opacity:1;transform:none}
        .viewfade{animation:vf .5s cubic-bezier(.22,1,.36,1)}
        @keyframes vf{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .glow{position:fixed;top:-25%;right:-12%;width:62vw;height:62vw;max-width:760px;max-height:760px;border-radius:50%;
          background:radial-gradient(circle,rgba(255,184,77,0.07),transparent 64%);filter:blur(36px);pointer-events:none;animation:drift 22s ease-in-out infinite;z-index:0}
        @keyframes drift{0%,100%{transform:translate(0,0)}50%{transform:translate(-6%,5%)}}
        .lnk{color:${MUTE};text-decoration:none;font-size:14.5px;transition:color .2s;cursor:pointer;background:none;border:none;font-family:inherit;padding:0}
        .lnk:hover{color:${TEXT}}.lnk.on{color:${TEXT}}
        .btn{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:15px;border-radius:999px;padding:14px 26px;cursor:pointer;border:1px solid transparent;transition:transform .18s ease,background .2s,border-color .2s;display:inline-flex;align-items:center;gap:9px;text-decoration:none}
        .btn:hover{transform:translateY(-2px)}
        .btn-p{background:${AMBER};color:${INK}}.btn-p:hover{background:#FFC66E}
        .btn-g{background:transparent;color:${TEXT};border-color:${LINE}}
        .btn-g:hover{border-color:rgba(255,255,255,0.14);background:rgba(255,255,255,0.03)}
        .btn-sandbox{font-size:14px;padding:11px 20px;background:rgba(59,91,180,0.1);color:#b8c8ef;border-color:rgba(100,130,210,0.28)}
        .btn-sandbox:hover{border-color:rgba(120,150,230,0.42);background:rgba(59,91,180,0.16)}
        .sandbox-tag{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:3px 7px;border-radius:999px;background:rgba(59,91,180,0.16);color:#a8b8de;border:1px solid rgba(100,130,210,0.24);margin-right:8px;vertical-align:middle}
        .portal-link{color:${FAINT};font-size:13px;text-decoration:none;white-space:nowrap;padding:8px 4px}
        .portal-link:hover{color:${MUTE}}
        .nav-actions{display:flex;align-items:center;gap:12px;flex-shrink:0}
        .nav-sep{width:1px;height:22px;background:${LINE};flex:none}
        .nav-toggle{display:none;align-items:center;justify-content:center;width:42px;height:42px;border-radius:12px;border:1px solid ${LINE};background:transparent;color:${TEXT};cursor:pointer;flex:none}
        .nav-toggle svg{width:20px;height:20px}
        .nav-drawer{display:none;border-top:1px solid ${LINE};background:rgba(9,10,14,0.99);backdrop-filter:blur(14px);padding:12px 0 18px}
        .nav-drawer.open{display:block}
        .nav-drawer-grid{display:grid;gap:6px}
        .nav-drawer a,.nav-drawer button.nav-item{width:100%;text-align:left;padding:14px 16px;border-radius:12px;border:1px solid transparent;background:transparent;color:${MUTE};font-size:15px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:space-between}
        .nav-drawer button.nav-item.on{background:rgba(255,184,77,0.1);border-color:rgba(255,184,77,0.25);color:${TEXT}}
        .nav-drawer a.nav-item-ext{color:${FAINT};font-size:14px}
        .nav-drawer-divider{height:1px;background:${LINE};margin:8px 0}
        .sandbox-long{display:inline}
        .sandbox-short{display:none}
        .card-title{color:var(--text-primary);font-weight:700}
        button.card.hovr{color:var(--text-primary)}
        .map-dest{text-align:right}
        .verdict-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .footer-inner{display:flex;flex-wrap:wrap;gap:12px 24px;justify-content:space-between;align-items:center}
        .footer-note{color:${FAINT};font-size:12.5px;max-width:520px;line-height:1.5;margin:0}
        .tab{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:14px;padding:10px 18px;border-radius:999px;cursor:pointer;background:transparent;color:${MUTE};border:1px solid ${LINE};transition:all .2s;white-space:nowrap}
        .tab:hover{color:${TEXT};border-color:rgba(255,255,255,0.14)}
        .tab.on{background:${AMBER};color:${INK};border-color:${AMBER}}
        .card{background:${CARD};border:1px solid ${LINE};border-radius:20px;transition:border-color .25s,transform .25s,box-shadow .25s;box-shadow:0 8px 28px rgba(0,0,0,0.38)}
        .hovr:hover{border-color:rgba(255,184,77,0.26);transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,0.42)}
        .dot{width:5px;height:5px;border-radius:50%;flex:none;margin-top:8px}
        .yearpick{display:inline-flex;align-items:center;gap:10px;background:${CARD};border:1px solid ${LINE};border-radius:999px;padding:7px 8px 7px 16px}
        .yearpick select,.fld{appearance:none;-webkit-appearance:none;background:transparent;border:none;color:${TEXT};font-family:'JetBrains Mono',monospace;cursor:pointer}
        .yearpick select{font-size:13px;font-weight:500;padding:5px 30px 5px 10px;border-radius:999px;background-image:linear-gradient(45deg,transparent 50%,${AMBER} 50%),linear-gradient(135deg,${AMBER} 50%,transparent 50%);background-position:calc(100% - 15px) center,calc(100% - 10px) center;background-size:5px 5px,5px 5px;background-repeat:no-repeat}
        .yearpick select option,.fld option{background:${CARD};color:${TEXT}}
        .fld{width:100%;background:${SURFACE};border:1px solid ${LINE};border-radius:12px;padding:13px 15px;font-size:15px;cursor:text}
        .fld:focus,.yearpick select:focus,.search:focus,.tab:focus-visible,.btn:focus-visible,.pill:focus-visible,.page:focus-visible,.lnk:focus-visible{outline:2px solid ${AMBER};outline-offset:2px}
        input[type=range]{-webkit-appearance:none;width:100%;height:4px;border-radius:999px;background:${LINE};outline:none;margin-top:16px}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:${AMBER};cursor:pointer;border:3px solid ${BG}}
        input[type=range]::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:${AMBER};cursor:pointer;border:3px solid ${BG}}
        .chk{display:inline-flex;align-items:center;gap:10px;cursor:pointer;font-size:14.5px;color:${MUTE};user-select:none}
        .chk input{accent-color:${AMBER};width:16px;height:16px}
        .seg{display:inline-flex;border:1px solid ${LINE};border-radius:999px;padding:3px;background:${SURFACE}}
        .seg button{font-family:'JetBrains Mono',monospace;font-size:12px;padding:7px 14px;border-radius:999px;border:none;background:transparent;color:${MUTE};cursor:pointer;transition:all .18s}
        .seg button.on{background:${AMBER};color:${INK}}
        .search{width:100%;background:${CARD};border:1px solid ${LINE};border-radius:14px;padding:16px 18px;color:${TEXT};font-size:15.5px;font-family:'Inter',sans-serif}
        .search::placeholder{color:${FAINT}}
        .pill{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.05em;text-transform:uppercase;padding:6px 12px;border-radius:999px;border:1px solid ${LINE};color:${MUTE};cursor:pointer;transition:all .18s;white-space:nowrap;background:transparent}
        .pill:hover{color:${TEXT}}.pill.on{background:${AMBER};color:${INK};border-color:${AMBER}}
        .qa{cursor:pointer}.qa summary{list-style:none;padding:20px 0;display:flex;gap:16px;align-items:flex-start}
        .qa summary::-webkit-details-marker{display:none}
        .qmark{color:${AMBER};font-family:'JetBrains Mono',monospace;font-size:13px;flex:none;margin-top:3px;transition:transform .2s}
        .qa[open] .qmark{transform:rotate(90deg)}
        .page{min-width:38px;height:38px;padding:0 8px;border-radius:10px;border:1px solid ${LINE};background:transparent;color:${MUTE};cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:14px;transition:all .18s}
        .page:hover:not(:disabled){color:${TEXT};border-color:rgba(255,255,255,0.2)}
        .page.on{background:${AMBER};color:${INK};border-color:${AMBER}}
        .page:disabled{opacity:.35;cursor:not-allowed}
        .bar{height:100%;background:${AMBER};border-radius:4px;transition:width .5s cubic-bezier(.22,1,.36,1)}
        .site-nav{position:sticky;top:0;z-index:100;background:rgba(10,10,10,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.06)}
        .hero-section{padding-top:clamp(48px,5vw,72px) !important}
        @media(max-width:760px){
          .hide-sm{display:none !important}
          .nav-links{display:none}
          .portal-link{display:none}
          .nav-toggle{display:inline-flex}
          .nav-bar{min-height:58px;height:auto;padding-top:10px;padding-bottom:10px;gap:10px;flex-wrap:wrap}
          .nav-actions{margin-left:auto}
          .btn-sandbox{padding:10px 14px;font-size:13px}
          .sandbox-long{display:none}
          .sandbox-short{display:inline}
          .hero-h{font-size:15vw !important}
          .two{grid-template-columns:1fr !important}
          .two>div:first-child{border-right:none !important;border-bottom:1px solid ${LINE}}
          .verdict-grid{grid-template-columns:1fr}
          .map-dest{text-align:left;flex-basis:100% !important;margin-top:4px}
          .footer-inner{flex-direction:column;align-items:flex-start}
          .footer-note{max-width:none}
          .tab{font-size:13px;padding:9px 14px}
          .qa summary{padding:16px 0}
          .qa p{padding:0 0 18px 0 !important}
          .page{min-width:34px;height:34px;font-size:13px}
        }
        @media(max-width:420px){
          .btn{font-size:14px;padding:12px 20px}
          .disp.hero-h{font-size:14vw !important}
          .yearpick{flex-wrap:wrap;gap:8px;padding:10px 12px}
        }}
        @media(prefers-reduced-motion:reduce){.rise{transition:none;opacity:1;transform:none}.glow{animation:none}.viewfade{animation:none}}
      `}</style>

      <div className="glow" />

      <nav className="site-nav">
        <div className="nav-bar" style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between", height: 66 }}>
          <button className="lnk disp" onClick={() => go("home")} style={{ fontWeight: 700, fontSize: 19, color: TEXT, display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: AMBER, color: INK, display: "grid", placeItems: "center", fontSize: 14, transform: "rotate(-8deg)" }}>✈</span>
            Tax<span style={{ color: AMBER }}>Pilot</span>
          </button>
          <div className="nav-links" style={{ display: "flex", gap: 28 }}>
            {TOOLS.map(([v, label]) => (<button key={v} className={"lnk" + (view === v ? " on" : "")} onClick={() => go(v)}>{label}</button>))}
          </div>
          <div className="nav-actions">
            <button type="button" className="btn btn-sandbox" onClick={() => go("practice")}>
              <span className="sandbox-tag">Sandbox</span>
              <span className="sandbox-long">Practice portal</span>
              <span className="sandbox-short">Portal</span>
            </button>
            <button type="button" className="nav-toggle" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"}>
              {menuOpen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              )}
            </button>
          </div>
        </div>
        <div className={"nav-drawer" + (menuOpen ? " open" : "")} style={wrap}>
          <div className="nav-drawer-grid">
            <button type="button" className={"nav-item" + (view === "home" ? " on" : "")} onClick={() => go("home")}>Home</button>
            {TOOLS.map(([v, label]) => (
              <button key={v} type="button" className={"nav-item" + (view === v ? " on" : "")} onClick={() => go(v)}>{label}</button>
            ))}
            <button type="button" className="nav-item" onClick={() => go("practice")}>Practice portal</button>
          </div>
        </div>
      </nav>

      <div className="viewfade" key={view}>
        {view === "home" && <Home years={years} yi={yi} setYi={setYi} go={go} />}
        {view === "finder" && <Finder />}
        {view === "mapping" && <MappingPage go={go} />}
        {view === "calc" && <CalculatorPage ay={years[0].ay} />}
        {view === "solutions" && <SolutionsPage />}
        {view === "practice" && <PracticePortal onExit={() => go("home")} />}
      </div>

      <footer style={{ borderTop: `1px solid ${LINE}`, position: "relative", zIndex: 1 }}>
        <div className="footer-inner" style={{ ...wrap, paddingTop: 30, paddingBottom: 30 }}>
          <span className="disp" style={{ fontWeight: 700, fontSize: 15 }}>Tax<span style={{ color: AMBER }}>Pilot</span></span>
          <p className="footer-note">A learning companion for first-time filers, not tax advice. Figures reflect AY {years[0].ay}. Always verify against your own documents.</p>
        </div>
      </footer>
    </div>
  );
}

function Home({ years, yi, setYi, go }) {
  const yr = years[yi];
  useReveal("home");
  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <header className="hero-section" style={{ ...wrap, paddingTop: "clamp(48px,5vw,72px)", paddingBottom: "clamp(28px,4vw,40px)" }}>
        <div className="rise in" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <div className="yearpick">
            <span style={{ ...eye, color: FAINT }}>Filing for</span>
            <select value={yi} onChange={(e) => setYi(Number(e.target.value))} aria-label="Choose the year you are filing for">
              {years.map((y, i) => (<option key={y.ay} value={i}>AY {y.ay} (FY {y.fy}){y.current ? " · latest" : ""}</option>))}
            </select>
          </div>
          <span style={{ ...eye, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: AMBER }} />{yr.current ? "Return now open" : "Belated / updated return"}
          </span>
        </div>
        <h1 className="disp hero-h" style={{ fontSize: "clamp(3rem,8.4vw,6.6rem)", fontWeight: 600, lineHeight: 0.96, letterSpacing: "-0.025em", maxWidth: 920, marginTop: 0 }}>
          Tax season<br />without the <span style={{ color: AMBER }}>dread.</span>
        </h1>
        <p style={{ color: MUTE, fontSize: "clamp(1.1rem,2vw,1.32rem)", lineHeight: 1.55, maxWidth: 552, marginTop: 28 }}>
          The portal asks for numbers it never explains. TaxPilot translates it, so you know which form is yours, which regime keeps more, and what to do when something breaks.
        </p>
      </header>

      <section style={{ ...wrap, paddingBottom: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          {[
            ["01", "Find your form", "Four forms, one belongs to you. See who each fits, what rules it out, and which papers it needs.", "finder", "Open the finder"],
            ["02", "Practice the portal", "A sandbox that looks like the real e-Filing site. Walk the ITR wizard with fake credentials and live totals.", "practice", "Enter the sandbox"],
            ["03", "Compare regimes", "Old versus new is worth real money. Slide your income and see the tax both ways, slab by slab.", "calc", "Run the numbers"],
            ["04", "Fix what broke", "Refund stuck? Notice arrived? Search the problems every filer hits, each with a fix in plain words.", "solutions", "Browse solutions"],
          ].map(([n, t, d, v, cta], i) => (
            <button key={t} type="button" onClick={() => go(v)} className="rise card hovr" style={{ textAlign: "left", cursor: "pointer", padding: 28, display: "flex", flexDirection: "column", gap: 12, transitionDelay: (i * 70) + "ms" }}>
              <span className="mono" style={{ fontSize: 13, color: AMBER }}>{n}</span>
              <h3 className="disp card-title" style={{ fontSize: 22 }}>{t}</h3>
              <p style={{ color: MUTE, fontSize: 14.5, lineHeight: 1.55, flex: 1 }}>{d}</p>
              <span className="disp" style={{ fontSize: 14, fontWeight: 600, color: AMBER, marginTop: 6 }}>{cta} →</span>
            </button>
          ))}
        </div>
      </section>

      <section style={{ ...wrap, paddingTop: 60, paddingBottom: 90 }}>
        <div className="rise card" style={{ padding: "clamp(28px,4vw,48px)" }}>
          <div style={{ maxWidth: 560 }}>
            <div style={eye}>Why do this yourself</div>
            <h2 className="disp" style={{ fontSize: "clamp(1.6rem,3.2vw,2.3rem)", fontWeight: 600, marginTop: 12, lineHeight: 1.15 }}>Most salaried returns are simpler than they feel.</h2>
            <p style={{ color: MUTE, fontSize: 15.5, marginTop: 14, lineHeight: 1.6 }}>
              If your income is salary, interest and a bit of investing, you can file this yourself in one sitting. When it gets genuinely complex, business income, foreign assets, heavy capital gains, a CA earns their fee, and you will finally know what to ask them.
            </p>
            <a className="portal-link" href="https://eportal.incometax.gov.in" target="_blank" rel="noopener noreferrer" style={{ marginTop: 20, display: "inline-flex" }}>
              Open the e-Filing portal <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function Finder() {
  const [active, setActive] = useState("ITR2");
  const f = FORMS[active];
  useReveal(active);
  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <section style={{ ...wrap, paddingTop: 64, paddingBottom: 40 }}>
        <div className="rise in" style={{ marginBottom: 30 }}>
          <div style={eye}>Find my form</div>
          <h1 className="disp" style={h2s}>Your form is decided by <span style={{ color: AMBER }}>how</span> you earn, not how much.</h1>
          <p style={{ color: MUTE, fontSize: 16.5, marginTop: 14, maxWidth: 600, lineHeight: 1.6 }}>Pick the one that sounds like you. We will show who it fits, what quietly rules it out, and exactly which papers it needs.</p>
        </div>
        <div className="rise in" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          {Object.keys(FORMS).map((k) => (<button key={k} className={"tab" + (active === k ? " on" : "")} onClick={() => setActive(k)}>{FORMS[k].tag} · {FORMS[k].name}</button>))}
        </div>
        <div className="card viewfade" key={active} style={{ padding: "clamp(24px,4vw,42px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginBottom: 26 }}>
            <div>
              <div className="disp" style={{ fontSize: 27, fontWeight: 600 }}>{f.tag} <span style={{ color: MUTE, fontWeight: 400 }}>· {f.line}</span></div>
              <p style={{ color: MUTE, fontSize: 15.5, marginTop: 8, maxWidth: 460, lineHeight: 1.55 }}>{f.who}</p>
            </div>
            <div style={{ textAlign: "right" }}><div style={{ ...eye, marginBottom: 4 }}>Income</div><div className="disp" style={{ fontSize: 18, fontWeight: 600, color: AMBER }}>{f.income}</div></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 30 }}>
            <div>
              <div style={{ ...eye, color: AMBER, marginBottom: 14 }}>Fits you if</div>
              {f.fits.map((x) => (<div key={x} style={{ display: "flex", gap: 12, marginBottom: 11 }}><span className="dot" style={{ background: AMBER }} /><span style={{ fontSize: 15, lineHeight: 1.5 }}>{x}</span></div>))}
            </div>
            <div>
              <div style={{ ...eye, marginBottom: 14 }}>Not for you if</div>
              {f.breaks.map((x) => (<div key={x} style={{ display: "flex", gap: 12, marginBottom: 11 }}><span className="dot" style={{ background: FAINT }} /><span style={{ fontSize: 15, lineHeight: 1.5, color: MUTE }}>{x}</span></div>))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ ...wrap, paddingTop: 30, paddingBottom: 90 }}>
        <div className="rise" style={{ marginBottom: 24 }}>
          <div style={eye}>The papers {f.tag} needs</div>
          <h2 className="disp" style={{ fontSize: "clamp(1.5rem,3vw,2.1rem)", fontWeight: 600, marginTop: 10 }}>Gather only these. Nothing more.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
          {DOCS.filter((d) => d.forms.includes(active)).map((d, i) => (
            <div key={d.n} className="rise card" style={{ padding: 24, transitionDelay: (i * 40) + "ms" }}>
              <div className="disp card-title" style={{ fontSize: 18, marginBottom: 8 }}>{d.n}</div>
              <p style={{ color: MUTE, fontSize: 14.5, lineHeight: 1.55 }}>{d.why}</p>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${LINE}`, display: "flex", gap: 9 }}>
                <span className="mono" style={{ color: AMBER, fontSize: 12, flex: "none", marginTop: 1 }}>CHECK</span>
                <p style={{ color: FAINT, fontSize: 13.5, lineHeight: 1.5 }}>{d.check}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MappingPage({ go }) {
  const [form, setForm] = useState("ITR1");
  useReveal(form);
  const FILTERS = [["ITR1","ITR-1"],["ITR2","ITR-2"],["ITR3","ITR-3"],["ITR4","ITR-4"]];
  const groups = MAPPING
    .map((g) => ({ ...g, rows: g.rows.filter((r) => r.forms.includes(form)) }))
    .filter((g) => g.rows.length > 0);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <section style={{ ...wrap, paddingTop: 64, paddingBottom: 40 }}>
        <div className="rise in" style={{ marginBottom: 28, maxWidth: 660 }}>
          <div style={eye}>What goes where</div>
          <h1 className="disp" style={h2s}>Every number you hold, <span style={{ color: AMBER }}>and its box in the return.</span></h1>
          <p style={{ color: MUTE, fontSize: 16.5, marginTop: 14, lineHeight: 1.6 }}>
            Pick your form, then read down. Each row is a figure on one of your documents and the exact schedule it belongs to. Most of it is pre-filled, but this is how you check the portal did not miss anything.
          </p>
        </div>

        {/* form switch */}
        <div className="rise in" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
          <span style={{ ...eye, marginRight: 4 }}>Filing</span>
          {FILTERS.map(([k, label]) => (<button key={k} className={"tab" + (form === k ? " on" : "")} onClick={() => setForm(k)}>{label}</button>))}
        </div>
        <p className="rise in" style={{ color: FAINT, fontSize: 13, marginBottom: 26 }}>{total} things to map for {FORMS[form].tag}. Not sure which form? <button className="lnk" onClick={() => go("finder")} style={{ color: AMBER, fontSize: 13 }}>Find yours →</button></p>

        {/* grouped mapping */}
        <div className="viewfade" key={form} style={{ display: "grid", gap: 16 }}>
          {groups.map((g, gi) => (
            <div key={g.src} className="rise card" style={{ padding: "clamp(20px,3vw,30px)", transitionDelay: (gi * 50) + "ms" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10, marginBottom: 18, paddingBottom: 16, borderBottom: `1px solid ${LINE}` }}>
                <div className="disp card-title" style={{ fontSize: 19 }}>{g.src}</div>
                <span className="mono" style={{ ...eye, color: AMBER }}>{g.tag}</span>
              </div>
              {g.rows.map((r, ri) => (
                <div key={r.from} style={{ padding: "13px 0", borderBottom: ri < g.rows.length - 1 ? `1px solid ${LINE}` : "none" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 500, flex: "1 1 220px", minWidth: 0 }}>{r.from}</span>
                    <span className="mono" style={{ fontSize: 12, color: FAINT, flex: "none" }}>{"\u2192"}</span>
                    <span className="mono map-dest" style={{ fontSize: 12.5, color: AMBER, flex: "1 1 240px", lineHeight: 1.5 }}>{r.to}</span>
                  </div>
                  <p style={{ color: FAINT, fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>{r.note}</p>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="rise" style={{ marginTop: 24, padding: "16px 18px", borderRadius: 14, background: "rgba(255,184,77,0.04)", border: `1px solid rgba(255,184,77,0.16)` }}>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, color: MUTE }}>
            <strong style={{ color: TEXT }}>One rule above all:</strong> your claimed TDS must match Form 26AS to the rupee. If a figure here is not on your documents, do not invent it, and if it is on your documents but not in the pre-filled data, add it.
          </p>
        </div>
      </section>
    </div>
  );
}

function CalculatorPage({ ay }) {
  const [gross, setGross] = useState(1200000);
  const [salaried, setSalaried] = useState(true);
  const [ded, setDed] = useState(150000);
  useReveal("calc");

  const N = compute("new", gross, salaried, ded);
  const O = compute("old", gross, salaried, ded);
  const better = N.total <= O.total ? "new" : "old";
  const save = Math.abs(N.total - O.total);
  const B = better === "new" ? N : O;
  const eff = B.ti > 0 ? (B.total / gross * 100) : 0;

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <section style={{ ...wrap, paddingTop: 64, paddingBottom: 40 }}>
        <div className="rise in" style={{ marginBottom: 30 }}>
          <div style={eye}>Regime calculator · AY {ay}</div>
          <h1 className="disp" style={h2s}>One choice quietly decides <span style={{ color: AMBER }}>how much you keep.</span></h1>
          <p style={{ color: MUTE, fontSize: 16.5, marginTop: 14, maxWidth: 620, lineHeight: 1.6 }}>Old regime rewards your deductions. New regime rewards simplicity. Move the slider and watch both add up, live, slab by slab.</p>
        </div>

        <div className="rise in card two" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", overflow: "hidden" }}>
          {/* inputs */}
          <div style={{ padding: "clamp(24px,3.5vw,38px)", borderRight: `1px solid ${LINE}` }}>
            <label style={{ ...eye, display: "block", marginBottom: 10 }}>Gross annual income</label>
            <span className="disp" style={{ fontSize: 32, fontWeight: 600, color: AMBER }}>{inr(gross)}</span>
            <input type="range" min="300000" max="5000000" step="50000" value={gross} onChange={(e) => setGross(Number(e.target.value))} aria-label="Gross annual income" />
            <div style={{ display: "flex", justifyContent: "space-between", ...eye, marginTop: 8 }}><span>3L</span><span>50L</span></div>

            <div style={{ marginTop: 26 }}>
              <label className="chk"><input type="checkbox" checked={salaried} onChange={(e) => setSalaried(e.target.checked)} /> Salaried or pensioner (standard deduction)</label>
            </div>

            <div style={{ marginTop: 26 }}>
              <label style={{ ...eye, display: "block", marginBottom: 8 }}>Old-regime deductions</label>
              <input className="fld" type="number" value={ded} min="0" step="10000" onChange={(e) => setDed(Number(e.target.value) || 0)} aria-label="Total old regime deductions" />
              <p style={{ color: FAINT, fontSize: 12.5, marginTop: 8, lineHeight: 1.5 }}>Add up 80C, 80D, HRA and home-loan interest. The new regime ignores all of these, that is the whole trade-off.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {[0, 150000, 250000, 400000].map((v) => (<button key={v} className={"pill" + (ded === v ? " on" : "")} onClick={() => setDed(v)}>{v === 0 ? "None" : inrShort(v)}</button>))}
              </div>
            </div>
          </div>

          {/* verdict + breakdown */}
          <div style={{ padding: "clamp(24px,3.5vw,38px)" }}>
            <div className="verdict-grid">
              <Verdict label="New regime" total={N.total} win={better === "new"} />
              <Verdict label="Old regime" total={O.total} win={better === "old"} />
            </div>

            <div style={{ marginTop: 16, padding: "16px 18px", borderRadius: 14, background: "rgba(123,216,143,0.05)", border: `1px solid rgba(123,216,143,0.18)` }}>
              {save === 0
                ? <p style={{ fontSize: 15, lineHeight: 1.5 }}>Dead heat. Pick the <strong style={{ color: GOOD }}>new regime</strong>, less paperwork, same tax.</p>
                : <p style={{ fontSize: 15, lineHeight: 1.5 }}>The <strong style={{ color: GOOD }}>{better} regime</strong> keeps <strong className="disp" style={{ color: GOOD }}>{inr(save)}</strong> more in your pocket this year.</p>}
            </div>

            {/* smart breakdown of the winning regime */}
            <div style={{ marginTop: 22 }}>
              <div style={{ ...eye, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
                <span>How the {better} tax builds up</span><span style={{ color: AMBER }}>{eff.toFixed(1)}% effective</span>
              </div>
              <Line label="Gross income" val={inr(gross)} />
              <Line label={"Standard deduction" + (B.sd ? "" : " (n/a)")} val={B.sd ? "– " + inr(B.sd) : "–"} sub />
              {better === "old" && <Line label="Your deductions" val={B.ded ? "– " + inr(B.ded) : "–"} sub />}
              <Line label="Taxable income" val={inr(B.ti)} strong />

              <div style={{ margin: "16px 0 8px", ...eye }}>Tax by slab</div>
              {B.rows.length === 0
                ? <p style={{ color: GOOD, fontSize: 14 }}>No tax in any slab, you are under the taxable limit.</p>
                : B.rows.map((r, i) => {
                    const maxT = Math.max(...B.rows.map((x) => x.t));
                    return (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: MUTE, marginBottom: 5 }}>
                          <span className="mono">{inrShort(r.lo)}–{r.hi === Infinity ? "∞" : inrShort(r.hi)} @ {(r.rate * 100)}%</span>
                          <span className="mono" style={{ color: TEXT }}>{inr(r.t)}</span>
                        </div>
                        <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4 }}><div className="bar" style={{ width: (maxT ? (r.t / maxT * 100) : 0) + "%" }} /></div>
                      </div>
                    );
                  })}

              {B.rebate > 0 && <Line label="Section 87A rebate" val={"– " + inr(B.rebate)} good />}
              {B.marginal > 0 && <Line label="Marginal relief" val={"– " + inr(B.marginal)} good />}
              {B.base > 0 && <Line label="Health & education cess (4%)" val={"+ " + inr(B.cess)} sub />}
              <div style={{ marginTop: 10, paddingTop: 14, borderTop: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="disp" style={{ fontSize: 15, fontWeight: 600 }}>Total tax ({better})</span>
                <span className="disp" style={{ fontSize: 26, fontWeight: 600, color: B.total ? AMBER : GOOD }}>{B.total ? inr(B.total) : "Rs 0"}</span>
              </div>
              <p style={{ color: FAINT, fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>That is about {inr(B.total / 12)} a month. Estimate for a resident individual under 60, excludes surcharge and special-rate income like capital gains.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Verdict({ label, total, win }) {
  return (
    <div style={{ border: `1px solid ${win ? GOOD : LINE}`, background: win ? "rgba(123,216,143,0.05)" : "transparent", borderRadius: 14, padding: "16px 16px" }}>
      <div className="disp" style={{ fontSize: 13.5, fontWeight: 600 }}>{label} {win && <span className="mono" style={{ color: GOOD, fontSize: 11, marginLeft: 4 }}>BEST</span>}</div>
      <div className="disp" style={{ fontSize: 23, fontWeight: 600, marginTop: 6, color: win ? GOOD : TEXT }}>{total ? inr(total) : "Rs 0"}</div>
    </div>
  );
}

function Line({ label, val, sub, strong, good }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: strong ? 15 : 13.5 }}>
      <span style={{ color: strong ? TEXT : MUTE, fontWeight: strong ? 600 : 400 }} className={strong ? "disp" : ""}>{label}</span>
      <span className="mono" style={{ color: good ? GOOD : strong ? TEXT : MUTE }}>{val}</span>
    </div>
  );
}

function SolutionsPage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const [page, setPage] = useState(1);
  const perPage = 6;
  const cats = useMemo(() => ["All", ...Array.from(new Set(SOLUTIONS.map((s) => s.cat)))], []);
  useReveal("sol");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SOLUTIONS.filter((s) => (cat === "All" || s.cat === cat) && (!q || (s.q + " " + s.a + " " + s.cat).toLowerCase().includes(q)));
  }, [query, cat]);
  useEffect(() => { setPage(1); }, [query, cat]);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const cur = Math.min(page, pages);
  const shown = filtered.slice((cur - 1) * perPage, cur * perPage);

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <section style={{ ...wrap, paddingTop: 64, paddingBottom: 90 }}>
        <div className="rise in" style={{ marginBottom: 26 }}>
          <div style={eye}>Solutions</div>
          <h1 className="disp" style={h2s}>Something went wrong? <span style={{ color: AMBER }}>You are not the first.</span></h1>
          <p style={{ color: MUTE, fontSize: 16.5, marginTop: 14, maxWidth: 620, lineHeight: 1.6 }}>Every problem here is one thousands of filers hit each year. Search yours, read the fix in plain words, act with confidence.</p>
        </div>

        <div className="rise in" style={{ marginBottom: 16 }}>
          <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: refund, TDS mismatch, 139(9), UPI, verification…" aria-label="Search solutions" />
        </div>
        <div className="rise in" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {cats.map((c) => (<button key={c} className={"pill" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{c}</button>))}
        </div>

        <div className="viewfade" key={cur + query + cat}>
          {shown.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: "center" }}>
              <p className="disp card-title" style={{ fontSize: 18 }}>Nothing matches that yet.</p>
              <p style={{ color: MUTE, fontSize: 14.5, marginTop: 8 }}>Try a broader word like "refund", "mismatch" or "notice", or clear the filter.</p>
            </div>
          ) : shown.map((s) => (
            <details key={s.q} className="qa card" style={{ padding: "0 22px", marginBottom: 12 }}>
              <summary>
                <span className="qmark">▸</span>
                <span style={{ flex: 1 }}>
                  <span className="mono" style={{ color: AMBER, display: "block", marginBottom: 6, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>{s.cat}</span>
                  <span className="disp" style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.4 }}>{s.q}</span>
                </span>
              </summary>
              <p style={{ color: MUTE, fontSize: 15, lineHeight: 1.65, padding: "0 0 22px 32px" }}>{s.a}</p>
            </details>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginTop: 24 }}>
          <span style={{ color: FAINT, fontSize: 13.5 }}>
            {filtered.length} {filtered.length === 1 ? "solution" : "solutions"}{(query || cat !== "All") ? ` of ${SOLUTIONS.length}` : " in the library"} · page {cur} of {pages}
          </span>
          {pages > 1 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="page" onClick={() => setPage(cur - 1)} disabled={cur === 1} aria-label="Previous page">←</button>
              {Array.from({ length: pages }, (_, i) => (<button key={i} className={"page" + (cur === i + 1 ? " on" : "")} onClick={() => setPage(i + 1)}>{i + 1}</button>))}
              <button className="page" onClick={() => setPage(cur + 1)} disabled={cur === pages} aria-label="Next page">→</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
