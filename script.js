// ---------- Datos (nombre canonico)
const CANON_NAMES = [
  "Emili Marcel Cabrera Flores",
  "Dulce Naomy Calderón Gonzalez",
  "Jennifer Estefanía Chajón Barrios",
  "Enrique Cifuentes Bauer",
  "Santiago Del Río Méndez",
  "Carlos Rafael Fernández Valdés",
  "Martin Figueroa Tavares",
  "Esteban Renato Fratta Torres",
  "María Fernanda Garcia Barrios",
  "Julian García Fernández de la Torre",
  "Andrea Michelle Lacota Martínez",
  "Maria Amalia Leclair Rodriguez",
  "Fátima Anaí López Castellanos",
  "Maria Andrea Marinelli Toruño",
  "Ana Lucía Morales Paiz",
  "Ana Lucía Muñoz Turcios",
  "Martin Leonardo Rivera Grajeda",
  "José Mariano Rodríguez Rios",
  "Ximena Santizo Murúa",
  "Isabel Siliézar Rodas",
  "Jeanne Marie Wheelock"
];

// Casos más detallados para juego
const TASKS = {
  "Decir elogio": [
    {
      si: "Elogia una acción concreta y su impacto: 'Tu explicación sobre el método hizo que todo el grupo entendiera el porqué —se nota tu claridad al dar ejemplos.'",
      no: "Foco solo en apariencia o comentario fuera de contexto: 'Qué bien te ves' en medio de una exposición técnica."
    },
    {
      si: "Destaca esfuerzo y progreso: 'Se nota que practicaste; ese avance en la resolución fue evidente.'",
      no: "Comparar negativamente con otros: 'Al menos tú sí...' (crea tensión)."
    },
    {
      si: "Relaciona con valores: 'Admiro tu persistencia al completar la tarea a pesar de las dificultades.'",
      no: "Elogio vago y excesivo sin explicación: 'Eres increíble' sin ejemplos."
    }
  ],
  "Adivinar el cumplido": [
    {
      si: "Escucha atentamente y elige si el cumplido se centra en esfuerzo, habilidad o apariencia; argumenta tu elección.",
      no: "Responder impulsivamente 'incorrecto' sin razonarlo."
    },
    {
      si: "Pide detalle si no está claro: '¿Te refieres a mi claridad o a mi estilo?'.",
      no: "Confundir el cumplido con crítica y responder a la defensiva."
    },
    {
      si: "Valora intención y contexto: identifica si el cumplido busca empoderar o solo halagar superficialmente.",
      no: "Tomarlo como una obligación de reciprocidad inmediata."
    }
  ]
};

// ---------- Helpers ----------

