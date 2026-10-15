// Sample dogs for the demo. All names, clinics, microchip numbers and lab
// values are made up. Dates are relative to today so the demo never goes stale.

function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysAhead(n) {
  return daysAgo(-n);
}

function yearsAgo(years, extraDays = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - extraDays);
  return d.toISOString().slice(0, 10);
}

const normalDay = { appetite: 'normal', water: 'normal', energy: 'normal', stool: 'normal', vomiting: 0 };

function habitRange(from, to, base, overrides = {}) {
  const out = [];
  for (let n = from; n >= to; n--) {
    out.push({ date: daysAgo(n), ...base, ...(overrides[n] || {}) });
  }
  return out;
}

function mochi() {
  const habits = habitRange(13, 1, { ...normalDay, walkMinutes: 35, note: '' }, {
    12: { walkMinutes: 40, note: 'Park with the neighbour\'s dog' },
    9: { walkMinutes: 25, note: 'Rainy day, short walks' },
    7: { note: 'Groomer visit' },
    4: { walkMinutes: 30, note: 'Family BBQ: she got sausage and fatty pork scraps from the table' },
    3: { appetite: 'reduced', energy: 'low', vomiting: 1, walkMinutes: 15, note: 'Vomited once in the evening, left half her dinner' },
    2: { appetite: 'reduced', energy: 'low', stool: 'soft', vomiting: 1, walkMinutes: 10, note: 'Vomited after breakfast, sleeping a lot' },
    1: { appetite: 'reduced', water: 'more', energy: 'low', vomiting: 1, walkMinutes: 10, note: 'Seems uncomfortable when picked up' },
  });

  return {
    id: 'mochi',
    name: 'Mochi',
    sex: 'female',
    breed: 'Maltese',
    birthDate: yearsAgo(2, 40),
    avatar: '🐩',
    color: 'White',
    neutered: true,
    microchip: '981 020 004 117 352',
    clinic: { name: 'Riverside Vet Clinic', vet: 'Dr. Lena Ortiz', phone: '+1 555 0142' },
    emergencyClinic: { name: 'City 24h Animal Emergency', phone: '+1 555 0199' },
    allergies: ['Chicken (itchy skin)'],
    conditions: [],
    medications: [{ name: 'NexGard (flea and tick)', dose: 'Monthly chewable', since: daysAgo(300) }],
    diet: 'Salmon and rice dry food, 2 meals a day (about 50 g per day)',
    shareForResearch: false,
    weights: [
      { date: daysAgo(150), kg: 3.0 },
      { date: daysAgo(120), kg: 3.1 },
      { date: daysAgo(90), kg: 3.05 },
      { date: daysAgo(60), kg: 3.1 },
      { date: daysAgo(31), kg: 3.1 },
      { date: daysAgo(1), kg: 2.9 },
    ],
    habits,
    vaccines: [
      { name: 'Rabies', date: daysAgo(200), due: daysAhead(165) },
      { name: 'DHPP', date: daysAgo(200), due: daysAhead(165) },
      { name: 'Leptospirosis', date: daysAgo(200), due: daysAhead(165) },
      { name: 'Kennel cough (Bordetella)', date: daysAgo(340), due: daysAhead(25) },
    ],
    labs: [
      {
        id: 'lab-mochi-1',
        date: daysAgo(200),
        panel: 'Annual blood panel',
        lab: 'Riverside Vet Clinic',
        values: [
          { name: 'ALT', value: 48, unit: 'U/L', low: 10, high: 125 },
          { name: 'Creatinine', value: 0.7, unit: 'mg/dL', low: 0.5, high: 1.8 },
          { name: 'Glucose', value: 96, unit: 'mg/dL', low: 70, high: 143 },
          { name: 'Triglycerides', value: 88, unit: 'mg/dL', low: 30, high: 150 },
          { name: 'WBC', value: 8.1, unit: '10^9/L', low: 5.5, high: 16.9 },
        ],
      },
      {
        id: 'lab-mochi-2',
        date: daysAgo(1),
        panel: 'Blood panel after vomiting',
        lab: 'Riverside Vet Clinic (sent to reference lab)',
        values: [
          { name: 'cPL (pancreatic lipase)', value: 412, unit: 'µg/L', low: 0, high: 200 },
          { name: 'Lipase', value: 1240, unit: 'U/L', low: 100, high: 750 },
          { name: 'Triglycerides', value: 214, unit: 'mg/dL', low: 30, high: 150 },
          { name: 'ALT', value: 96, unit: 'U/L', low: 10, high: 125 },
          { name: 'Creatinine', value: 0.9, unit: 'mg/dL', low: 0.5, high: 1.8 },
          { name: 'Glucose', value: 118, unit: 'mg/dL', low: 70, high: 143 },
          { name: 'WBC', value: 15.2, unit: '10^9/L', low: 5.5, high: 16.9 },
        ],
      },
    ],
    records: [
      { id: 'rec-m1', type: 'visit', title: 'Annual check-up', date: daysAgo(200), text: 'Healthy. Dental tartar grade 1. Vaccines given: Rabies, DHPP, Leptospirosis. Blood panel normal.' },
      { id: 'rec-m2', type: 'vaccine', title: 'Kennel cough vaccine', date: daysAgo(340), text: 'Intranasal Bordetella vaccine before boarding.' },
      { id: 'rec-m3', type: 'lab', title: 'Blood panel after vomiting', date: daysAgo(1), text: 'Drawn at Riverside Vet Clinic after a phone consult. Results came back today; vet to call to discuss.' },
      { id: 'rec-m4', type: 'note', title: 'Food switch', date: daysAgo(400), text: 'Switched from chicken kibble to salmon and rice because of itchy skin. Itching resolved in about 6 weeks.' },
    ],
  };
}

