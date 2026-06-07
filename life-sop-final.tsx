import { useState, useEffect, useCallback } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://qlghosdywgkoadjdynhe.supabase.co";
const SUPABASE_ANON = "sb_publishable_AOyi8zm3TUg2r07JM75Szg_BO8wPxPg";

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=representation",
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function loadFromSupabase(weekKey) {
  try {
    const rows = await sbFetch(`/habits?week_key=eq.${weekKey}&select=day_index,habit_id,checked`);
    const map = {};
    for (const r of rows) map[`${r.day_index}_${r.habit_id}`] = r.checked;
    return map;
  } catch { return null; }
}

async function upsertHabit(weekKey, dayIndex, habitId, checked) {
  try {
    await sbFetch("/habits", {
      method: "POST",
      body: JSON.stringify({ week_key: weekKey, day_index: dayIndex, habit_id: habitId, checked, updated_at: new Date().toISOString() }),
    });
    return true;
  } catch { return false; }
}

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#0d0d0d", surface:"#141414", card:"#1a1a1a", border:"#2a2a2a",
  accent:"#c8f545", text:"#f0f0e8", muted:"#888880",
  danger:"#ff4d4d", warn:"#f5a623", info:"#45c8f5", purple:"#b845f5", gold:"#FFD700",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const Box = ({ children, style }) => (
  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"20px 24px", marginBottom:16, ...style }}>{children}</div>
);
const Mono = ({ children, color }) => (
  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:2, color:color||C.muted, textTransform:"uppercase" }}>{children}</span>
);
const Tag = ({ children, color }) => (
  <span style={{ background:(color||C.muted)+"22", color:color||C.muted, border:`1px solid ${(color||C.muted)}44`, borderRadius:4, padding:"2px 8px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", letterSpacing:1, fontWeight:700, textTransform:"uppercase" }}>{children}</span>
);
const SH = ({ children }) => (
  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:3, color:C.accent, textTransform:"uppercase", borderBottom:`1px solid ${C.border}`, paddingBottom:8, marginBottom:12, marginTop:28 }}>{children}</div>
);
const Row = ({ time, title, desc, accent, tag, tagColor }) => (
  <div style={{ display:"flex", gap:14, padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
    <div style={{ minWidth:95, fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:C.muted, paddingTop:3 }}>{time}</div>
    <div style={{ flex:1, borderLeft:`3px solid ${accent||C.border}`, paddingLeft:14 }}>
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:desc?4:0 }}>
        <span style={{ color:C.text, fontWeight:600, fontSize:14 }}>{title}</span>
        {tag && <Tag color={tagColor}>{tag}</Tag>}
      </div>
      {desc && <div style={{ color:C.muted, fontSize:13, lineHeight:1.6 }}>{desc}</div>}
    </div>
  </div>
);
const Quote = ({ text, author, color }) => (
  <div style={{ borderLeft:`4px solid ${color||C.gold}`, paddingLeft:20, margin:"16px 0" }}>
    <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:18, color:C.text, lineHeight:1.6, marginBottom:8, fontStyle:"italic" }}>"{text}"</div>
    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:color||C.gold, letterSpacing:2 }}>— {author}</div>
  </div>
);

// ─── DATA ─────────────────────────────────────────────────────────────────────
const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY_TYPES  = ["wd","wd","wd","wd","wd","we","we"];

function getWeekKey() {
  const now = new Date();
  const d = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((d+6)%7));
  return mon.toISOString().slice(0,10);
}
function getTodayIdx() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

