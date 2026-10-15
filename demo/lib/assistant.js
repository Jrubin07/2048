// Chia's health assistant: emergency screen -> dog context -> Claude (or offline answers).
//
// The emergency screen is plain keyword rules and runs before any AI call, so an
// emergency banner appears even if the model is slow, down or declines.

const { analyze, ageText, outOfRange, today, dayDiff } = require('./insights');

const MODEL = process.env.CHIA_MODEL || 'claude-opus-5-5';

// Models that accept server-side fallback with `fallbacks: "default"`.
const FALLBACK_MODELS = /^claude-(opus-5|fable-5|sonnet-5-5)/;

let client = null;
let clientError = null;
if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
  try {
    const mod = require('@anthropic-ai/sdk');
    const Anthropic = mod.default || mod;
    client = new Anthropic();
  } catch (err) {
    clientError = err.code === 'MODULE_NOT_FOUND'
      ? 'Anthropic SDK not installed. Run "npm install" in the demo folder.'
      : err.message;
    console.warn(`[assistant] Claude disabled: ${clientError}`);
  }
}

function mode() {
  return client ? { mode: 'claude', model: MODEL } : { mode: 'offline', model: null, reason: clientError };
}

// ---------------------------------------------------------------------------
// Emergency screen
// ---------------------------------------------------------------------------

