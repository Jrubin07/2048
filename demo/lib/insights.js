// Early-warning rules. Plain code on purpose: these must behave the same way
// every time and never depend on an AI call. Thresholds are illustrative and
// need review by a vet before any real use.

const LEVELS = ['ok', 'info', 'watch', 'vet', 'urgent'];

const STATUS = {
  ok: { level: 'ok', label: 'All good', color: 'green' },
  info: { level: 'ok', label: 'All good', color: 'green' },
  watch: { level: 'watch', label: 'Keep an eye on it', color: 'amber' },
  vet: { level: 'vet', label: 'Book a vet visit', color: 'orange' },
  urgent: { level: 'urgent', label: 'Contact a vet now', color: 'red' },
};

const FATTY_FOOD = /\b(bbq|barbecue|sausage|bacon|fatty|fat|grease|greasy|scraps|bones?|ham|pork|gravy|butter|fried)\b/i;

function today() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function dayDiff(a, b) {
  return Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 86400000);
}

function ageText(birthDate) {
  const months = Math.floor(dayDiff(today(), birthDate) / 30.44);
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'}`;
}

function sortByDate(list) {
  return [...list].sort((a, b) => a.date.localeCompare(b.date));
}

function habitSignals(dog) {
  const signals = [];
  const habits = sortByDate(dog.habits || []);
  const now = today();
  const recent = habits.filter((h) => dayDiff(now, h.date) <= 3 && dayDiff(now, h.date) >= 0);
  const todays = habits.find((h) => h.date === now);
  const count = (fn) => recent.filter(fn).length;

  const vomitDays = count((h) => h.vomiting > 0);
  const poorAppetiteDays = count((h) => h.appetite === 'reduced' || h.appetite === 'none');
  const lowEnergyDays = count((h) => h.energy === 'low');
  const diarrheaDays = count((h) => h.stool === 'diarrhea');
  const thirstyDays = count((h) => h.water === 'more');

  if (todays && todays.vomiting >= 2 && (todays.appetite === 'none' || vomitDays >= 2)) {
    signals.push({
      level: 'urgent', area: 'Daily check-in',
      title: `Vomited ${todays.vomiting} times today${todays.appetite === 'none' ? ' and not eating' : ''}`,
      detail: 'Repeated vomiting, especially with no appetite or after several days of symptoms, can lead to dehydration quickly. Call your vet or an emergency clinic today.',
    });
  } else if (todays && todays.vomiting >= 3) {
    signals.push({
      level: 'urgent', area: 'Daily check-in', title: `Vomited ${todays.vomiting} times today`,
      detail: 'Three or more vomits in a day needs a vet today.',
    });
  } else if (todays && todays.appetite === 'none') {
    signals.push({
      level: 'vet', area: 'Daily check-in', title: 'Not eating today',
      detail: 'A full day without food is worth a call to your vet, sooner for small or young dogs.',
    });
  }

  if (vomitDays >= 2) {
    signals.push({
      level: 'vet', area: 'Habits', title: `Vomiting on ${vomitDays} of the last ${recent.length} days`,
      detail: 'Vomiting that keeps coming back over several days should be checked by a vet.',
    });
  }
  if (poorAppetiteDays >= 2) {
    signals.push({
      level: 'watch', area: 'Habits', title: `Reduced appetite on ${poorAppetiteDays} days`,
      detail: 'Eating less than usual for more than a day or two.',
    });
  }
  if (lowEnergyDays >= 2) {
    signals.push({
      level: 'watch', area: 'Habits', title: `Low energy on ${lowEnergyDays} days`,
      detail: 'Sleeping more or less interested in walks and play.',
    });
  }
  if (diarrheaDays >= 2) {
    signals.push({
      level: 'watch', area: 'Habits', title: `Diarrhea on ${diarrheaDays} days`,
      detail: 'Keep water available. Blood in stool, vomiting or lethargy means a vet visit.',
    });
  }
  if (thirstyDays >= 3) {
    signals.push({
      level: 'watch', area: 'Habits', title: 'Drinking more than usual',
      detail: 'Increased thirst over several days can point to many things and is worth mentioning to your vet.',
    });
  }

  const fatty = habits.filter((h) => dayDiff(now, h.date) <= 7 && FATTY_FOOD.test(h.note || ''));
  if (fatty.length) {
    const last = fatty[fatty.length - 1];
    const ago = dayDiff(now, last.date);
    const gi = vomitDays > 0 || poorAppetiteDays > 0;
    signals.push({
      level: gi ? 'watch' : 'info', area: 'Notes',
      title: `Fatty food noted ${ago === 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`}`,
      detail: gi
        ? `"${last.note}". Rich or fatty food followed by stomach signs is a pattern vets want to hear about.`
        : `"${last.note}". Watch for vomiting, belly pain or not eating over the next few days.`,
    });
  }

  return signals;
}

function weightSignals(dog) {
  const weights = sortByDate(dog.weights || []);
  if (weights.length < 2) return [];
  const latest = weights[weights.length - 1];
  const earlier = weights
    .filter((w) => {
      const d = dayDiff(latest.date, w.date);
      return d >= 21 && d <= 45;
    })
    .pop();
  if (!earlier) return [];
  const change = ((latest.kg - earlier.kg) / earlier.kg) * 100;
  const days = dayDiff(latest.date, earlier.date);
  const pct = Math.abs(change).toFixed(1);
  if (change <= -5) {
    return [{
      level: 'vet', area: 'Weight', title: `Weight down ${pct}% in ${days} days`,
      detail: `${earlier.kg} kg to ${latest.kg} kg. Unplanned loss of 5% or more in a month is significant, especially in a small dog.`,
    }];
  }
  if (change <= -3) {
    return [{ level: 'watch', area: 'Weight', title: `Weight down ${pct}% in ${days} days`, detail: `${earlier.kg} kg to ${latest.kg} kg.` }];
  }
  if (change >= 8) {
    return [{ level: 'watch', area: 'Weight', title: `Weight up ${pct}% in ${days} days`, detail: `${earlier.kg} kg to ${latest.kg} kg.` }];
  }
  return [];
}

function outOfRange(v) {
  return v.value < v.low || v.value > v.high;
}

function labSignals(dog) {
  const labs = sortByDate(dog.labs || []);
  if (!labs.length) return [];
  const latest = labs[labs.length - 1];
  const flagged = latest.values.filter(outOfRange);
  if (!flagged.length) return [];
  const severe = flagged.some((v) => v.value > v.high * 1.5 || v.value < v.low * 0.5);
  const list = flagged
    .map((v) => `${v.name} ${v.value} ${v.unit} (${v.value > v.high ? 'high' : 'low'}, range ${v.low}–${v.high})`)
    .join('; ');
  return [{
    level: severe || flagged.length >= 2 ? 'vet' : 'watch', area: 'Lab results',
    title: `${flagged.length} blood value${flagged.length === 1 ? '' : 's'} out of range`,
    detail: `${latest.panel}, ${latest.date}: ${list}.`,
  }];
}

function vaccineSignals(dog) {
  const now = today();
  const out = [];
  for (const v of dog.vaccines || []) {
    const left = dayDiff(v.due, now);
    if (left < 0) out.push({ level: 'watch', area: 'Vaccines', title: `${v.name} overdue`, detail: `Was due ${v.due}.` });
    else if (left <= 30) out.push({ level: 'info', area: 'Vaccines', title: `${v.name} due in ${left} days`, detail: `Due ${v.due}.` });
  }
  return out;
}

function analyze(dog) {
  const signals = [...habitSignals(dog), ...weightSignals(dog), ...labSignals(dog), ...vaccineSignals(dog)]
    .sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level));
  const top = signals.length ? signals[0].level : 'ok';
  return { status: STATUS[top], signals };
}

module.exports = { analyze, ageText, today, dayDiff, outOfRange, LEVELS };