const WD_SCHEDULE = [
  { time:"03:30",       title:"Wake up — no snooze",         desc:"Alarm across the room. Get up immediately. Everything downstream depends on this.",   accent:C.accent, tag:"ANCHOR",   tagColor:C.accent },
  { time:"03:30–03:40", title:"Water + supplements",          desc:"32oz water. Creatine 5g, multivitamin, D3.",                                          accent:C.info },
  { time:"03:40–04:00", title:"Morning journal",              desc:"Brain dump 2 pages. 3 wins for today. 1 gratitude. Pen on paper.",                    accent:C.purple, tag:"JOURNAL",  tagColor:C.purple },
  { time:"04:00–04:20", title:"Read",                         desc:"Physical book or Kindle only. No phone.",                                             accent:C.purple, tag:"READ",     tagColor:C.purple },
  { time:"04:20–04:30", title:"Mobility / warmup",            desc:"Hip flexors, T-spine, shoulder circles, cat-cow. 10 min.",                           accent:C.warn,   tag:"MOBILITY", tagColor:C.warn },
  { time:"04:30–05:20", title:"Workout",                      desc:"50 min. See Workouts tab. Banana + protein shake pre-workout.",                       accent:C.danger, tag:"TRAIN",    tagColor:C.danger },
  { time:"05:20–05:35", title:"Shower + get ready",           desc:"Cold 30s finish. Clothes already laid out.",                                          accent:C.info },
  { time:"05:35–05:48", title:"Breakfast (700+ cal)",         desc:"Overnight oats + eggs + yogurt. Pre-staged Sunday.",                                  accent:C.warn,   tag:"EAT",      tagColor:C.warn },
  { time:"05:48–05:50", title:"Quick AM dog walk 🐕",         desc:"5 min around the block.",                                                            accent:C.accent, tag:"🐕",       tagColor:C.accent },
  { time:"05:50",       title:"Leave for work",               desc:"Everything staged the night before. Bag packed. Lunch packed. Out the door.",          accent:C.accent, tag:"ANCHOR",   tagColor:C.accent },
  { time:"05:50–07:00", title:"Commute — study",              desc:"Mon/Wed/Fri: Professor Messer audio. Tue/Thu: audiobook.",                            accent:C.info,   tag:"SEC+",     tagColor:C.info },
  { time:"07:00–15:00", title:"Work",                         desc:"Two 90-min deep work blocks. Pomodoro 50/10. Eat prepped lunch — no skipping.",       accent:C.muted },
  { time:"15:00–16:00", title:"Commute home",                 desc:"Mon/Wed: Messer audio. Tue/Thu: music only. Fri: week review.",                       accent:C.info,   tag:"SEC+",     tagColor:C.info },
  { time:"16:00–16:15", title:"Transition ritual",            desc:"Change clothes. Work-brain off. Home-brain on.",                                      accent:C.muted },
  { time:"16:15–17:00", title:"Dog walk 🐕",                  desc:"After sun goes down — cooler. 30–45 min. No podcast. Just you and the dog.",          accent:C.accent, tag:"NON-NEG",  tagColor:C.accent },
  { time:"17:00–18:10", title:"Sec+ study block",             desc:"Active recall: Anki, practice questions, write from memory. No passive review.",      accent:C.info,   tag:"SEC+",     tagColor:C.info },
  { time:"18:10–19:00", title:"Dinner (900+ cal)",            desc:"Meal-prepped. Table only, no screens.",                                               accent:C.warn,   tag:"EAT",      tagColor:C.warn },
  { time:"19:00–19:45", title:"Free time",                    desc:"TV, games, YouTube. You earned it.",                                                  accent:C.muted },
  { time:"19:45–20:15", title:"Evening study block",          desc:"Domain review or 65-question timed exam. Week 3+: full exams only.",                  accent:C.info,   tag:"SEC+",     tagColor:C.info },
  { time:"20:15–20:35", title:"Night staging",                desc:"Lay out clothes. Pack bag + lunch. Stage breakfast.",                                 accent:C.muted },
  { time:"20:35–20:45", title:"Evening journal",              desc:"Did you do what you said? One sentence fix for tomorrow.",                            accent:C.purple, tag:"JOURNAL",  tagColor:C.purple },
  { time:"20:45",       title:"Lights out",                   desc:"Phone across the room. 8+ hrs sleep.",                                                accent:C.accent, tag:"SLEEP",    tagColor:C.accent },
];
const WE_SAT_SCHEDULE = [
  { time:"06:00",       title:"Wake up",                      desc:"No later than 07:00.",                                                                accent:C.accent, tag:"ANCHOR",   tagColor:C.accent },
  { time:"06:00–06:15", title:"Water + supplements",          desc:"",                                                                                   accent:C.info },
  { time:"06:15–06:45", title:"Journal + weekly review",      desc:"What did you accomplish? What slipped? Rate week 1–10.",                            accent:C.purple, tag:"JOURNAL",  tagColor:C.purple },
  { time:"06:45–07:15", title:"Read",                         desc:"",                                                                                   accent:C.purple, tag:"READ",     tagColor:C.purple },
  { time:"07:15–07:45", title:"Breakfast",                    desc:"Big, slow, enjoyable. Still hit calorie targets.",                                   accent:C.warn,   tag:"EAT",      tagColor:C.warn },
  { time:"07:45–09:00", title:"Workout / active recovery",    desc:"Longer session — no rush.",                                                          accent:C.danger, tag:"TRAIN",    tagColor:C.danger },
  { time:"09:00–09:30", title:"Shower + ready",               desc:"",                                                                                   accent:C.muted },
  { time:"09:30–11:30", title:"Flex block",                   desc:"Errands, social, hobbies. True recharge.",                                          accent:C.muted },
  { time:"11:30–12:30", title:"Lunch",                        desc:"Eat big. 20 min nap max.",                                                           accent:C.warn,   tag:"EAT",      tagColor:C.warn },
  { time:"12:30–14:30", title:"Sec+ deep session",            desc:"Longest block of the week. 2x full exams with error analysis.",                      accent:C.info,   tag:"SEC+",     tagColor:C.info },
  { time:"14:30–17:30", title:"Free time",                    desc:"No guilt. Recharge.",                                                                accent:C.muted },
  { time:"17:30–18:30", title:"Dog walk 🐕",                  desc:"Evening walk — cooler temps.",                                                      accent:C.accent, tag:"NON-NEG",  tagColor:C.accent },
  { time:"18:30–21:00", title:"Dinner + wind-down",           desc:"",                                                                                   accent:C.muted },
  { time:"21:00",       title:"Sleep",                        desc:"",                                                                                   accent:C.accent, tag:"SLEEP",    tagColor:C.accent },
];
const WE_SUN_SCHEDULE = [
  { time:"06:30",       title:"Wake up",                      desc:"",                                                                                   accent:C.accent, tag:"ANCHOR",   tagColor:C.accent },
  { time:"06:30–07:00", title:"Water, supplements, journal",  desc:"Set week intentions. 3 priorities.",                                                 accent:C.purple },
  { time:"07:00–07:30", title:"Read",                         desc:"",                                                                                   accent:C.purple, tag:"READ",     tagColor:C.purple },
  { time:"07:30–08:30", title:"Breakfast + get ready",        desc:"",                                                                                   accent:C.warn,   tag:"EAT",      tagColor:C.warn },
  { time:"09:00–12:00", title:"CHURCH",                       desc:"Non-negotiable. Fully present — phone silent.",                                     accent:C.accent, tag:"NON-NEG",  tagColor:C.accent },
  { time:"12:00–13:00", title:"Post-church lunch",            desc:"Eat out if you want. High protein.",                                                 accent:C.warn,   tag:"EAT",      tagColor:C.warn },
  { time:"13:00–16:00", title:"MEAL PREP",                    desc:"Batch cook for all 5 weekdays.",                                                     accent:C.accent, tag:"NON-NEG",  tagColor:C.accent },
  { time:"16:00–17:00", title:"Rest / decompress",            desc:"",                                                                                   accent:C.muted },
  { time:"17:00–18:00", title:"Week staging",                 desc:"Lay out clothes M–F. Pack bag. Review calendar. Write study topics.",                accent:C.muted },
  { time:"18:00–19:30", title:"Dog walk + dinner + wind-down",desc:"Evening walk. Dim lights at 19:00.",                                                 accent:C.accent, tag:"NON-NEG",  tagColor:C.accent },
  { time:"20:00",       title:"Lights out",                   desc:"Monday 3:30am hits hard. Protect this sleep.",                                      accent:C.accent, tag:"ANCHOR",   tagColor:C.accent },
];