function bear() {
  const habits = habitRange(13, 0, { ...normalDay, walkMinutes: 60, note: '' }, {
    13: { walkMinutes: 75, note: 'Lake swim' },
    10: { energy: 'high', walkMinutes: 90, note: 'Long hike, tired but happy' },
    8: { note: 'Joint supplement restocked' },
    5: { walkMinutes: 45, note: 'Hot day, walked early and late' },
    2: { walkMinutes: 70, note: 'Played fetch with the kids' },
  });

  return {
    id: 'bear',
    name: 'Bear',
    sex: 'male',
    breed: 'Golden Retriever',
    birthDate: yearsAgo(7, 95),
    avatar: '🦮',
    color: 'Golden',
    neutered: true,
    microchip: '981 020 001 553 208',
    clinic: { name: 'Riverside Vet Clinic', vet: 'Dr. Sam Patel', phone: '+1 555 0142' },
    emergencyClinic: { name: 'City 24h Animal Emergency', phone: '+1 555 0199' },
    allergies: [],
    conditions: ['Mild hip stiffness in cold weather (monitored)'],
    medications: [
      { name: 'Omega-3 joint supplement', dose: '1 capsule daily with food', since: daysAgo(420) },
      { name: 'Bravecto (flea and tick)', dose: 'Every 12 weeks', since: daysAgo(500) },
    ],
    diet: 'Senior large-breed dry food, 2 meals a day (about 380 g per day)',
    shareForResearch: true,
    weights: [
      { date: daysAgo(180), kg: 32.4 },
      { date: daysAgo(150), kg: 32.1 },
      { date: daysAgo(120), kg: 32.3 },
      { date: daysAgo(90), kg: 32.0 },
      { date: daysAgo(60), kg: 31.9 },
      { date: daysAgo(30), kg: 32.1 },
      { date: daysAgo(2), kg: 32.0 },
    ],
    habits,
    vaccines: [
      { name: 'Rabies', date: daysAgo(90), due: daysAhead(275) },
      { name: 'DHPP', date: daysAgo(90), due: daysAhead(275) },
      { name: 'Leptospirosis', date: daysAgo(90), due: daysAhead(275) },
      { name: 'Lyme disease', date: daysAgo(90), due: daysAhead(275) },
    ],
    labs: [
      {
        id: 'lab-bear-1',
        date: daysAgo(90),
        panel: 'Senior wellness panel',
        lab: 'Riverside Vet Clinic',
        values: [
          { name: 'ALT', value: 62, unit: 'U/L', low: 10, high: 125 },
          { name: 'ALP', value: 110, unit: 'U/L', low: 23, high: 212 },
          { name: 'Creatinine', value: 1.2, unit: 'mg/dL', low: 0.5, high: 1.8 },
          { name: 'BUN', value: 18, unit: 'mg/dL', low: 7, high: 27 },
          { name: 'Glucose', value: 92, unit: 'mg/dL', low: 70, high: 143 },
          { name: 'T4 (thyroid)', value: 2.1, unit: 'µg/dL', low: 1.0, high: 4.0 },
          { name: 'WBC', value: 9.4, unit: '10^9/L', low: 5.5, high: 16.9 },
        ],
      },
    ],
    records: [
      { id: 'rec-b1', type: 'visit', title: 'Senior wellness exam', date: daysAgo(90), text: 'Good body condition (5/9). Mild stiffness in hips on flexion, no pain. Continue omega-3. Vaccines updated.' },
      { id: 'rec-b2', type: 'visit', title: 'Dental cleaning', date: daysAgo(410), text: 'Scale and polish under anaesthesia. No extractions.' },
      { id: 'rec-b3', type: 'note', title: 'Hip X-ray', date: daysAgo(430), text: 'Mild early changes in both hips. Keep lean, regular moderate exercise, swimming encouraged.' },
    ],
  };
}

function seed() {
  return { dogs: [mochi(), bear()] };
}

module.exports = { seed, daysAgo };