// normaliza (quita tildes, case, espacios)
function normalizar(s){
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

// map canonical normalized names for matching
const normalizedMap = CANON_NAMES.reduce((acc, name) => {
  acc[normalizar(name)] = name;
  return acc;
}, {});

// hash seed string into integer (xorshift helper)
function xfnv1a(str) {
  for(var i=0,h=2166136261>>>0;i<str.length;i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return function() { h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; return (h >>> 0); };
}
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// seeded shuffle (Fisher-Yates)
function seededShuffle(array, seed) {
  const a = array.slice();
  const hfn = xfnv1a(seed);
  const seedNum = hfn();
  const rand = mulberry32(seedNum);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// deterministic pairing generation from seed
function generatePairs(seed) {
  // produce order
  const order = seededShuffle(CANON_NAMES, seed);
  // group into pairs, possible last single => trio merge
  const pairs = [];
  for (let i=0;i<order.length;i+=2){
    if (i+1 < order.length) pairs.push([order[i], order[i+1]]);
    else pairs.push([order[i]]);
  }
  if (pairs.length >=2 && pairs[pairs.length-1].length === 1) {
    // form trio with last pair
    const last = pairs.pop()[0];
    const prevPair = pairs.pop(); // array of two
    pairs.push([prevPair[0], prevPair[1], last]);
  }
  // assign roles: for each pair (2) assign one Decir, one Adivinar; for trio: 1 Decir, 2 Adivinar
  const assignments = {}; // name -> { partner(s), role, caseSi, caseNo, group }
  for (const group of pairs) {
    if (group.length === 2) {
      // choose first as Decir with seeded randomness
      const pickSeed = seed + group.join("|");
      const hfn = xfnv1a(pickSeed)();
      const rand = mulberry32(hfn);
      const firstIsDecir = rand() < 0.5;
      const a = firstIsDecir ? ["Decir elogio","Adivinar el cumplido"] : ["Adivinar el cumplido","Decir elogio"];
      const caseA = randomCaseForRole(a[0], seed + group[0]);
      const caseB = randomCaseForRole(a[1], seed + group[1]);
      assignments[group[0]] = { partners: [group[1]], role: a[0], caseSi: caseA.si, caseNo: caseA.no, group: group.slice() };
      assignments[group[1]] = { partners: [group[0]], role: a[1], caseSi: caseB.si, caseNo: caseB.no, group: group.slice() };
    } else if (group.length === 3) {
      // ensure at least 1 Decir and 2 Adivinar
      // pick index for Decir deterministically
      const pickSeed = seed + group.join("|") + "|trio";
      const idx = (xfnv1a(pickSeed)() % 3);
      for (let i=0;i<3;i++){
        const role = i === idx ? "Decir elogio" : "Adivinar el cumplido";
        const c = randomCaseForRole(role, seed + group[i]);
        assignments[group[i]] = { partners: group.filter((_,k)=>k!==i), role, caseSi: c.si, caseNo: c.no, group: group.slice() };
      }
    } else if (group.length === 1) {
      // single (edge)
      const pickSeed = seed + group[0] + "|solo";
      const role = (xfnv1a(pickSeed)() % 2) === 0 ? "Decir elogio" : "Adivinar el cumplido";
      const c = randomCaseForRole(role, seed + group[0]);
      assignments[group[0]] = { partners: [], role, caseSi: c.si, caseNo: c.no, group: group.slice() };
    }
  }
  return assignments;
}

function randomCaseForRole(role, seed) {
  const arr = role === "Decir elogio" ? TASKS["Decir elogio"] : TASKS["Adivinar el cumplido"];
  const idx = xfnv1a(seed)() % arr.length;
  return arr[idx];
}

// ---------- DOM ----------

const nameInput = document.getElementById("nameInput");
const seedInput = document.getElementById("seedInput");
const revealBtn = document.getElementById("revealBtn");
const generateSeedBtn = document.getElementById("generateSeedBtn");
const status = document.getElementById("status");
const resultArea = document.getElementById("resultArea");

// generate random seed (human-friendly)
function makeSeed(){
  const rand = Math.floor(Math.random() * 1e9);
  const time = Date.now() % 1000000;
  return `seed-${time}-${rand}`;
}

// copy text helper
function copyToClipboard(text){
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  } else {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand("copy"); ta.remove();
    return Promise.resolve();
  }
}

// dice animation
function diceAnimate(el, ms = 800){
  return new Promise(resolve => {
    const frames = ["🎲","⚀","⚁","⚂","⚃","⚄","⚅"];
    let iv = setInterval(()=> {
      el.textContent = frames[Math.floor(Math.random()*frames.length)];
      el.style.transform = `rotate(${(Math.random()-0.5)*30}deg) scale(${1 + Math.random()*0.06})`;
    }, 80);
    setTimeout(()=> {
      clearInterval(iv);
      el.style.transform = "rotate(0deg) scale(1)";
      resolve();
    }, ms);
  });
}

// render result card
function renderResult(name, info) {
  resultArea.innerHTML = "";
  const card = document.createElement("div");
  card.className = "result-card";

  const left = document.createElement("div");
  left.className = "result-left";
  const right = document.createElement("div");
  right.className = "result-right";

  const h = document.createElement("div");
  h.className = "name";
  h.textContent = name;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `<span class="role-badge">${info.role}</span>`;

  const dice = document.createElement("div");
  dice.className = "dice";
  dice.textContent = "🎲";

  left.appendChild(h);
  left.appendChild(meta);
  left.appendChild(dice);

  // partners display
  const partners = document.createElement("div");
  partners.className = "meta";
  partners.style.marginTop = "8px";
  if (info.partners.length === 0) {
    partners.textContent = "No tienes pareja asignada (caso único).";
  } else {
    partners.innerHTML = `<strong>Pareja(s):</strong> ${info.partners.join(" — ")}`;
  }

  // behavior cases
  const caseSi = document.createElement("div");
  caseSi.className = "case";
  caseSi.innerHTML = `<b>Cómo sí</b><div>${info.caseSi}</div>`;

  const caseNo = document.createElement("div");
  caseNo.className = "case";
  caseNo.style.marginTop = "8px";
  caseNo.innerHTML = `<b>Cómo no</b><div>${info.caseNo}</div>`;

  right.appendChild(partners);
  right.appendChild(caseSi);
  right.appendChild(caseNo);

  card.appendChild(left);
  card.appendChild(right);
  resultArea.appendChild(card);

  // animate dice then reveal role (visual)
  diceAnimate(dice, 900).then(()=> {
    // small bounce
    dice.style.transform = "scale(1.07)";
    setTimeout(()=> dice.style.transform = "scale(1)", 200);
  });
}

// reveal handler
revealBtn.addEventListener("click", () => {
  const rawName = nameInput.value || "";
  const rawSeed = (seedInput.value || "").trim();
  status.textContent = "";
  resultArea.innerHTML = "";

  if (!rawName.trim()) {
    status.textContent = "Ingresa tu nombre completo.";
    return;
  }
  const n = normalizar(rawName);
  // try exact normalized match
  if (!normalizedMap[n]) {
    // try fuzzy: find includes normalized fragment
    const found = Object.keys(normalizedMap).find(k => k.includes(n) || n.includes(k));
    if (found) {
      // accept that match
      const canonical = normalizedMap[found];
      proceedReveal(canonical, rawSeed || null);
      return;
    } else {
      status.textContent = "Nombre no reconocido. Asegúrate de escribir el nombre completo (sin tildes o mayúsculas necesarias).";
      return;
    }
  }
  const canonical = normalizedMap[n];
  proceedReveal(canonical, rawSeed || null);
});

function proceedReveal(canonicalName, seed) {
  // if no seed: create local default seed (not shared) and warn
  if (!seed) {
    status.textContent = "Advertencia: No pegaste un seed. Se generará una asignación local que NO coincidirá con otros dispositivos. Para simultaneidad, pide el seed al profesor.";
    seed = "local-default"; // deterministic but local only
  } else {
    status.textContent = "Seed recibido. Generando tu pareja y rol...";
  }

  // generate deterministic assignments
  const assignments = generatePairs(seed);
  // if canonicalName not in assignments (shouldn't happen) -> error
  if (!assignments[canonicalName]) {
    status.textContent = "Error interno: tu nombre no aparece en la lista generada con este seed.";
    return;
  }
  // render
  renderResult(canonicalName, assignments[canonicalName]);
  // optionally store last used seed for reference
  try { localStorage.setItem("lastSeedUsed", seed); } catch(e){}
}

// generate seed button
generateSeedBtn.addEventListener("click", async () => {
  const s = makeSeed();
  try {
    await copyToClipboard(s);
    status.textContent = `Seed generado y copiado al portapapeles: ${s} — compártelo con los alumnos.`;
  } catch(e){
    status.textContent = `Seed: ${s} (cópialo manualmente).`;
  }
});