const WD_HABITS = [
  { id:"wake",     label:"3:30am wake — no snooze",               color:C.accent },
  { id:"water",    label:"Water + supplements",                    color:C.info },
  { id:"journal",  label:"Morning journal",                        color:C.purple },
  { id:"read",     label:"Morning read",                           color:C.purple },
  { id:"mobility", label:"Mobility / warmup",                      color:C.warn },
  { id:"workout",  label:"Workout",                                color:C.danger },
  { id:"bfast",    label:"Breakfast (700+ cal)",                   color:C.warn },
  { id:"dogam",    label:"AM dog walk (quick)",                    color:C.accent },
  { id:"commute",  label:"Commute study",                          color:C.info },
  { id:"lunch",    label:"Lunch eaten — no skipping",              color:C.warn },
  { id:"dogwalk",  label:"Evening dog walk 🐕",                    color:C.accent },
  { id:"study1",   label:"Sec+ study block 1",                     color:C.info },
  { id:"dinner",   label:"Dinner (900+ cal)",                      color:C.warn },
  { id:"study2",   label:"Sec+ study block 2",                     color:C.info },
  { id:"stage",    label:"Night staging (clothes + bag + lunch)",  color:C.muted },
  { id:"ejournal", label:"Evening journal",                        color:C.purple },
  { id:"sleep",    label:"Lights out by 20:45",                    color:C.accent },
];
const WE_HABITS = [
  { id:"wake",     label:"Wake up (no later than 07:00)",          color:C.accent },
  { id:"water",    label:"Water + supplements",                    color:C.info },
  { id:"journal",  label:"Journal + weekly review",                color:C.purple },
  { id:"read",     label:"Read",                                   color:C.purple },
  { id:"workout",  label:"Workout or active recovery",             color:C.danger },
  { id:"dogwalk",  label:"Dog walk 🐕",                            color:C.accent },
  { id:"study",    label:"Sec+ study session",                     color:C.info },
  { id:"cals",     label:"Hit calorie targets",                    color:C.warn },
  { id:"church",   label:"Church (Sunday)",                        color:C.accent },
  { id:"mealprep", label:"Meal prep (Sunday)",                     color:C.accent },
  { id:"staging",  label:"Week staging (Sunday)",                  color:C.muted },
];

const DAILY_QUOTES = [
  { text:"The moment you give up is the moment you let someone else win.", author:"Kobe Bryant", color:C.purple },
  { text:"I really think a champion is defined not by their wins but by how they can recover when they fall.", author:"Serena Williams", color:C.danger },
  { text:"Don't be afraid of failure. This is the way to succeed.", author:"LeBron James", color:C.warn },
  { text:"You get what you are, not what you want.", author:"Myron Golden", color:C.gold },
  { text:"Hard work beats talent when talent doesn't work hard.", author:"Kevin Durant", color:C.info },
  { text:"I am going to show you how great I am.", author:"Muhammad Ali", color:C.gold },
  { text:"Take care of your body. It's the only place you have to live.", author:"Jim Rohn", color:C.accent },
];

const WD_WORKOUT_OF_DAY = [
  { day:"MON", name:"Upper Body Calisthenics", color:C.danger,
    exercises:["Push-up progression — 4×10–15","Dead hang → Scapular pulls → Assisted pull-up — 4×5–10","Pike Push-up — 3×8–10","Dumbbell Rows — 3×12","Plank holds — 3×30–45s"] },
  { day:"TUE", name:"Lower Body + Glutes", color:C.warn,
    exercises:["Goblet Squat — 4×15–20","Romanian Deadlift — 4×10–12","Reverse Lunges — 3×10 each","Glute Bridge / Hip Thrust — 4×15","Single-leg Calf raises — 3×15 each"] },
  { day:"WED", name:"Push + Core", color:C.info,
    exercises:["Push-up (hardest variation) — 5×8–12","Overhead Press — 4×8–10","Dips — 3×8–12","Hollow body hold — 3×20–30s","Dead bug — 3×8 each","L-sit / tuck sit — 3×10–15s"] },
  { day:"THU", name:"Pull + Posterior Chain", color:C.purple,
    exercises:["Pull-up progression — 5×5–8","Inverted Row — 4×10–12","Face pulls — 3×15","Single-leg RDL — 3×8 each","Superman holds — 3×10"] },
  { day:"FRI", name:"Full Body + Conditioning", color:C.accent,
    exercises:["Burpees — 3×8–10","Squat to Press — 4×10","Push-up to Renegade Row — 3×6 each","Step-ups — 3×12 each leg","Mountain climbers — 3×20","Farmer carries — 3×30s"] },
];