const EMERGENCIES = [
  { re: /chocolate|cocoa/i, title: 'Chocolate can be poisonous to dogs', why: 'Dark and baking chocolate are the most dangerous. Toxicity depends on the type, amount and your dog\'s weight.' },
  { re: /xylitol|sugar[- ]free gum|birch sugar/i, title: 'Xylitol is highly toxic to dogs', why: 'It can cause a sudden drop in blood sugar and liver damage, even in small amounts.' },
  { re: /grape|raisin|sultana|currant/i, title: 'Grapes and raisins can cause kidney failure', why: 'There is no known safe amount.' },
  { re: /rat poison|rodenticide|slug pellet|snail bait|metaldehyde/i, title: 'Possible poisoning', why: 'Some poisons cause bleeding or seizures days later, even if your dog seems fine now.' },
  { re: /antifreeze|ethylene glycol/i, title: 'Antifreeze is life-threatening', why: 'Treatment works best within hours of exposure.' },
  { re: /ibuprofen|advil|naproxen|aleve|paracetamol|acetaminophen|tylenol|aspirin|human (pill|medicine|medication)/i, title: 'Human painkillers can poison dogs', why: 'Common painkillers can cause stomach ulcers, kidney or liver damage.' },
  { re: /seizure|seizing|convuls|fitting/i, title: 'A seizure needs a vet', why: 'Keep your dog away from stairs and water, do not put anything in the mouth, and time it.' },
  { re: /collaps|unconscious|unresponsive|can'?t stand|cannot stand/i, title: 'Collapse is an emergency', why: 'Keep your dog warm and still and go to a vet now.' },
  { re: /can'?t breathe|cannot breathe|struggling to breathe|difficulty breathing|choking|blue (gums|tongue)/i, title: 'Breathing problems are an emergency', why: 'Do not wait to see if it improves.' },
  { re: /pale gums|white gums/i, title: 'Pale gums can mean blood loss or shock', why: 'This needs a vet now.' },
  { re: /bloat|swollen (belly|stomach|abdomen)|retching|dry heav|trying to vomit/i, title: 'Possible bloat (GDV)', why: 'A swollen belly with unproductive retching can be fatal within hours, especially in large, deep-chested dogs.' },
  { re: /hit by a car|run over|fell from|fall from/i, title: 'Trauma needs a vet check', why: 'Internal injuries are not always visible at first.' },
  { re: /bleeding (heavily|a lot|won'?t stop)|lots of blood|vomiting blood|blood in (vomit|her vomit|his vomit)/i, title: 'Heavy bleeding is an emergency', why: 'Apply gentle pressure with a clean cloth on the way to the vet.' },
  { re: /heat ?stroke|overheat/i, title: 'Heatstroke is an emergency', why: 'Move to shade, cool with room-temperature (not ice-cold) water, and go to a vet.' },
  { re: /snake ?bite|bitten by a snake|bee sting.*(swell|face)|stung.*(swell|face)/i, title: 'Bites and allergic swelling can escalate fast', why: 'Keep your dog calm and still.' },
];

function emergencyScreen(text, dog) {
  const hit = EMERGENCIES.find((e) => e.re.test(text || ''));
  if (!hit) return null;
  const er = dog.emergencyClinic || {};
  const vet = dog.clinic || {};
  return {
    title: hit.title,
    detail: hit.why,
    action: `Call ${er.name || 'an emergency vet'}${er.phone ? ` (${er.phone})` : ''} or ${vet.name || 'your vet'}${vet.phone ? ` (${vet.phone})` : ''} now. If you suspect poisoning, have the packaging with you and do not make ${dog.name} vomit unless a vet tells you to.`,
  };
}

// ---------------------------------------------------------------------------
// Dog context (shared by Claude and the offline answers)
// ---------------------------------------------------------------------------

function pronouns(dog) {
  return dog.sex === 'female'
    ? { she: 'she', her: 'her', him: 'her' }
    : { she: 'he', her: 'his', him: 'him' };
}

function sorted(list) {
  return [...(list || [])].sort((a, b) => a.date.localeCompare(b.date));
}

function dogContext(dog) {
  const { status, signals } = analyze(dog);
  const weights = sorted(dog.weights);
  const habits = sorted(dog.habits).slice(-14);
  const labs = sorted(dog.labs);
  const lines = [
    `Today: ${today()}`,
    `Dog: ${dog.name}, ${dog.breed}, ${dog.sex}${dog.neutered ? ' (neutered)' : ''}, born ${dog.birthDate} (${ageText(dog.birthDate)})`,
    `Allergies: ${dog.allergies.length ? dog.allergies.join(', ') : 'none known'}`,
    `Conditions: ${dog.conditions.length ? dog.conditions.join(', ') : 'none known'}`,
    `Medications: ${dog.medications.length ? dog.medications.map((m) => `${m.name} (${m.dose})`).join(', ') : 'none'}`,
    `Diet: ${dog.diet}`,
    `Vet: ${dog.clinic.vet}, ${dog.clinic.name}, ${dog.clinic.phone}. Emergency: ${dog.emergencyClinic.name}, ${dog.emergencyClinic.phone}`,
    '',
    `Chia status (from rules): ${status.label}`,
    'Signals:',
    ...(signals.length ? signals.map((s) => `- [${s.level}] ${s.area}: ${s.title}. ${s.detail}`) : ['- none']),
    '',
    'Weights:',
    ...weights.map((w) => `- ${w.date}: ${w.kg} kg`),
    '',
    'Daily check-ins (last 14 days):',
    ...habits.map((h) => `- ${h.date}: appetite ${h.appetite}, water ${h.water}, energy ${h.energy}, stool ${h.stool}, vomiting ${h.vomiting}, walk ${h.walkMinutes} min${h.note ? `, note: "${h.note}"` : ''}`),
    '',
    'Lab results:',
    ...labs.flatMap((l) => [
      `- ${l.date} ${l.panel}:`,
      ...l.values.map((v) => `  - ${v.name}: ${v.value} ${v.unit} (range ${v.low}-${v.high})${outOfRange(v) ? (v.value > v.high ? ' HIGH' : ' LOW') : ''}`),
    ]),
    '',
    'Vaccines:',
    ...dog.vaccines.map((v) => `- ${v.name}: given ${v.date}, due ${v.due}`),
    '',
    'Records:',
    ...sorted(dog.records).map((r) => `- ${r.date} [${r.type}] ${r.title}: ${r.text}`),
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Chia, a dog health assistant inside an app where owners keep their dog's health record and log a short daily check-in.

Your job is to help the owner understand their dog's record and decide what to do next. You explain and advise; you are not the dog's vet.

Rules:
- Ground every answer in the dog's record below. Quote the dog's own values, dates and notes when they matter. If the record does not contain something, say so rather than guessing.
- Do not diagnose. You may say what a pattern can be associated with ("vets often check for ..."), framed as possibilities a vet would consider, never as a conclusion.
- Do not prescribe medicines or give doses, including over-the-counter or human medicines. Do not suggest inducing vomiting.
- If anything suggests an emergency (poisoning, breathing trouble, collapse, seizures, bloat, heavy bleeding, repeated vomiting with no food intake), say so in the first line and tell the owner to call their vet or the emergency clinic now, using the names and phone numbers in the record.
- Keep it short and warm, written for a worried owner: a few short paragraphs or bullets, plain words, no jargon without a quick explanation. Use the dog's name.
- Always end with a line that starts with "**When to see a vet:**" giving concrete, specific triggers or timing for this dog right now.

The rule-based status and signals in the record come from Chia's early-warning rules. Do not contradict a more urgent rule-based status with a calmer one.`;

async function askClaude(dog, messages) {
  const params = {
    model: MODEL,
    max_tokens: 4000,
    system: `${SYSTEM_PROMPT}\n\n<dog_record>\n${dogContext(dog)}\n</dog_record>`,
    messages,
  };
  if (!/haiku-4|sonnet-4-5|opus-4-5/.test(MODEL)) params.output_config = { effort: 'medium' };

  let response;
  if (FALLBACK_MODELS.test(MODEL)) {
    // Server-side fallback: a declined request is retried on a recommended model.
    response = await client.beta.messages.create({
      ...params,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } else {
    response = await client.messages.create(params);
  }

  if (response.stop_reason === 'refusal') {
    const category = response.stop_details && response.stop_details.category;
    throw new Error(`model declined the request${category ? ` (${category})` : ''}`);
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!text) throw new Error(`empty response (stop_reason: ${response.stop_reason})`);
  return { text, model: response.model || MODEL };
}

// ---------------------------------------------------------------------------
// Offline answers (built-in, based on the dog's record)
// ---------------------------------------------------------------------------

const LAB_NOTES = {
  'cPL (pancreatic lipase)': 'a test for inflammation of the pancreas',
  Lipase: 'an enzyme made mostly by the pancreas',
  Triglycerides: 'fat in the blood; can rise after a fatty meal or with pancreas or hormone problems',
  ALT: 'a liver enzyme',
  ALP: 'a liver and bone enzyme',
  Creatinine: 'a kidney marker',
  BUN: 'a kidney marker',
  Glucose: 'blood sugar',
  WBC: 'white blood cells, which rise with infection or inflammation',
  'T4 (thyroid)': 'thyroid hormone',
};

function vetLine(dog, signals) {
  const top = signals[0] ? signals[0].level : 'ok';
  const { she } = pronouns(dog);
  if (top === 'urgent') return `**When to see a vet:** now. Call ${dog.clinic.name} (${dog.clinic.phone}) or, out of hours, ${dog.emergencyClinic.name} (${dog.emergencyClinic.phone}).`;
  if (top === 'vet') return `**When to see a vet:** book a visit with ${dog.clinic.vet} in the next day or two and bring this record. Go the same day if ${she} vomits again more than once, stops eating completely, seems in pain, or becomes very weak.`;
  if (top === 'watch') return `**When to see a vet:** if things are not better in 2–3 days, or straight away if ${she} stops eating, vomits repeatedly or seems in pain.`;
  return `**When to see a vet:** at the next routine check-up, or sooner if you notice changes in appetite, energy, thirst, weight or toilet habits.`;
}

function offlineAnswer(dog, question) {
  const q = (question || '').toLowerCase();
  const { signals, status } = analyze(dog);
  const p = pronouns(dog);
  const parts = [];

  if (/blood|lab|result|value|test|cpl|lipase|triglycer|panel/.test(q)) {
    const labs = sorted(dog.labs);
    const latest = labs[labs.length - 1];
    if (!latest) {
      parts.push(`I don't see any lab results in ${dog.name}'s record yet. You can add them under Records.`);
    } else {
      const flagged = latest.values.filter(outOfRange);
      const normal = latest.values.filter((v) => !outOfRange(v));
      parts.push(`${dog.name}'s latest results are from **${latest.panel}** on ${latest.date}.`);
      if (flagged.length) {
        parts.push(`${flagged.length} value${flagged.length === 1 ? ' is' : 's are'} outside the reference range:`);
        parts.push(flagged.map((v) => {
          const times = v.value > v.high ? ` (about ${(v.value / v.high).toFixed(1)}× the upper limit)` : '';
          return `- **${v.name}: ${v.value} ${v.unit}**, range ${v.low}–${v.high}${times}. ${cap(LAB_NOTES[v.name] || 'a routine blood marker')}.`;
        }).join('\n'));
        const names = flagged.map((v) => v.name).join(' ');
        if (/cPL|Lipase/.test(names)) {
          const fatty = sorted(dog.habits).filter((h) => /bbq|sausage|fatty|scraps/i.test(h.note || '')).pop();
          parts.push(`Together, raised pancreas markers and triglycerides are something vets look at closely, often alongside an ultrasound and an exam. ${fatty ? `It's worth telling the vet about the note from ${fatty.date}: "${fatty.note}". ` : ''}Only the vet can say what this means for ${dog.name}; I can't diagnose from numbers alone.`);
        }
      } else {
        parts.push(`All ${latest.values.length} values are within the reference range.`);
      }
      if (normal.length && flagged.length) {
        parts.push(`Within range: ${normal.map((v) => `${v.name} ${v.value} ${v.unit}`).join(', ')}.`);
      }
      const prev = labs[labs.length - 2];
      if (prev && flagged.length) {
        const compared = flagged
          .map((v) => ({ v, old: prev.values.find((o) => o.name === v.name) }))
          .filter((x) => x.old);
        if (compared.length) {
          parts.push(`Compared with ${prev.date}: ${compared.map(({ v, old }) => `${v.name} was ${old.value}`).join(', ')}.`);
        }
      }
    }
  } else if (/weigh|kg|thin|fat|lost|gain/.test(q)) {
    const w = sorted(dog.weights);
    const latest = w[w.length - 1];
    parts.push(`${dog.name}'s latest weight is **${latest.kg} kg** (${latest.date}).`);
    parts.push(`Recent history: ${w.slice(-5).map((x) => `${x.kg} kg on ${x.date}`).join(', ')}.`);
    const ws = signals.filter((s) => s.area === 'Weight');
    if (ws.length) parts.push(`${ws[0].title}. ${ws[0].detail}`);
    else parts.push(`That's a stable trend. Weigh ${p.him} on the same scale at a similar time of day to keep the chart reliable.`);
  } else if (/vaccin|shot|jab|booster/.test(q)) {
    parts.push(`${dog.name}'s vaccines:`);
    parts.push(dog.vaccines.map((v) => `- **${v.name}**: given ${v.date}, next due ${v.due} (${dayDiff(v.due, today())} days)`).join('\n'));
  } else if (/eat|food|diet|appetite|feed|treat/.test(q) && !/vomit|sick|throw/.test(q)) {
    parts.push(`${dog.name}'s usual diet: ${dog.diet}.`);
    if (dog.allergies.length) parts.push(`Known allergy: ${dog.allergies.join(', ')}. Avoid treats containing it.`);
    const recent = sorted(dog.habits).slice(-3).map((h) => `${h.date}: ${h.appetite}`).join(', ');
    parts.push(`Appetite in the last check-ins: ${recent}.`);
    if (signals.some((s) => s.level === 'vet' || s.level === 'urgent')) {
      parts.push(`Because ${p.she}'s had stomach signs, don't change ${p.her} food or add new treats until you've spoken to the vet. Keep fresh water available.`);
    }
  } else {
    parts.push(`Here's what I see in ${dog.name}'s record. Chia's status is **${status.label}**.`);
    const relevant = signals.filter((s) => s.level !== 'info' && s.level !== 'ok');
    if (relevant.length) {
      parts.push(relevant.map((s) => `- **${s.title}** (${s.area}). ${s.detail}`).join('\n'));
      parts.push(`None of these alone is a diagnosis, but together they're the kind of pattern a vet should look at. Keep logging appetite, vomiting and energy each day so the vet can see the trend.`);
    } else {
      parts.push(`Nothing in the recent check-ins, weight or lab results stands out. Keep up the daily check-ins; they make changes easy to spot early.`);
    }
  }

  parts.push(vetLine(dog, signals));
  return parts.join('\n\n');
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------

function cleanMessages(messages) {
  const out = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const content = String(m.content || '').slice(0, 4000).trim();
    if (!content) continue;
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += `\n\n${content}`;
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out.slice(-20);
}

async function respond(dog, rawMessages) {
  const messages = cleanMessages(rawMessages);
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') throw Object.assign(new Error('Last message must be from the user'), { status: 400 });

  const emergency = emergencyScreen(last.content, dog);

  if (client) {
    try {
      const { text, model } = await askClaude(dog, messages);
      return { text, mode: 'claude', model, emergency };
    } catch (err) {
      console.warn(`[assistant] Claude call failed, using offline answer: ${err.message}`);
    }
  }
  const text = emergency
    ? `**This could be an emergency.** Please follow the steps in the red box above and call a vet now, even if ${dog.name} seems fine.\n\nWhile you get help, note what ${dog.name} ate or was exposed to, how much and when, and bring any packaging. That helps the vet decide on treatment quickly.\n\n**When to see a vet:** now.`
    : offlineAnswer(dog, last.content);
  return { text, mode: 'offline', model: null, emergency };
}

module.exports = { respond, mode, emergencyScreen, dogContext, offlineAnswer };