// ─── SYNC STATUS INDICATOR ────────────────────────────────────────────────────
function SyncDot({ status }) {
  const colors = { synced:C.accent, syncing:C.warn, offline:C.danger, idle:C.muted };
  const labels = { synced:"SYNCED", syncing:"SYNCING…", offline:"OFFLINE", idle:"" };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ width:7, height:7, borderRadius:"50%", background:colors[status]||C.muted,
        boxShadow: status==="syncing" ? `0 0 6px ${C.warn}` : status==="synced" ? `0 0 6px ${C.accent}66` : "none",
        transition:"all .3s" }} />
      <Mono color={colors[status]}>{labels[status]}</Mono>
    </div>
  );
}

// ─── HABIT CHECKBOX (shared) ──────────────────────────────────────────────────
function HabitCheck({ habit, checked, onToggle }) {
  return (
    <div onClick={onToggle} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", background:checked?habit.color+"11":C.card, border:`1px solid ${checked?habit.color+"44":C.border}`, borderRadius:8, cursor:"pointer", transition:"all .15s", userSelect:"none" }}>
      <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${checked?habit.color:C.border}`, background:checked?habit.color:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .15s" }}>
        {checked && <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4L4.5 7.5L11 1" stroke="#0d0d0d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <span style={{ color:checked?C.muted:C.text, fontSize:14, textDecoration:checked?"line-through":"none", transition:"all .15s", flex:1 }}>{habit.label}</span>
      <div style={{ width:6, height:6, borderRadius:"50%", background:habit.color, opacity:checked?0.3:0.7, flexShrink:0 }} />
    </div>
  );
}

// ─── TODAY TAB ────────────────────────────────────────────────────────────────
function TodayTab({ checked, onToggle, syncStatus }) {
  const now = new Date();
  const dayIdx = getTodayIdx();
  const isWeekend = DAY_TYPES[dayIdx] === "we";
  const isSunday  = dayIdx === 6;
  const habits    = isWeekend ? WE_HABITS : WD_HABITS;
  const schedule  = isWeekend ? (isSunday ? WE_SUN_SCHEDULE : WE_SAT_SCHEDULE) : WD_SCHEDULE;
  const todayWorkout = !isWeekend ? WD_WORKOUT_OF_DAY[dayIdx] : null;
  const doy = Math.floor((now - new Date(now.getFullYear(),0,0)) / 86400000);
  const quote = DAILY_QUOTES[doy % DAILY_QUOTES.length];

  const done  = habits.filter(h => checked[`${dayIdx}_${h.id}`]).length;
  const total = habits.length;
  const pct   = total > 0 ? Math.round(done/total*100) : 0;

  const [nowStr, setNowStr] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  });
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNowStr(`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`);
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const parseTime = (t) => { const p = t.split("–")[0].trim().split(":").map(Number); return p[0]*60+(p[1]||0); };
  const nowMins = parseInt(nowStr.split(":")[0])*60 + parseInt(nowStr.split(":")[1]);
  let currentIdx = -1;
  for (let i = 0; i < schedule.length-1; i++) {
    if (nowMins >= parseTime(schedule[i].time) && nowMins < parseTime(schedule[i+1].time)) { currentIdx = i; break; }
  }

  const dateStr = now.toLocaleDateString("en-US",{ month:"long", day:"numeric" });
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

  return (
    <div>
      {/* Hero */}
      <div style={{ background:"linear-gradient(135deg,#0d1a00,#1a2e00,#0d1a00)", border:`1px solid ${C.accent}33`, borderRadius:14, padding:"28px 24px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8, marginBottom:12 }}>
          <div>
            <div style={{ background:C.accent+"18", border:`1px solid ${C.accent}44`, borderRadius:6, padding:"2px 10px", display:"inline-block", marginBottom:8 }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:C.accent, fontWeight:700, letterSpacing:1 }}>DAY {dayOfYear}</span>
            </div>
            <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:"clamp(22px,4vw,36px)", color:C.text, marginBottom:6 }}>{dateStr}</div>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:26, color:C.accent, fontWeight:700 }}>{nowStr}</div>
              <Tag color={isWeekend?(isSunday?C.gold:C.warn):C.info}>{isWeekend?(isSunday?"SUNDAY":"SATURDAY"):DAY_LABELS[dayIdx]+" WEEKDAY"}</Tag>
            </div>
          </div>
          <SyncDot status={syncStatus} />
        </div>

        {/* Progress ring */}
        <div style={{ display:"flex", alignItems:"center", gap:20, marginTop:16, flexWrap:"wrap" }}>
          <div style={{ position:"relative", width:76, height:76, flexShrink:0 }}>
            <svg width="76" height="76" viewBox="0 0 76 76">
              <circle cx="38" cy="38" r="32" fill="none" stroke={C.border} strokeWidth="7"/>
              <circle cx="38" cy="38" r="32" fill="none" stroke={pct===100?C.accent:C.info} strokeWidth="7"
                strokeDasharray={`${2*Math.PI*32}`} strokeDashoffset={`${2*Math.PI*32*(1-pct/100)}`}
                strokeLinecap="round" transform="rotate(-90 38 38)" style={{ transition:"stroke-dashoffset .5s ease" }}/>
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'JetBrains Mono',monospace", fontSize:14, color:pct===100?C.accent:C.text, fontWeight:700 }}>{pct}%</div>
          </div>
          <div>
            <div style={{ color:C.text, fontWeight:700, fontSize:16 }}>{done} / {total} habits</div>
            <div style={{ color:C.muted, fontSize:13, marginTop:3 }}>
              {pct===100?"🔥 Perfect day. That's the system.":pct>=60?"You're in it. Keep going.":pct>=30?"Good start. Don't stop here.":"First block is the hardest. Go."}
            </div>
          </div>
        </div>
      </div>

      {/* Quote */}
      <Quote text={quote.text} author={quote.author} color={quote.color} />

      {/* Mantra strip */}
      <div style={{ display:"flex", marginBottom:20, borderRadius:8, overflow:"hidden", border:`1px solid ${C.border}` }}>
        {[{w:"BE",c:C.accent},{w:"DO",c:C.info},{w:"HAVE",c:C.gold}].map((p,i)=>(
          <div key={p.w} style={{ flex:1, background:p.c+"11", padding:"12px 0", textAlign:"center", borderRight:i<2?`1px solid ${C.border}`:"none" }}>
            <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:22, color:p.c }}>{p.w}</div>
          </div>
        ))}
      </div>

      {/* Today's workout */}
      {todayWorkout && <>
        <SH>TODAY'S WORKOUT — {todayWorkout.day}</SH>
        <Box style={{ borderLeft:`4px solid ${todayWorkout.color}` }}>
          <div style={{ fontWeight:700, color:C.text, fontSize:15, marginBottom:12 }}>{todayWorkout.name}</div>
          {todayWorkout.exercises.map((ex,i)=>(
            <div key={i} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:`1px solid ${C.border}`, alignItems:"center" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:todayWorkout.color, flexShrink:0 }}/>
              <span style={{ color:C.muted, fontSize:13 }}>{ex}</span>
            </div>
          ))}
        </Box>
      </>}

      {/* Habit checklist */}
      <SH>TODAY'S HABITS</SH>
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:24 }}>
        {habits.map(h => (
          <HabitCheck key={h.id} habit={h} checked={!!checked[`${dayIdx}_${h.id}`]} onToggle={() => onToggle(dayIdx, h.id)} />
        ))}
      </div>

      {/* Schedule with NOW pointer */}
      <SH>TODAY'S SCHEDULE</SH>
      {schedule.map((block,i) => {
        const isCurrent = i === currentIdx;
        return (
          <div key={i} style={{ display:"flex", gap:14, padding:"12px 0", paddingLeft:isCurrent?8:0, borderBottom:`1px solid ${C.border}`, background:isCurrent?(block.accent||C.info)+"0a":"transparent", borderRadius:isCurrent?6:0, transition:"background .3s" }}>
            <div style={{ minWidth:95, fontFamily:"'JetBrains Mono',monospace", fontSize:11, paddingTop:3, color:isCurrent?(block.accent||C.info):C.muted, fontWeight:isCurrent?700:400 }}>
              {isCurrent && "▶ "}{block.time}
            </div>
            <div style={{ flex:1, borderLeft:`3px solid ${isCurrent?(block.accent||C.info):block.accent||C.border}`, paddingLeft:14 }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:block.desc?4:0 }}>
                <span style={{ color:C.text, fontWeight:isCurrent?700:600, fontSize:isCurrent?15:14 }}>{block.title}</span>
                {block.tag && <Tag color={block.tagColor}>{block.tag}</Tag>}
                {isCurrent && <Tag color={block.accent||C.info}>NOW</Tag>}
              </div>
              {block.desc && <div style={{ color:C.muted, fontSize:13, lineHeight:1.6 }}>{block.desc}</div>}
            </div>
          </div>
        );
      })}

      {done===total && total>0 && (
        <Box style={{ marginTop:24, background:C.accent+"11", borderColor:C.accent+"55", textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🔥</div>
          <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:24, color:C.accent, marginBottom:6 }}>Perfect {DAY_LABELS[dayIdx]}.</div>
          <div style={{ color:C.muted, fontSize:14 }}>BE. DO. HAVE. — that's what it looks like.</div>
        </Box>
      )}
    </div>
  );
}

// ─── TRACKER TAB ─────────────────────────────────────────────────────────────
function TrackerTab({ checked, onToggle, syncStatus }) {
  const wk = getWeekKey();
  const todayIdx = getTodayIdx();
  const [activeDay, setActiveDay] = useState(todayIdx);
  const habits = DAY_TYPES[activeDay]==="wd" ? WD_HABITS : WE_HABITS;
  const ds = { done:habits.filter(h=>checked[`${activeDay}_${h.id}`]).length, total:habits.length };
  const dayPct = ds.total>0?Math.round(ds.done/ds.total*100):0;
  const ws = DAY_LABELS.reduce((acc,_,i)=>{
    const h=DAY_TYPES[i]==="wd"?WD_HABITS:WE_HABITS;
    acc.done+=h.filter(hb=>checked[`${i}_${hb.id}`]).length; acc.total+=h.length; return acc;
  },{ done:0, total:0 });
  const weekPct = ws.total>0?Math.round(ws.done/ws.total*100):0;

  return (
    <div>
      <Box>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
              <Mono color={C.accent}>WEEK OF {wk}</Mono>
              <SyncDot status={syncStatus} />
            </div>
            <div style={{ color:C.muted, fontSize:13 }}>Weekly: <strong style={{color:C.text}}>{ws.done}/{ws.total} habits</strong></div>
          </div>
          <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:40, color:weekPct>=80?C.accent:weekPct>=50?C.warn:C.danger, fontWeight:700 }}>{weekPct}%</div>
        </div>
        <div style={{ background:C.bg, borderRadius:4, height:8, overflow:"hidden" }}>
          <div style={{ height:"100%", width:weekPct+"%", background:weekPct>=80?C.accent:weekPct>=50?C.warn:C.danger, borderRadius:4, transition:"width .4s ease" }}/>
        </div>
      </Box>

      <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
        {DAY_LABELS.map((label,i)=>{
          const h=DAY_TYPES[i]==="wd"?WD_HABITS:WE_HABITS;
          const done=h.filter(hb=>checked[`${i}_${hb.id}`]).length;
          const isActive=activeDay===i, isToday=i===todayIdx;
          return (
            <button key={i} onClick={()=>setActiveDay(i)} style={{ background:isActive?C.accent+"22":C.card, border:`1px solid ${isActive?C.accent:isToday?C.info:C.border}`, borderRadius:8, padding:"10px 12px", cursor:"pointer", color:isActive?C.accent:C.text, fontFamily:"'JetBrains Mono',monospace", fontSize:12, minWidth:54, textAlign:"center", transition:"all .15s", position:"relative" }}>
              <div style={{ fontWeight:700 }}>{label}</div>
              <div style={{ fontSize:10, color:done===h.length&&h.length>0?C.accent:C.muted, marginTop:3 }}>{done}/{h.length}</div>
              {isToday && <div style={{ position:"absolute", top:4, right:4, width:5, height:5, borderRadius:"50%", background:C.info }}/>}
            </button>
          );
        })}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
        <Mono>{DAY_LABELS[activeDay]} — {DAY_TYPES[activeDay]==="wd"?"WEEKDAY":"WEEKEND"}</Mono>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ background:C.bg, borderRadius:4, height:6, width:120, overflow:"hidden" }}>
            <div style={{ height:"100%", width:dayPct+"%", background:dayPct===100?C.accent:C.info, borderRadius:4, transition:"width .3s ease" }}/>
          </div>
          <Mono color={C.text}>{dayPct}%</Mono>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {habits.map(h => (
          <HabitCheck key={h.id} habit={h} checked={!!checked[`${activeDay}_${h.id}`]} onToggle={() => onToggle(activeDay, h.id)} />
        ))}
      </div>

      {ds.done===ds.total&&ds.total>0&&(
        <Box style={{ marginTop:20, background:C.accent+"11", borderColor:C.accent+"55", textAlign:"center" }}>
          <div style={{ fontSize:28, marginBottom:6 }}>✓</div>
          <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:22, color:C.accent, marginBottom:4 }}>Perfect {DAY_LABELS[activeDay]}.</div>
          <div style={{ color:C.muted, fontSize:13 }}>Every block. Do it again tomorrow.</div>
        </Box>
      )}
    </div>
  );
}

// ─── STATIC TABS ──────────────────────────────────────────────────────────────
const WeekdayTab = () => (
  <div>
    <Box style={{ borderColor:C.accent+"44" }}>
      <Mono color={C.accent}>MON–FRI · WAKE 3:30AM · LEAVE 5:50AM · DESK BY 7:00AM</Mono>
      <div style={{ color:C.muted, fontSize:13, marginTop:6 }}>Every minute pre-decided. Show up to each block.</div>
    </Box>
    {WD_SCHEDULE.map((b,i)=><Row key={i} {...b}/>)}
  </div>
);
const WeekendTab = () => (
  <div>
    <SH>SATURDAY</SH>{WE_SAT_SCHEDULE.map((b,i)=><Row key={i} {...b}/>)}
    <SH>SUNDAY — STRUCTURED</SH>{WE_SUN_SCHEDULE.map((b,i)=><Row key={i} {...b}/>)}
  </div>
);
const WorkoutsTab = () => (
  <div>
    <Box><Mono color={C.danger}>BEGINNER HYBRID — CALISTHENICS + WEIGHTS</Mono>
      <div style={{ color:C.muted, fontSize:13, marginTop:8 }}>Progressive overload every week. Track every session.</div>
    </Box>
    <Quote text="I like to use the hard times in the past to motivate me today." author="Dwyane Wade" color={C.info}/>
    {WD_WORKOUT_OF_DAY.map((w,i)=>(
      <Box key={i} style={{ borderLeft:`4px solid ${w.color}` }}>
        <Mono color={w.color}>{w.day} — {w.name}</Mono>
        <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:6 }}>
          {w.exercises.map((ex,j)=><div key={j} style={{ padding:"8px 12px", background:C.bg, borderRadius:6, fontSize:13, color:C.muted }}>{ex}</div>)}
        </div>
      </Box>
    ))}
    <Box style={{ borderLeft:`4px solid ${C.muted}` }}>
      <Mono color={C.muted}>SAT — Active Recovery</Mono>
      <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:6 }}>
        {["30 min walk outside (dog walk counts)","Full 20 min mobility flow — GMB / GOWOD / Tom Merrick","Light stretching / yoga"].map((ex,j)=>(
          <div key={j} style={{ padding:"8px 12px", background:C.bg, borderRadius:6, fontSize:13, color:C.muted }}>{ex}</div>
        ))}
      </div>
    </Box>
  </div>
);
const SecTab = () => (
  <div>
    <Box style={{ borderColor:C.info+"44" }}>
      <Mono color={C.info}>30-DAY SECURITY+ PLAN — NO GAMES</Mono>
      <div style={{ color:C.muted, fontSize:13, marginTop:8, lineHeight:1.8 }}>~2.5 hrs active studying every day. Anki. Practice questions. Write from memory. Your chemistry brain is built for systematic density.</div>
    </Box>
    <Quote text="Luck is what happens when preparation meets opportunity." author="Seneca" color={C.info}/>
    {[
      { week:"WEEK 1", focus:"Domains 1–2: Threats/Attacks & Architecture", res:"Professor Messer (free) + Dion Training Udemy" },
      { week:"WEEK 2", focus:"Domains 3–4: Implementation & Operations", res:"ExamCompass.com daily + start Anki deck" },
      { week:"WEEK 3", focus:"Domains 5–6: Governance/Risk + Cryptography", res:"75-question mixed exams. Log wrong answers." },
      { week:"WEEK 4", focus:"Full simulation + weak domain blitz", res:"Book exam by Day 25. Target 80%+ before test day." },
    ].map((w,i)=>(
      <Box key={i} style={{ borderLeft:`4px solid ${C.info}` }}>
        <Mono color={C.info}>{w.week}</Mono>
        <div style={{ fontWeight:600, color:C.text, margin:"6px 0" }}>{w.focus}</div>
        <div style={{ fontSize:12, color:C.info }}>{w.res}</div>
      </Box>
    ))}
  </div>
);
const NutritionTab = () => {
  const meals = [
    { name:"Pre-workout (4:20am)", cals:"~200", items:["1 banana","½ scoop protein in water"] },
    { name:"Breakfast (5:35am)", cals:"~750", items:["100g oats + 1 tbsp PB + 1 tbsp honey","3 scrambled eggs","8oz whole milk","Greek yogurt"] },
    { name:"Lunch (12:00pm)", cals:"~800", items:["200g ground beef or chicken thigh","1.5 cups white rice","Veggies + olive oil"] },
    { name:"Post-work snack (4:15pm)", cals:"~400", items:["Bread + PB + banana","OR: protein bar + nuts"] },
    { name:"Dinner (6:10pm)", cals:"~900", items:["250g salmon/chicken/beef","Sweet potato or pasta","Leafy greens + olive oil"] },
    { name:"Evening snack (8:15pm)", cals:"~350", items:["Cottage cheese + honey + granola","OR: cereal + whole milk"] },
  ];
  return (
    <div>
      <Box style={{ borderColor:C.warn+"44" }}>
        <Mono color={C.warn}>TARGET: ~3,200–3,500 CAL/DAY · 180–200G PROTEIN</Mono>
        <div style={{ color:C.muted, fontSize:13, marginTop:8 }}>Chemistry fact: <strong style={{color:C.text}}>muscle protein synthesis requires substrate. No fuel = no growth.</strong></div>
      </Box>
      {meals.map((m,i)=>(
        <Box key={i} style={{ borderLeft:`4px solid ${C.warn}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:10 }}>
            <span style={{ fontWeight:700, color:C.text }}>{m.name}</span>
            <Tag color={C.warn}>{m.cals} cal</Tag>
          </div>
          {m.items.map((item,j)=><div key={j} style={{ fontSize:13, color:C.muted, paddingLeft:12, borderLeft:`2px solid ${C.border}`, marginBottom:3 }}>{item}</div>)}
        </Box>
      ))}
    </div>
  );
};
const RulesTab = () => (
  <div>
    <Box style={{ borderColor:C.danger+"44" }}>
      <Mono color={C.danger}>THE OPERATING RULES</Mono>
      <div style={{ color:C.muted, fontSize:13, marginTop:8 }}>Load-bearing walls. Remove one and the structure weakens.</div>
    </Box>
    <Quote text="It's not about the size of the dog in the fight. It's about the size of the fight in the dog." author="LeBron James" color={C.danger}/>
    {["Phone across the room at bedtime. Always.","Lay out tomorrow's clothes and stage everything the night before.","No social media before 12:00pm on workdays.","Never miss Monday. Never miss Sunday prep.","Dog walk every single day after work. No exceptions.","Study is active or it doesn't count.","Food is medicine and training fuel. Eat on schedule.","If you miss a block, don't catastrophize. Do the next one.","One habit tracker. Check it every night.","No new shows, games, or hobbies until Sec+ is passed."].map((r,i)=>(
      <Box key={i} style={{ borderLeft:`4px solid ${C.danger}` }}>
        <div style={{ display:"flex", gap:12 }}>
          <div style={{ minWidth:26, height:26, borderRadius:"50%", background:C.danger+"22", border:`1px solid ${C.danger}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:C.danger, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, flexShrink:0 }}>{i+1}</div>
          <div style={{ color:C.text, fontSize:14, fontWeight:600, paddingTop:4 }}>{r}</div>
        </div>
      </Box>
    ))}
    <Box style={{ background:C.accent+"11", borderColor:C.accent+"44" }}>
      <Mono color={C.accent}>FINAL NOTE</Mono>
      <div style={{ color:C.text, fontSize:14, lineHeight:1.8, marginTop:10 }}>
        Run this SOP for 30 days without negotiating with yourself. Then reassess.<br/><br/>
        <span style={{ color:C.accent, fontWeight:700 }}>BE. DO. HAVE.</span>
      </div>
    </Box>
  </div>
);
const MantraTab = () => (
  <div>
    <div style={{ background:"linear-gradient(135deg,#0d1a00,#1a2e00,#0d1a00)", border:`2px solid ${C.accent}55`, borderRadius:16, padding:"48px 32px", marginBottom:24, textAlign:"center" }}>
      <Mono color={C.accent}>YOUR MANTRA · INSPIRED BY MYRON GOLDEN</Mono>
      {[{w:"BE.",c:C.accent},{w:"DO.",c:C.info},{w:"HAVE.",c:C.gold}].map(p=>(
        <div key={p.w} style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:"clamp(48px,10vw,88px)", color:p.c, letterSpacing:4, lineHeight:1.1, margin:"8px 0" }}>{p.w}</div>
      ))}
    </div>
    {[
      { word:"BE", color:C.accent, icon:"🌿", lines:["BE who He calls you to be","BE unapologetically you"] },
      { word:"DO", color:C.info, icon:"⚡", lines:["DO what He has called you to do","DO it wholeheartedly"] },
      { word:"HAVE", color:C.gold, icon:"✨", lines:["HAVE what HE promised","HAVE abundance"] },
    ].map(p=>(
      <Box key={p.word} style={{ borderLeft:`6px solid ${p.color}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:14 }}>
          <div style={{ fontSize:32 }}>{p.icon}</div>
          <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:44, color:p.color, lineHeight:1 }}>{p.word}</div>
        </div>
        {p.lines.map((line,i)=><div key={i} style={{ fontSize:17, color:C.text, lineHeight:2, fontWeight:i===0?600:400 }}>{line}</div>)}
      </Box>
    ))}
    <SH>READ THIS EVERY MORNING</SH>
    <Box style={{ background:C.accent+"08", borderColor:C.accent+"44", textAlign:"center", padding:"32px 28px" }}>
      <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:19, color:C.text, lineHeight:2.4 }}>
        Today I will <span style={{color:C.accent}}>BE</span> who He calls me to be.<br/>
        I will <span style={{color:C.info}}>DO</span> what He has called me to do — wholeheartedly.<br/>
        I will <span style={{color:C.gold}}>HAVE</span> what He has promised.<br/>
        I am walking in abundance. <span style={{color:C.accent,fontWeight:700}}>It is already done.</span>
      </div>
    </Box>
    <SH>CHAMPIONS WHO LIVED IT</SH>
    <Quote text="You can't let fear stop you." author="Serena Williams" color={C.danger}/>
    <Quote text="I am going to show you how great I am." author="Muhammad Ali" color={C.gold}/>
    <Quote text="The moment you give up is the moment you let someone else win." author="Kobe Bryant" color={C.purple}/>
    <Quote text="Don't be afraid of failure. This is the way to succeed." author="LeBron James" color={C.warn}/>
    <Quote text="You get what you are, not what you want." author="Myron Golden" color={C.gold}/>
  </div>
);

// ─── TABS CONFIG ──────────────────────────────────────────────────────────────
const TABS = [
  { id:"today",     label:"⚡ TODAY" },
  { id:"weekday",   label:"📋 WEEKDAY" },
  { id:"weekend",   label:"📅 WEEKEND" },
  { id:"workouts",  label:"💪 WORKOUTS" },
  { id:"sec",       label:"🔒 SEC+" },
  { id:"nutrition", label:"🥗 NUTRITION" },
  { id:"rules",     label:"⚡ RULES" },
  { id:"tracker",   label:"✅ TRACKER" },
  { id:"mantra",    label:"🔥 MANTRA" },
];

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab]   = useState("today");
  const [checked, setChecked]       = useState({});
  const [syncStatus, setSyncStatus] = useState("idle");
  const weekKey = getWeekKey();

  // Load from Supabase on mount
  useEffect(() => {
    setSyncStatus("syncing");
    loadFromSupabase(weekKey).then(data => {
      if (data) { setChecked(data); setSyncStatus("synced"); }
      else {
        // fallback to localStorage
        try { const r = localStorage.getItem("sop_"+weekKey); if (r) setChecked(JSON.parse(r)); } catch {}
        setSyncStatus("offline");
      }
      setTimeout(() => setSyncStatus(s => s==="synced"?"idle":s), 3000);
    });
  }, [weekKey]);

  const handleToggle = useCallback(async (dayIndex, habitId) => {
    const key = `${dayIndex}_${habitId}`;
    const newVal = !checked[key];
    const next = { ...checked, [key]: newVal };
    setChecked(next);

    // optimistic local backup
    try { localStorage.setItem("sop_"+weekKey, JSON.stringify(next)); } catch {}

    // sync to Supabase
    setSyncStatus("syncing");
    const ok = await upsertHabit(weekKey, dayIndex, habitId, newVal);
    setSyncStatus(ok ? "synced" : "offline");
    setTimeout(() => setSyncStatus(s => s==="synced"?"idle":s), 2000);
  }, [checked, weekKey]);

  const todayIdx = getTodayIdx();

  const renderTab = () => {
    switch(activeTab) {
      case "today":     return <TodayTab checked={checked} onToggle={handleToggle} syncStatus={syncStatus}/>;
      case "weekday":   return <WeekdayTab/>;
      case "weekend":   return <WeekendTab/>;
      case "workouts":  return <WorkoutsTab/>;
      case "sec":       return <SecTab/>;
      case "nutrition": return <NutritionTab/>;
      case "rules":     return <RulesTab/>;
      case "tracker":   return <TrackerTab checked={checked} onToggle={handleToggle} syncStatus={syncStatus}/>;
      case "mantra":    return <MantraTab/>;
      default:          return null;
    }
  };

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"'DM Sans',sans-serif" }}>
      {/* Sticky header */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:"20px 20px 0", background:C.surface, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4, flexWrap:"wrap", gap:8 }}>
            <div>
              <Mono>Life SOP v3.0 · Cloud Sync</Mono>
              <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:"clamp(18px,3.5vw,28px)", color:C.text, lineHeight:1.2, marginTop:2 }}>
                Your Life, <span style={{color:C.accent}}>Systemized.</span>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:20, color:C.accent }}>BE. DO. HAVE.</div>
              <Mono color={C.muted}>{DAY_LABELS[todayIdx]}</Mono>
            </div>
          </div>
          <div style={{ display:"flex", gap:0, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ background:"none", border:"none", borderBottom:activeTab===t.id?`2px solid ${t.id==="mantra"?C.gold:t.id==="tracker"?C.info:C.accent}`:"2px solid transparent", color:activeTab===t.id?(t.id==="mantra"?C.gold:t.id==="tracker"?C.info:C.accent):C.muted, fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:1, padding:"10px 10px", cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s" }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"24px 18px" }}>
        {renderTab()}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;700&display=swap');
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:#0d0d0d; }
        ::-webkit-scrollbar-thumb { background:#2a2a2a; border-radius:3px; }
        button:hover { opacity:.85; }
      `}</style>
    </div>
  );
}
