import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Calculator, Zap, Snowflake, Flame, Gauge, ArrowRight, CheckCircle, X, Check, ChevronRight, RotateCcw, Trophy, Heart, Info, Eraser, Target, Thermometer, Lightbulb } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════════════════════

const SCREENS = [
  'start', 'm1_intro',
  'm1r1', 'm1r1_check',
  'm1r2', 'm1r2_check',
  'm1r3', 'm1r3_check',
  'm2_intro',
  'm2r1', 'm2r1_check',
  'm2r2', 'm2r2_check',
  'm2r3', 'm2r3_check',
  'end'
];

// ═══════════════════════════════════════════════════════════════
// R-134a SATURATION TABLE
// ═══════════════════════════════════════════════════════════════

const SAT_TABLE = [
  { T: -40, P: 0.51, hL: 148, hV: 373 },
  { T: -30, P: 0.85, hL: 161, hV: 380 },
  { T: -26, P: 1.00, hL: 166, hV: 383 },
  { T: -20, P: 1.33, hL: 174, hV: 386 },
  { T: -10, P: 2.01, hL: 187, hV: 392 },
  { T: -4,  P: 2.50, hL: 193, hV: 395 },
  { T:  0,  P: 2.93, hL: 200, hV: 398 },
  { T:  1,  P: 3.00, hL: 201, hV: 398 },
  { T: 10,  P: 4.15, hL: 213, hV: 404 },
  { T: 20,  P: 5.72, hL: 227, hV: 409 },
  { T: 30,  P: 7.70, hL: 241, hV: 414 },
  { T: 32,  P: 8.00, hL: 243, hV: 415 },
  { T: 36,  P: 9.00, hL: 249, hV: 416 },
  { T: 40,  P: 10.16, hL: 256, hV: 418 },
  { T: 50,  P: 13.18, hL: 271, hV: 421 },
  { T: 60,  P: 16.81, hL: 287, hV: 424 },
  { T: 70,  P: 21.16, hL: 303, hV: 425 },
  { T: 80,  P: 26.33, hL: 320, hV: 425 },
  { T: 90,  P: 32.44, hL: 339, hV: 423 },
  { T: 100, P: 39.72, hL: 358, hV: 418 },
];

const CRITICAL_POINT = { h: 373, P: 40.59, T: 101 };

function lerp(a, b, t) { return a + (b - a) * t; }

function satAtP(P) {
  if (P <= SAT_TABLE[0].P) return SAT_TABLE[0];
  if (P >= SAT_TABLE[SAT_TABLE.length - 1].P) return SAT_TABLE[SAT_TABLE.length - 1];
  for (let i = 0; i < SAT_TABLE.length - 1; i++) {
    const a = SAT_TABLE[i], b = SAT_TABLE[i + 1];
    if (P >= a.P && P <= b.P) {
      const t = (Math.log(P) - Math.log(a.P)) / (Math.log(b.P) - Math.log(a.P));
      return { T: lerp(a.T, b.T, t), P, hL: lerp(a.hL, b.hL, t), hV: lerp(a.hV, b.hV, t) };
    }
  }
  return SAT_TABLE[SAT_TABLE.length - 1];
}

function satAtT(T) {
  if (T <= SAT_TABLE[0].T) return SAT_TABLE[0];
  if (T >= SAT_TABLE[SAT_TABLE.length - 1].T) return SAT_TABLE[SAT_TABLE.length - 1];
  for (let i = 0; i < SAT_TABLE.length - 1; i++) {
    const a = SAT_TABLE[i], b = SAT_TABLE[i + 1];
    if (T >= a.T && T <= b.T) {
      const t = (T - a.T) / (b.T - a.T);
      return { T, P: Math.exp(lerp(Math.log(a.P), Math.log(b.P), t)), hL: lerp(a.hL, b.hL, t), hV: lerp(a.hV, b.hV, t) };
    }
  }
  return SAT_TABLE[SAT_TABLE.length - 1];
}

function lookupTemp(h, P) {
  const sat = satAtP(P);
  if (h < sat.hL - 1) {
    if (h <= SAT_TABLE[0].hL) return SAT_TABLE[0].T;
    for (let i = 0; i < SAT_TABLE.length - 1; i++) {
      if (h >= SAT_TABLE[i].hL && h <= SAT_TABLE[i + 1].hL) {
        const t = (h - SAT_TABLE[i].hL) / (SAT_TABLE[i + 1].hL - SAT_TABLE[i].hL);
        return lerp(SAT_TABLE[i].T, SAT_TABLE[i + 1].T, t);
      }
    }
    return SAT_TABLE[SAT_TABLE.length - 1].T;
  }
  if (h > sat.hV + 1) {
    return sat.T + (h - sat.hV) / 0.9;
  }
  return sat.T;
}

// ═══════════════════════════════════════════════════════════════
// DIAGRAM GEOMETRIE
// ═══════════════════════════════════════════════════════════════

const SVG_W = 900, SVG_H = 560;
const PLOT = { left: 95, right: 870, top: 40, bottom: 500 };
const PLOT_W = PLOT.right - PLOT.left;
const PLOT_H = PLOT.bottom - PLOT.top;
const RANGE = { hMin: 140, hMax: 560, pMin: 0.5, pMax: 50 };

function enthalpyToX(h) {
  return PLOT.left + ((h - RANGE.hMin) / (RANGE.hMax - RANGE.hMin)) * PLOT_W;
}
function xToEnthalpy(x) {
  return RANGE.hMin + ((x - PLOT.left) / PLOT_W) * (RANGE.hMax - RANGE.hMin);
}
function pressureToY(P) {
  const logPMin = Math.log10(RANGE.pMin), logPMax = Math.log10(RANGE.pMax);
  return PLOT.bottom - ((Math.log10(P) - logPMin) / (logPMax - logPMin)) * PLOT_H;
}
function yToPressure(y) {
  const logPMin = Math.log10(RANGE.pMin), logPMax = Math.log10(RANGE.pMax);
  return Math.pow(10, logPMin + ((PLOT.bottom - y) / PLOT_H) * (logPMax - logPMin));
}
function hpToXY(h, P) {
  return [enthalpyToX(h), pressureToY(P)];
}

const P_GRID = [0.5, 1, 2, 5, 10, 20, 50];
const H_GRID = [140, 200, 260, 320, 380, 440, 500, 560];

const LIQUID_POINTS = SAT_TABLE.map(s => [s.hL, s.P]).concat([[CRITICAL_POINT.h, CRITICAL_POINT.P]]);
const VAPOR_POINTS = SAT_TABLE.map(s => [s.hV, s.P]).concat([[CRITICAL_POINT.h, CRITICAL_POINT.P]]);

function pointsToPath(pts) {
  return pts.map(([h, P], i) => {
    const [x, y] = hpToXY(h, P);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

const LIQUID_PATH = pointsToPath(LIQUID_POINTS);
const VAPOR_PATH = pointsToPath(VAPOR_POINTS);
const DOME_PATH = (() => {
  const liqPx = LIQUID_POINTS.map(([h, P]) => hpToXY(h, P));
  const vapPx = [...VAPOR_POINTS].reverse().map(([h, P]) => hpToXY(h, P));
  return [...liqPx, ...vapPx].map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
})();

const ISOTHERM_TEMPS = [-20, 0, 20, 40, 60, 80];

function buildIsotherm(T) {
  const sat = satAtT(T);
  const pts = [];
  if (sat.P < 50) { pts.push([sat.hL, 50]); pts.push([sat.hL, sat.P]); } else { pts.push([sat.hL, sat.P]); }
  pts.push([sat.hV, sat.P]);
  const steps = 12;
  const pMin = 0.5;
  for (let i = 1; i <= steps; i++) {
    const frac = i / steps;
    const p = sat.P * Math.pow(pMin / sat.P, frac);
    if (p < pMin) break;
    const dh = 2.0 * Math.log10(sat.P / p);
    pts.push([sat.hV + dh, p]);
  }
  return pts;
}

const ISOTHERM_PATHS = ISOTHERM_TEMPS.map(T => ({
  T,
  path: pointsToPath(buildIsotherm(T).filter(([h, P]) => h >= RANGE.hMin - 20 && h <= RANGE.hMax + 20 && P >= RANGE.pMin && P <= RANGE.pMax)),
  labelPos: (() => {
    const sat = satAtT(T);
    const [x, y] = hpToXY(sat.hL - 4, sat.P);
    return { x, y };
  })(),
}));

// ═══════════════════════════════════════════════════════════════
// GAME DATA — MISSIE 1
// ═══════════════════════════════════════════════════════════════

const M1_ENTHALPIES = { h1: 405, h2: 435, h3: 235, h4: 235 };

const POWER_LABELS = [
  { id: 'verdamper', label: 'Verdampervermogen', sub: 'Q̇_verd', lineKey: 'verdamper', color: '#059669' },
  { id: 'compressor', label: 'Compressorvermogen', sub: 'P_comp', lineKey: 'compressor', color: '#2563EB' },
  { id: 'condensor', label: 'Condensorvermogen', sub: 'Q̇_cond', lineKey: 'condensor', color: '#DC2626' },
];

// ═══════════════════════════════════════════════════════════════
// GAME DATA — MISSIE 2: OVERVERHITTING & NAKOELING
// ═══════════════════════════════════════════════════════════════

const M2_MEASUREMENTS = {
  lowPressureEff: 1.5,
  highPressureEff: 7.0,
  lowPressureAbs: 2.5,
  highPressureAbs: 8.0,
  T_verdamping: -4,
  T_condensatie: 32,
  T_eindcompressie: 70,
  T_voor_expansie: 12,  // NAK = 32 − 12 = 20K — duidelijk zichtbaar
  T_zuigleiding: 22,   // OVH = 22 − (−4) = 26K — duidelijk zichtbaar
};

function computePoint(T, P, region) {
  const sat = satAtP(P);
  if (region === 'superheated') {
    const h = sat.hV + 0.9 * (T - sat.T);
    return { h, P };
  }
  if (region === 'subcooled') {
    const hLAtT = satAtT(T).hL;
    return { h: hLAtT, P };
  }
  return { h: sat.hL + (sat.hV - sat.hL) * 0.5, P };
}

const OVH_TABLE = [
  { range: 'Te laag (<3K)', cause: 'Slecht afgesteld expansieventiel, te veel koudemiddel', meaning: 'Kans op natte slag (vloeistof) in je compressor', key: 'low' },
  { range: 'Normaal (5–8K)', cause: 'Alles werkt zoals het hoort', meaning: 'Goede vulling en verdamping', key: 'normal' },
  { range: 'Te hoog (10–15K)', cause: 'Te weinig koudemiddel, vervuiling of verstopping', meaning: 'Onderkoeling in verdamper, risico op slechte koeling en oververhitte compressor', key: 'high' },
];

const NAK_TABLE = [
  { range: 'Te laag (<2K)', cause: 'Te weinig koudemiddel of lucht in het systeem', meaning: 'Kans op flashgas voor het expansieventiel, slechte koeling', key: 'low' },
  { range: 'Normaal (3–8K)', cause: 'Alles werkt goed', meaning: 'Volledig vloeibare toevoer naar het expansieventiel', key: 'normal' },
  { range: 'Te hoog (12–15K)', cause: 'Overvuld systeem met slechte warmteoverdracht', meaning: 'Kan op overvulling of te grote condensor duiden. Efficiëntieprobleem', key: 'high' },
];

const DIAGNOSIS_TABLE = [
  { ovh: 'Hoog', nak: 'Laag', diagnosis: 'Te weinig koudemiddel', key: 'underfill' },
  { ovh: 'Laag', nak: 'Hoog', diagnosis: 'Te veel koudemiddel', key: 'overfill' },
  { ovh: 'Normaal', nak: 'Normaal', diagnosis: 'Systeem werkt goed', key: 'ok' },
  { ovh: 'Hoog', nak: 'Hoog', diagnosis: 'Verstopping of slechte warmteoverdracht', key: 'blockage' },
  { ovh: 'Laag', nak: 'Laag', diagnosis: 'Slechte regeling of lekkage in expansieventiel', key: 'leak' },
];

const M2R2_SCENARIOS = [
  { ovhValue: 12, nakValue: 1.5, ovhClass: 'high', nakClass: 'low', diagnosisKey: 'underfill', label: 'Installatie A' },
  { ovhValue: 2, nakValue: 13, ovhClass: 'low', nakClass: 'high', diagnosisKey: 'overfill', label: 'Installatie B' },
  { ovhValue: 6, nakValue: 5, ovhClass: 'normal', nakClass: 'normal', diagnosisKey: 'ok', label: 'Installatie C' },
  { ovhValue: 11, nakValue: 14, ovhClass: 'high', nakClass: 'high', diagnosisKey: 'blockage', label: 'Installatie D' },
  { ovhValue: 1.5, nakValue: 1, ovhClass: 'low', nakClass: 'low', diagnosisKey: 'leak', label: 'Installatie E' },
];

const M2R3_SCENARIOS = [
  {
    // Verstopping / slechte warmteoverdracht: OVH hoog, NAK hoog
    label: 'Scenario 1',
    lowP: 2.5, highP: 8.0,
    T_zuig: 9, T_verdamping: -4, T_condensatie: 32, T_voor_expansie: 19, T_eindcompressie: 70,
    expectedOVH: 13, expectedNAK: 13,
    ovhAssessment: 'high', nakAssessment: 'high',
    diagnosis: 'Verstopping of slechte warmteoverdracht',
  },
  {
    // Systeem werkt goed: OVH normaal, NAK normaal
    label: 'Scenario 2',
    lowP: 3.0, highP: 9.0,
    T_zuig: 9, T_verdamping: 1, T_condensatie: 36, T_voor_expansie: 28, T_eindcompressie: 70,
    expectedOVH: 8, expectedNAK: 8,
    ovhAssessment: 'normal', nakAssessment: 'normal',
    diagnosis: 'Systeem werkt goed',
  },
  {
    // Te weinig koudemiddel: OVH hoog, NAK laag
    label: 'Scenario 3',
    lowP: 2.01, highP: 7.7,
    T_zuig: 3, T_verdamping: -10, T_condensatie: 30, T_voor_expansie: 29, T_eindcompressie: 70,
    expectedOVH: 13, expectedNAK: 1,
    ovhAssessment: 'high', nakAssessment: 'low',
    diagnosis: 'Te weinig koudemiddel',
  },
];

// ═══════════════════════════════════════════════════════════════
// ITEMBANKS
// ═══════════════════════════════════════════════════════════════

const ITEMBANKS = {
  m1r1_check: [
    { question: 'Wat is de betekenis van lijnstuk A (zie Figuur 1)?',
      options: ['Het verdampervermogen', 'De condensorwarmte', 'De compressorarbeid', 'De oververhitting'],
      correct: 0,
      feedbackCorrect: 'Juist! Lijnstuk A is het verdampervermogen: het totale enthalpieverschil in de verdamper (h1 − h4).',
      feedbackWrong: 'Lijnstuk A is de volle breedte van het bootje aan de onderkant. Dat is het verdampervermogen.' },
    { question: 'Wat is de betekenis van lijnstuk B (zie Figuur 1)?',
      options: ['Het verdampervermogen', 'De condensorwarmte', 'De verdamping', 'De oververhitting'],
      correct: 2,
      feedbackCorrect: 'Juist! Lijnstuk B is de verdamping: van punt 4 tot waar het koudemiddel volledig verdampt is (1\').',
      feedbackWrong: 'Lijnstuk B loopt van h4 tot h1\' (binnen de dome). Dat is de verdamping.' },
    { question: 'Wat is de betekenis van lijnstuk C (zie Figuur 1)?',
      options: ['De verdamping', 'De condensorwarmte', 'De totale nakoeling', 'De oververhitting'],
      correct: 2,
      feedbackCorrect: 'Juist! Lijnstuk C is de totale nakoeling: de vloeistof wordt extra afgekoeld onder de verzadigingstemperatuur.',
      feedbackWrong: 'Lijnstuk C loopt van h3 tot de vloeistoflijn (h3\'). Dat is de totale nakoeling.' },
    { question: 'Wat is de betekenis van lijnstuk F (zie Figuur 1)?',
      options: ['De verdamping', 'De condensatie', 'De totale nakoeling', 'De oververhitting'],
      correct: 3,
      feedbackCorrect: 'Juist! Lijnstuk F is de oververhitting: het gas wordt extra opgewarmd boven de verdampingstemperatuur.',
      feedbackWrong: 'Lijnstuk F loopt van de damplijn (h1\') tot punt 1. Dat is de oververhitting.' },
  ],
  m1r2_check: [
    { question: 'Een koelmachine heeft een verdampervermogen van 200 kJ/kg en een compressorvermogen van 40 kJ/kg. Wat is de EER?',
      options: ['4,0', '5,0', '6,0', '8,0'],
      correct: 1,
      feedbackCorrect: 'Juist! EER = 200 / 40 = 5,0.',
      feedbackWrong: 'EER = Δh_verd / Δh_comp = 200 / 40 = 5,0.' },
    { question: 'Wat betekent een EER van 4 concreet?',
      options: ['Per 1 kW elektrisch wordt 4 kW koelvermogen geleverd', 'De installatie verbruikt 4 kW meer dan een standaard', 'Het is 4 keer efficiënter dan een warmtepomp', 'Er wordt 4 keer zoveel warmte afgevoerd als opgenomen'],
      correct: 0,
      feedbackCorrect: 'Precies. EER = 4 betekent: 4 kW koeling per 1 kW elektrisch.',
      feedbackWrong: 'EER is de verhouding koelvermogen / elektrisch vermogen. Bij EER = 4 krijg je 4 kW koeling per 1 kW elektrisch.' },
    { question: 'Voor welk apparaat gebruik je de EER-waarde?',
      options: ['Warmtepomp', 'Koelmachine', 'CV-ketel', 'Airco en warmtepomp gecombineerd'],
      correct: 1,
      feedbackCorrect: 'Klopt! EER gebruik je voor koelmachines. COP gebruik je voor warmtepompen.',
      feedbackWrong: 'EER = Energy Efficiency Ratio → koelmachines. COP is voor warmtepompen.' },
  ],
  m1r3_check: [
    { question: 'Een installatie heeft een COP van 3,8. Wat is de EER?',
      options: ['1,8', '2,8', '3,8', '4,8'],
      correct: 1,
      feedbackCorrect: 'Goed! COP = EER + 1, dus EER = COP − 1 = 2,8.',
      feedbackWrong: 'Onthoud: COP = EER + 1. Dus EER = COP − 1 = 3,8 − 1 = 2,8.' },
    { question: 'Waarom is de COP altijd hoger dan de EER?',
      options: ['De condensor voert meer energie af dan de verdamper opneemt (extra door compressor)', 'Warmtepompen zijn nu eenmaal efficiënter', 'Het is een marketing-truc van fabrikanten', 'COP gebruikt een andere formule zonder compressor'],
      correct: 0,
      feedbackCorrect: 'Precies! De condensor voert álle warmte af: de warmte uit de verdamper plus de energie van de compressor.',
      feedbackWrong: 'De condensor voert de verdamperwarmte én de compressorenergie af. Daardoor is COP = EER + 1.' },
    { question: 'Welk rendement gebruik je om een warmtepomp te beoordelen die een woning verwarmt?',
      options: ['EER, want je meet het koel-effect', 'COP, want je meet het verwarmings-effect', 'Beide geven hetzelfde antwoord', 'Geen van beide, je gebruikt het condensorvermogen'],
      correct: 1,
      feedbackCorrect: 'Goed! Voor verwarmen gebruik je de COP.',
      feedbackWrong: 'Voor verwarmen gebruik je de COP (warmte / elektrisch). EER is voor koelen.' },
  ],
  m2r1_check: [
    { question: 'Wat is de betekenis van lijnstuk A (zie Figuur 1)?',
      options: ['Het verdampervermogen', 'De condensorwarmte', 'De totale nakoeling', 'De oververhitting'],
      correct: 0,
      feedbackCorrect: 'Juist! Lijnstuk A is het verdampervermogen: het totale enthalpieverschil in de verdamper (h1 − h4).',
      feedbackWrong: 'Lijnstuk A is het totale bereik onder het bootje, van punt 4 naar punt 1. Dat is het verdampervermogen.' },
    { question: 'Wat is de betekenis van lijnstuk B (zie Figuur 1)?',
      options: ['Het verdampervermogen', 'De verdamping', 'De totale nakoeling', 'De oververhitting'],
      correct: 1,
      feedbackCorrect: 'Juist! Lijnstuk B is de verdamping: van punt 4 tot waar het koudemiddel volledig is verdampt (1\').',
      feedbackWrong: 'Lijnstuk B loopt van h4 tot h1\'. Dat is de verdamping (zonder de oververhitting).' },
    { question: 'Wat is de betekenis van lijnstuk C (zie Figuur 1)?',
      options: ['Het verdampervermogen', 'De condensorwarmte', 'De totale nakoeling', 'De oververhitting'],
      correct: 2,
      feedbackCorrect: 'Juist! Lijnstuk C is de totale nakoeling (onderkoeling): de vloeistof wordt extra afgekoeld onder de verzadigingstemperatuur.',
      feedbackWrong: 'Lijnstuk C loopt van h3 tot h3\' (de vloeistoflijn). Dat is de totale nakoeling.' },
    { question: 'Wat is de betekenis van lijnstuk D (zie Figuur 1)?',
      options: ['De verdamping', 'De condensatie', 'De totale nakoeling', 'De oververhitting'],
      correct: 1,
      feedbackCorrect: 'Juist! Lijnstuk D is de condensatie: het koudemiddel gaat in het coëxistentiegebied van damp naar vloeistof.',
      feedbackWrong: 'Lijnstuk D loopt binnen de dome, van h3\' tot h2\'. Dat is de condensatie.' },
    { question: 'Wat is de betekenis van lijnstuk C + D + E (zie Figuur 1)?',
      options: ['Het verdampervermogen', 'Het condensorvermogen', 'De compressorarbeid', 'De oververhitting'],
      correct: 1,
      feedbackCorrect: 'Juist! C + D + E samen is het totale condensorvermogen: nakoeling + condensatie + afkoeling van de oververhitte damp.',
      feedbackWrong: 'C + D + E spant de hele bovenkant van het bootje. Dat is het condensorvermogen (h2 − h3).' },
    { question: 'Wat is de betekenis van lijnstuk F (zie Figuur 1)?',
      options: ['De verdamping', 'De condensatie', 'De totale nakoeling', 'De oververhitting'],
      correct: 3,
      feedbackCorrect: 'Juist! Lijnstuk F is de oververhitting: het gas wordt extra opgewarmd boven de verdampingstemperatuur.',
      feedbackWrong: 'Lijnstuk F loopt van h1\' tot h1. Dat is de oververhitting.' },
  ],
  m2r2_check: [
    { question: 'Een installatie heeft OVH = 12K en NAK = 1K. Wat is de meest waarschijnlijke diagnose?',
      options: ['Te veel koudemiddel', 'Te weinig koudemiddel', 'Systeem werkt goed', 'Verstopping in het systeem'],
      correct: 1,
      feedbackCorrect: 'Klopt! Hoge OVH + lage NAK wijst op te weinig koudemiddel.',
      feedbackWrong: 'Hoge oververhitting in combinatie met lage nakoeling duidt op te weinig koudemiddel in het systeem.' },
    { question: 'Wat is het risico bij een oververhitting van slechts 1K?',
      options: ['De compressor wordt te warm', 'Er kan vloeistof in de compressor komen (natte slag)',
                'Het expansieventiel gaat kapot', 'De condensor wordt overbelast'],
      correct: 1,
      feedbackCorrect: 'Juist! Bij te lage oververhitting is het koudemiddel mogelijk nog niet volledig verdampt, waardoor druppels de compressor bereiken.',
      feedbackWrong: 'Te lage OVH (<3K) betekent risico op natte slag: vloeistofdruppels in de compressor.' },
    { question: 'Beide waarden (OVH en NAK) zijn te hoog. Wat is het probleem?',
      options: ['Te weinig koudemiddel', 'Te veel koudemiddel', 'Verstopping of slechte warmteoverdracht', 'Lekkage aan het expansieventiel'],
      correct: 2,
      feedbackCorrect: 'Goed! Hoge OVH + hoge NAK wijst op een verstopping of slechte warmteoverdracht in het systeem.',
      feedbackWrong: 'Als beide waarden te hoog zijn, wijst dat op een verstopping of problemen met warmteoverdracht.' },
  ],
  m2r3_check: [
    { question: 'Een installatie heeft een OVH van 6K en een NAK van 5K. Wat is je conclusie?',
      options: ['Te weinig koudemiddel', 'Het systeem werkt goed', 'Te veel koudemiddel', 'Verstopping in het systeem'],
      correct: 1,
      feedbackCorrect: 'Klopt! OVH 5–8K en NAK 3–8K zijn normale waarden. Het systeem werkt goed.',
      feedbackWrong: 'OVH van 6K (normaal: 5–8K) en NAK van 5K (normaal: 3–8K) vallen beide in het normale bereik.' },
    { question: 'Waar lees je de nakoeling af in het h-log p diagram?',
      options: ['Het temperatuurverschil tussen punt 1 en punt 1\' (op de damplijn)',
                'Het temperatuurverschil tussen punt 3\' (op de vloeistoflijn) en punt 3',
                'Het drukverschil tussen de hoge- en lagedruklijn',
                'Het enthalpieverschil tussen punt 2 en punt 3'],
      correct: 1,
      feedbackCorrect: 'Juist! Nakoeling is het temperatuurverschil tussen het verzadigingspunt op de vloeistoflijn (3\') en het werkelijke punt 3.',
      feedbackWrong: 'Nakoeling = T_condensatie (punt 3\' op de vloeistoflijn) − T_voor_expansie (punt 3).' },
    { question: 'Wat gebeurt er als er te weinig nakoeling is?',
      options: ['De compressor gaat kapot', 'Er ontstaat flashgas vóór het expansieventiel',
                'De verdamper bevriest', 'De druk wordt te laag'],
      correct: 1,
      feedbackCorrect: 'Goed! Zonder voldoende nakoeling kan er flashgas ontstaan in de vloeistofleiding, wat het koelvermogen verlaagt.',
      feedbackWrong: 'Te weinig nakoeling = risico op flashgas. Het koudemiddel begint al te verdampen voordat het door het expansieventiel gaat.' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════════

const SCORING = {
  m1r1: { perLabel: 2 },
  m1r1_check: { first: 4, second: 2 },
  m1r2: { perStep: 3, final: 4 },
  m1r2_check: { first: 4, second: 2 },
  m1r3: { first: 4, aha: 6 },
  m1r3_check: { first: 4, second: 2 },
  m2r1: { perSegment: 3 },
  m2r1_check: { first: 4, second: 2 },
  m2r2: { perScenario: 3, bonus: 3 },
  m2r2_check: { first: 4, second: 2 },
  m2r3: { perReading: 2, perAssessment: 2 },
  m2r3_check: { first: 4, second: 2 },
};

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function prepareAllQuestions(itembank) {
  // Kies 1 willekeurige vraag uit de itembank
  const q = itembank[Math.floor(Math.random() * itembank.length)];
  const items = q.options.map((opt, i) => ({ text: opt, isCorrect: i === q.correct }));
  const shuffled = shuffleArray(items);
  return [{
    question: q.question,
    options: shuffled.map(x => x.text),
    correct: shuffled.findIndex(x => x.isCorrect),
    feedbackCorrect: q.feedbackCorrect,
    feedbackWrong: q.feedbackWrong,
  }];
}

function getMissionAndRound(screen) {
  const idx = SCREENS.indexOf(screen);
  if (idx <= 0) return { mission: 0, round: 0, total: 3 };
  if (idx <= 7) return { mission: 1, round: Math.ceil(idx / 2), total: 3 };
  if (idx <= 14) return { mission: 2, round: Math.ceil((idx - 8) / 2), total: 3 };
  return { mission: 2, round: 3, total: 3 };
}

function fmtNum(n, decimals = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(decimals).replace('.', ',');
}
function parseNum(str) {
  if (typeof str !== 'string') return NaN;
  return parseFloat(str.replace(',', '.'));
}

// ═══════════════════════════════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════════════════════════════

function ProgressBar({ screen, lives, score }) {
  const info = getMissionAndRound(screen);
  if (info.mission === 0) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm" style={{ background: '#2C1810' }}>
      <span className="font-bold text-white">Missie {info.mission}</span>
      <span className="text-white/40">|</span>
      <div className="flex gap-1">
        {Array.from({ length: info.total }, (_, i) => i + 1).map(r => (
          <div key={r} className={`w-3 h-3 rounded-full border-2 border-white/60 ${r <= info.round ? 'bg-white' : 'bg-transparent'}`} />
        ))}
      </div>
      {screen.includes('_check') && <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#FBBF24', color: '#2C1810' }}>Check</span>}
      <div className="ml-auto flex items-center gap-3">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(h => (
            <Heart key={h} className="w-4 h-4 transition-all duration-300"
              fill={h <= lives ? '#E74C3C' : 'transparent'}
              stroke={h <= lives ? '#E74C3C' : '#8B7355'}
              style={{ opacity: h <= lives ? 1 : 0.3 }} />
          ))}
        </div>
        <span className="text-white font-bold text-sm">Score: <span style={{ color: '#FBBF24' }}>{score}</span></span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// QUIZ CHECK
// ═══════════════════════════════════════════════════════════════

function QuizCheck({ quizQs, maxPoints, onComplete, onLoseLife, lives, showBootje = false, bootjeMode = 'default', examFigure = null }) {
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(false);
  const [attemptsThisQ, setAttemptsThisQ] = useState(0);
  const [questionDone, setQuestionDone] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);

  const quizQ = quizQs[qIdx];
  const isLast = qIdx === quizQs.length - 1;
  const perQuestionMax = { first: Math.ceil(maxPoints.first / quizQs.length), second: Math.ceil(maxPoints.second / quizQs.length) };

  const handleCheck = () => {
    if (selected === null || lives <= 0) return;
    const isCorrect = selected === quizQ.correct;
    const newAttempts = attemptsThisQ + 1;
    setAttemptsThisQ(newAttempts);
    setChecked(true);
    if (isCorrect) {
      const pts = newAttempts === 1 ? perQuestionMax.first : perQuestionMax.second;
      setTotalPoints(p => p + pts);
      setQuestionDone(true);
    } else {
      onLoseLife?.();
    }
  };

  const handleRetry = () => { setSelected(null); setChecked(false); };

  const handleNext = () => {
    if (isLast) {
      onComplete(totalPoints);
    } else {
      setQIdx(i => i + 1); setSelected(null); setChecked(false); setAttemptsThisQ(0); setQuestionDone(false);
    }
  };

  const isCorrect = checked && selected === quizQ.correct;
  const isWrong = checked && !isCorrect;

  return (
    <div className="max-w-lg mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
      <div className="bg-white rounded-2xl p-6" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <p className="text-xs font-bold mb-2" style={{ color: '#5C3A21' }}>Vraag {qIdx + 1} van {quizQs.length}</p>
        {examFigure === 'exam' && <div className="mb-3"><ExamBootjeFigure /></div>}
        {showBootje && !examFigure && (
          <div className="mb-3">
            <StylizedBootje
              enthalpies={M1_ENTHALPIES}
              powerPlaced={bootjeMode === 'letters' ? {} : { verdamper: true, compressor: true, condensor: true }}
              showGuidelines={bootjeMode !== 'letters'}
              showDome={true}
              showSegmentLetters={bootjeMode === 'letters'}
              width={540}
              height={340} />
            {bootjeMode === 'letters' && <p className="text-xs italic text-center mt-1" style={{ color: '#5C3A21' }}>Figuur 1</p>}
          </div>
        )}
        <h3 className="text-lg font-bold italic mb-4" style={{ color: '#2C1810' }}>{quizQ.question}</h3>
        <div className="space-y-2 mb-4">
          {quizQ.options.map((opt, i) => {
            let optStyle = { border: '2px solid #e8e0c8', background: '#FAFAF5' };
            if (selected === i && !checked) optStyle = { border: '2px solid #5C3A21', background: '#f0e8d0' };
            if (checked && isCorrect && i === quizQ.correct) optStyle = { border: '2px solid #6B8E3D', background: 'rgba(107,142,61,0.1)' };
            if (checked && selected === i && i !== quizQ.correct) optStyle = { border: '2px solid #B84A3D', background: 'rgba(184,74,61,0.1)' };
            return (
              <button key={i} disabled={questionDone || checked} onClick={() => setSelected(i)}
                className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all hover:brightness-95 cursor-pointer" style={optStyle}>
                <span style={{ color: '#2C1810' }}>{opt}</span>
                {checked && isCorrect && i === quizQ.correct && <Check className="inline ml-2" size={16} style={{ color: '#6B8E3D' }} />}
                {checked && selected === i && i !== quizQ.correct && <X className="inline ml-2" size={16} style={{ color: '#B84A3D' }} />}
              </button>
            );
          })}
        </div>
        {checked && (
          <div className="p-3 rounded-xl text-sm mb-3 text-white italic" style={{ background: isCorrect ? '#6B8E3D' : '#B84A3D' }}>
            {isCorrect ? quizQ.feedbackCorrect : quizQ.feedbackWrong}
          </div>
        )}
        {!checked && !questionDone && (
          <button onClick={handleCheck} disabled={selected === null}
            className="w-full py-3 rounded-xl font-bold italic text-white hover:brightness-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 rgba(0,0,0,0.2)' }}>
            Controleer
          </button>
        )}
        {isWrong && lives > 0 && (
          <button onClick={handleRetry}
            className="w-full py-3 rounded-xl font-bold italic text-white hover:brightness-90 active:scale-95"
            style={{ background: '#B84A3D', border: '2px solid #2C1810', boxShadow: '0 3px 0 rgba(0,0,0,0.2)' }}>
            Probeer opnieuw
          </button>
        )}
        {questionDone && (
          <button onClick={handleNext}
            className="w-full py-3 rounded-xl font-bold italic text-white hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
            style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>
            {isLast ? 'Verder' : 'Volgende vraag'} <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// R-134a DIAGRAM (SVG)
// ═══════════════════════════════════════════════════════════════

function R134aDiagram({ children, lines = {}, points = {}, onDiagramClick, showCrosshair = true, activeTool = null, showReadout = true, svgRef }) {
  const [crosshair, setCrosshair] = useState(null);

  const handleMove = (e) => {
    if (!showCrosshair) return;
    const svg = svgRef?.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SVG_W;
    const y = ((e.clientY - rect.top) / rect.height) * SVG_H;
    if (x >= PLOT.left && x <= PLOT.right && y >= PLOT.top && y <= PLOT.bottom) {
      const h = xToEnthalpy(x); const P = yToPressure(y); const T = lookupTemp(h, P);
      setCrosshair({ x, y, h, P, T });
    } else { setCrosshair(null); }
  };

  const handleLeave = () => setCrosshair(null);

  const handleClick = (e) => {
    if (!onDiagramClick) return;
    const svg = svgRef?.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SVG_W;
    const y = ((e.clientY - rect.top) / rect.height) * SVG_H;
    if (x >= PLOT.left && x <= PLOT.right && y >= PLOT.top && y <= PLOT.bottom) {
      const h = xToEnthalpy(x); const P = yToPressure(y); const T = lookupTemp(h, P);
      onDiagramClick({ x, y, h, P, T });
    }
  };

  const bootjePointPositions = {};
  ['p1', 'p2', 'p3', 'p4'].forEach(key => {
    if (points[key]) {
      const [px, py] = hpToXY(points[key].h, points[key].P);
      bootjePointPositions[key] = { x: px, y: py };
    }
  });

  return (
    <div className="relative" style={{ cursor: activeTool ? 'crosshair' : 'default' }}>
      <svg ref={svgRef} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full"
        style={{ backgroundColor: '#FAFAF5', borderRadius: 12, border: '2px solid #2C1810', maxHeight: 560 }}
        onMouseMove={handleMove} onMouseLeave={handleLeave} onClick={handleClick}>
        <rect x={PLOT.left} y={PLOT.top} width={PLOT_W} height={PLOT_H} fill="#FFFDF5" stroke="#2C1810" strokeWidth="1.5" />
        {P_GRID.map(p => { const y = pressureToY(p); return <g key={`pg${p}`}><line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke="#ddd" strokeWidth="1" strokeDasharray="4 4" /><text x={PLOT.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#5C3A21" fontFamily="Nunito" fontWeight="600">{p}</text></g>; })}
        {H_GRID.map(h => { const x = enthalpyToX(h); return <g key={`hg${h}`}><line x1={x} y1={PLOT.top} x2={x} y2={PLOT.bottom} stroke="#ddd" strokeWidth="1" strokeDasharray="4 4" /><text x={x} y={PLOT.bottom + 18} textAnchor="middle" fontSize="11" fill="#5C3A21" fontFamily="Nunito" fontWeight="600">{h}</text></g>; })}
        <text x={30} y={SVG_H / 2} textAnchor="middle" fontSize="13" fill="#2C1810" fontWeight="700" fontFamily="Nunito" transform={`rotate(-90, 30, ${SVG_H / 2})`}>Druk P (bar abs) — log-schaal</text>
        <text x={(PLOT.left + PLOT.right) / 2} y={SVG_H - 10} textAnchor="middle" fontSize="13" fill="#2C1810" fontWeight="700" fontFamily="Nunito">Enthalpie h (kJ/kg)</text>
        {ISOTHERM_PATHS.map(iso => (<g key={`iso-${iso.T}`}><path d={iso.path} fill="none" stroke="#A855F7" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" /><text x={iso.labelPos.x} y={iso.labelPos.y} fontSize="9" fill="#A855F7" fontWeight="600" fontFamily="Nunito" textAnchor="end">{iso.T}°C</text></g>))}
        <path d={DOME_PATH} fill="rgba(168, 85, 247, 0.08)" />
        <path d={LIQUID_PATH} fill="none" stroke="#3B82F6" strokeWidth="2.5" />
        <path d={VAPOR_PATH} fill="none" stroke="#EF4444" strokeWidth="2.5" />
        <circle cx={hpToXY(CRITICAL_POINT.h, CRITICAL_POINT.P)[0]} cy={hpToXY(CRITICAL_POINT.h, CRITICAL_POINT.P)[1]} r="5" fill="#2C1810" stroke="#fff" strokeWidth="1.5" />
        <text x={hpToXY(CRITICAL_POINT.h, CRITICAL_POINT.P)[0] + 10} y={hpToXY(CRITICAL_POINT.h, CRITICAL_POINT.P)[1] - 6} fontSize="11" fontWeight="700" fill="#2C1810" fontFamily="Nunito">K</text>
        {lines.highP && (() => { const y = pressureToY(lines.highP); return <g><line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke="#991B1B" strokeWidth="2" strokeDasharray="6 4" /><text x={PLOT.right + 4} y={y + 4} fontSize="10" fill="#991B1B" fontWeight="bold" fontFamily="Nunito">HP {fmtNum(lines.highP, 1)}</text></g>; })()}
        {lines.lowP && (() => { const y = pressureToY(lines.lowP); return <g><line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke="#1E3A8A" strokeWidth="2" strokeDasharray="6 4" /><text x={PLOT.right + 4} y={y + 4} fontSize="10" fill="#1E3A8A" fontWeight="bold" fontFamily="Nunito">LP {fmtNum(lines.lowP, 1)}</text></g>; })()}
        {bootjePointPositions.p1 && bootjePointPositions.p2 && <line x1={bootjePointPositions.p1.x} y1={bootjePointPositions.p1.y} x2={bootjePointPositions.p2.x} y2={bootjePointPositions.p2.y} stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />}
        {bootjePointPositions.p2 && bootjePointPositions.p3 && <line x1={bootjePointPositions.p2.x} y1={bootjePointPositions.p2.y} x2={bootjePointPositions.p3.x} y2={bootjePointPositions.p3.y} stroke="#DC2626" strokeWidth="3" strokeLinecap="round" />}
        {bootjePointPositions.p3 && bootjePointPositions.p4 && <line x1={bootjePointPositions.p3.x} y1={bootjePointPositions.p3.y} x2={bootjePointPositions.p4.x} y2={bootjePointPositions.p4.y} stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" />}
        {bootjePointPositions.p4 && bootjePointPositions.p1 && <line x1={bootjePointPositions.p4.x} y1={bootjePointPositions.p4.y} x2={bootjePointPositions.p1.x} y2={bootjePointPositions.p1.y} stroke="#059669" strokeWidth="3" strokeLinecap="round" />}
        {['p1', 'p2', 'p3', 'p4'].map(key => { const pt = bootjePointPositions[key]; if (!pt) return null; const num = key.substring(1); return (<g key={key}><circle cx={pt.x} cy={pt.y} r="10" fill="white" stroke="#2C1810" strokeWidth="2" /><text x={pt.x} y={pt.y + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#2C1810" fontFamily="Nunito">{num}</text></g>); })}
        {crosshair && showCrosshair && (<g pointerEvents="none"><line x1={PLOT.left} y1={crosshair.y} x2={PLOT.right} y2={crosshair.y} stroke="#2C1810" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" /><line x1={crosshair.x} y1={PLOT.top} x2={crosshair.x} y2={PLOT.bottom} stroke="#2C1810" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" /><circle cx={crosshair.x} cy={crosshair.y} r="3" fill="#FBBF24" stroke="#2C1810" strokeWidth="1" /></g>)}
        {children}
      </svg>
      {showReadout && crosshair && (
        <div className="absolute top-3 right-3 bg-white rounded-lg px-3 py-2 text-xs font-mono" style={{ border: '2px solid #2C1810', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
          <div className="flex items-center gap-1"><Thermometer size={12} style={{ color: '#B84A3D' }} /> <span style={{ color: '#2C1810', fontWeight: 700 }}>{fmtNum(crosshair.T, 0)} °C</span></div>
          <div style={{ color: '#5C3A21' }}>P abs: <span className="font-bold" style={{ color: '#2C1810' }}>{fmtNum(crosshair.P, 1)} bar</span></div>
          <div style={{ color: '#5C3A21' }}>h: <span className="font-bold" style={{ color: '#2C1810' }}>{fmtNum(crosshair.h, 0)} kJ/kg</span></div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLIZED BOOTJE MET COËXISTENTIEGEBIED (DOME)
// ═══════════════════════════════════════════════════════════════

const BOOTJE_VISUAL = { xLeft: 140, xP1: 395, xP2: 470, yTop: 60, yBottom: 240 };

function StylizedBootje({
  enthalpies = M1_ENTHALPIES,
  powerPlaced = {},
  highlightLine = null,
  dropZoneActive = null,
  showGuidelines = false,
  showCalculations = false,
  highlightHLabels = [],
  showDome = true,
  showSegmentLetters = false,
  placedResults = {}, // { verdamper: 170, compressor: 30, condensor: 200 }
  width = 540,
  height = 380,
}) {
  const { xLeft, xP1, xP2, yTop, yBottom } = BOOTJE_VISUAL;
  const p1 = { x: xP1, y: yBottom, label: '1' };
  const p2 = { x: xP2, y: yTop, label: '2' };
  const p3 = { x: xLeft, y: yTop, label: '3' };
  const p4 = { x: xLeft, y: yBottom, label: '4' };
  const hAxisY = height - 60;

  const lines = [
    { key: 'verdamper', x1: p4.x, y1: p4.y, x2: p1.x, y2: p1.y, color: '#059669', isDiag: false },
    { key: 'compressor', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, color: '#2563EB', isDiag: true },
    { key: 'condensor', x1: p2.x, y1: p2.y, x2: p3.x, y2: p3.y, color: '#DC2626', isDiag: false },
    { key: 'expansie', x1: p3.x, y1: p3.y, x2: p4.x, y2: p4.y, color: '#7C3AED', isDiag: false },
  ];

  const computedVals = {
    verdamper: enthalpies.h1 - enthalpies.h4,
    compressor: enthalpies.h2 - enthalpies.h1,
    condensor: enthalpies.h2 - enthalpies.h3,
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {/* Coëxistentiegebied (dome) — asymmetrisch, realistisch
           Bootje punten: p3(140,60) p4(140,240) p1(360,240) p2(470,60)
           Vloeistoflijn links steil, damplijn rechts buigt af naar rechts
           zoals in een echt h-log p diagram. */}
      {showDome && (
        <g opacity="0.7">
          {/* Gevulde dome */}
          <path d="M 55 310 C 60 190, 180 40, 280 18 C 420 18, 430 120, 340 310 Z"
            fill="rgba(168, 85, 247, 0.06)" />
          {/* Vloeistoflijn (blauw) — steil */}
          <path d="M 55 310 C 60 190, 180 40, 280 18"
            fill="none" stroke="#3B82F6" strokeWidth="2" />
          {/* Damplijn (rood) — buigt af naar rechts, dan steil omlaag */}
          <path d="M 280 18 C 420 18, 430 120, 340 310"
            fill="none" stroke="#EF4444" strokeWidth="2" />
          {/* Kritisch punt K */}
          <circle cx={280} cy={18} r="4" fill="#2C1810" stroke="#fff" strokeWidth="1" />
          <text x={268} y={12} fontSize="10" fontWeight="700" fill="#2C1810" fontFamily="Nunito">K</text>
        </g>
      )}

      {/* Bootje lijnen */}
      {lines.map(l => {
        const isPlaced = powerPlaced[l.key];
        const isDropHovered = dropZoneActive === l.key;
        const isHighlighted = highlightLine === l.key;
        const stroke = (isPlaced || isHighlighted || isDropHovered) ? l.color : '#8B7355';
        const w = (isPlaced || isHighlighted) ? 5 : 3;
        return <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={stroke} strokeWidth={w} strokeLinecap="round" style={{ transition: 'stroke 0.3s, stroke-width 0.3s' }} />;
      })}

      {/* Placed result blocks — gele blokken met berekend Δh verder van segmenten,
          gepositioneerd zodat ze niet overlappen met de power-labels. */}
      {lines.map(l => {
        const val = placedResults[l.key];
        if (val === null || val === undefined) return null;
        const midX = (l.x1 + l.x2) / 2;
        const midY = (l.y1 + l.y2) / 2;
        // Verdamper: verder boven lijn (power-label staat al op midY-18)
        // Condensor: verder onder lijn (power-label staat op midY+18)
        // Compressor: meer naar rechts en omhoog
        const tx = l.key === 'compressor' ? midX + 130 : midX;
        const ty = l.key === 'compressor' ? midY + 20 : l.key === 'verdamper' ? midY - 50 : l.key === 'condensor' ? midY + 50 : midY;
        const boxW = 110, boxH = 26;
        return (
          <g key={`placed-${l.key}`} style={{ animation: 'pop-in 0.5s ease-out' }}>
            <rect x={tx - boxW / 2} y={ty - boxH / 2} width={boxW} height={boxH} rx="6" fill="#FBBF24" stroke="#2C1810" strokeWidth="1.5" />
            <text x={tx} y={ty + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#2C1810" fontFamily="Nunito">{val} kJ/kg</text>
          </g>
        );
      })}

      {/* Segment letters (examenstijl) */}
      {showSegmentLetters && (() => {
        const letters = { verdamper: 'A', compressor: 'B', condensor: 'C', expansie: 'D' };
        return lines.map(l => {
          const midX = (l.x1 + l.x2) / 2;
          const midY = (l.y1 + l.y2) / 2;
          // Offset zodat letter niet op de lijn zelf valt
          const ox = l.key === 'expansie' ? -18 : 0;
          const oy = l.key === 'verdamper' ? -20 : l.key === 'condensor' ? 20 : l.key === 'compressor' ? 10 : 0;
          return (
            <g key={`letter-${l.key}`}>
              <circle cx={midX + ox} cy={midY + oy} r="12" fill="#FBBF24" stroke="#2C1810" strokeWidth="2" />
              <text x={midX + ox} y={midY + oy + 4} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#2C1810" fontFamily="Nunito">{letters[l.key]}</text>
            </g>
          );
        });
      })()}

      {/* Punten */}
      {[p1, p2, p3, p4].map(p => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r="13" fill="white" stroke="#2C1810" strokeWidth="2" />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#2C1810" fontFamily="Nunito">{p.label}</text>
        </g>
      ))}

      {/* Enthalpie-hulplijnen */}
      {showGuidelines && (
        <g>
          <line x1={p4.x} y1={p4.y} x2={p4.x} y2={hAxisY} stroke="#5C3A21" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
          <line x1={p3.x} y1={p3.y} x2={p3.x} y2={hAxisY} stroke="#5C3A21" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
          <line x1={p1.x} y1={p1.y} x2={p1.x} y2={hAxisY} stroke="#5C3A21" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
          <line x1={p2.x} y1={p2.y} x2={p2.x} y2={hAxisY} stroke="#5C3A21" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
          <line x1={40} y1={hAxisY} x2={xP2 + 20} y2={hAxisY} stroke="#2C1810" strokeWidth="1.5" />
          <text x={xP2 + 26} y={hAxisY + 4} fontSize="10" fill="#2C1810" fontWeight="700" fontFamily="Nunito">h →</text>
          {(() => {
            const hl34 = highlightHLabels.includes('h3') || highlightHLabels.includes('h4');
            const hl1 = highlightHLabels.includes('h1');
            const hl2 = highlightHLabels.includes('h2');
            const hlStyle = (on) => ({ fontSize: on ? 13 : 10, fontWeight: on ? 800 : 700, fill: on ? '#2C1810' : '#8B7355' });
            const dotR = (on) => on ? 5 : 3.5;
            return (
              <g>
                <circle cx={p4.x} cy={hAxisY} r={dotR(hl34)} fill={hl34 ? '#FBBF24' : '#059669'} stroke={hl34 ? '#2C1810' : 'none'} strokeWidth={hl34 ? 1.5 : 0} style={{ transition: 'all 0.3s' }} />
                <circle cx={p1.x} cy={hAxisY} r={dotR(hl1)} fill={hl1 ? '#FBBF24' : '#2563EB'} stroke={hl1 ? '#2C1810' : 'none'} strokeWidth={hl1 ? 1.5 : 0} style={{ transition: 'all 0.3s' }} />
                <circle cx={p2.x} cy={hAxisY} r={dotR(hl2)} fill={hl2 ? '#FBBF24' : '#DC2626'} stroke={hl2 ? '#2C1810' : 'none'} strokeWidth={hl2 ? 1.5 : 0} style={{ transition: 'all 0.3s' }} />
                {enthalpies.h3 === enthalpies.h4 ? (
                  <g>
                    {hl34 && <rect x={p4.x - 58} y={hAxisY + 6} width="116" height="18" rx="4" fill="#FBBF24" style={{ transition: 'all 0.3s' }} />}
                    <text x={p4.x} y={hAxisY + 20} textAnchor="middle" fontFamily="Nunito" {...hlStyle(hl34)} style={{ transition: 'all 0.3s' }}>h3 = h4 = {enthalpies.h4}</text>
                    <text x={p4.x} y={hAxisY + 32} textAnchor="middle" fontSize="9" fill={hl34 ? '#2C1810' : '#5C3A21'} fontFamily="Nunito">kJ/kg</text>
                  </g>
                ) : (
                  <g>
                    <text x={p4.x} y={hAxisY + 18} textAnchor="middle" fontFamily="Nunito" {...hlStyle(hl34)}>h4 = {enthalpies.h4}</text>
                    <text x={p3.x} y={hAxisY + 30} textAnchor="middle" fontFamily="Nunito" {...hlStyle(hl34)}>h3 = {enthalpies.h3}</text>
                  </g>
                )}
                {hl1 && <rect x={p1.x - 42} y={hAxisY + 6} width="84" height="18" rx="4" fill="#FBBF24" style={{ transition: 'all 0.3s' }} />}
                <text x={p1.x} y={hAxisY + 20} textAnchor="middle" fontFamily="Nunito" {...hlStyle(hl1)} style={{ transition: 'all 0.3s' }}>h1 = {enthalpies.h1}</text>
                <text x={p1.x} y={hAxisY + 32} textAnchor="middle" fontSize="9" fill={hl1 ? '#2C1810' : '#5C3A21'} fontFamily="Nunito">kJ/kg</text>
                {hl2 && <rect x={p2.x - 42} y={hAxisY + 6} width="84" height="18" rx="4" fill="#FBBF24" style={{ transition: 'all 0.3s' }} />}
                <text x={p2.x} y={hAxisY + 20} textAnchor="middle" fontFamily="Nunito" {...hlStyle(hl2)} style={{ transition: 'all 0.3s' }}>h2 = {enthalpies.h2}</text>
                <text x={p2.x} y={hAxisY + 32} textAnchor="middle" fontSize="9" fill={hl2 ? '#2C1810' : '#5C3A21'} fontFamily="Nunito">kJ/kg</text>
              </g>
            );
          })()}
        </g>
      )}

      {/* Placed labels */}
      {lines.map(l => {
        if (!powerPlaced[l.key]) return null;
        const labelInfo = POWER_LABELS.find(pl => pl.id === l.key);
        if (!labelInfo) return null;
        const midX = (l.x1 + l.x2) / 2; const midY = (l.y1 + l.y2) / 2;
        const tagW = 150, tagH = 22;
        const tx = l.key === 'compressor' ? midX + 90 : midX;
        const ty = l.key === 'compressor' ? midY - 10 : l.key === 'verdamper' ? midY - 18 : midY + 18;
        return (
          <g key={`label-${l.key}`}>
            <rect x={tx - tagW / 2} y={ty - tagH / 2} width={tagW} height={tagH} rx="4" fill="white" stroke={labelInfo.color} strokeWidth="1.5" />
            <text x={tx} y={ty + 4} textAnchor="middle" fontSize="10" fill={labelInfo.color} fontWeight="bold" fontFamily="Nunito">{labelInfo.label}</text>
          </g>
        );
      })}

      {/* Berekeningen */}
      {showCalculations && lines.filter(l => l.key !== 'expansie').map(l => {
        const val = computedVals[l.key];
        const midX = (l.x1 + l.x2) / 2; const midY = (l.y1 + l.y2) / 2;
        const tx = l.key === 'compressor' ? midX + 100 : midX;
        const ty = l.key === 'compressor' ? midY + 22 : l.key === 'verdamper' ? midY + 28 : midY - 28;
        const sumPart = l.key === 'verdamper' ? `${enthalpies.h1} − ${enthalpies.h4} =` : l.key === 'compressor' ? `${enthalpies.h2} − ${enthalpies.h1} =` : `${enthalpies.h2} − ${enthalpies.h3} =`;
        const boxW = 200, boxH = 28;
        return (
          <g key={`calc-${l.key}`}>
            <rect x={tx - boxW / 2} y={ty - boxH / 2} width={boxW} height={boxH} rx="6" fill="#FBBF24" stroke="#2C1810" strokeWidth="1.5" />
            <text x={tx} y={ty + 5} textAnchor="middle" fontSize="14" fill="#2C1810" fontFamily="Nunito">
              <tspan fontWeight="600">{sumPart} </tspan><tspan fontWeight="800">{val} kJ/kg</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// M1 INTRO
// ═══════════════════════════════════════════════════════════════

function M1IntroScreen({ onBegin }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-lg bg-white rounded-2xl p-8" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', animation: 'fadeInUp 0.5s ease-out' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.2)' }}>
            <Calculator size={22} style={{ color: '#5C3A21' }} />
          </div>
          <h2 className="text-xl font-extrabold" style={{ color: '#2C1810' }}>Missie 1 — Rendement begrijpen</h2>
        </div>
        <div className="italic leading-relaxed mb-6" style={{ color: '#5C3A21', lineHeight: 1.7 }}>
          <p className="font-extrabold text-lg mb-3" style={{ color: '#2C1810' }}>Hoe efficiënt werkt een koelinstallatie?</p>
          <p className="mb-2">Het h-log p diagram geeft je belangrijke informatie, zoals het vermogen van:</p>
          <ul className="list-disc pl-6 mb-3 space-y-0.5"><li>condensor</li><li>verdamper</li><li>compressor</li></ul>
          <p>Dat is handig. Want hiermee bepaal je het rendement van een koelmachine (<span className="inline-block px-2 py-0.5 font-bold rounded" style={{ background: '#FBBF24', color: '#2C1810' }}>EER</span>) en warmtepomp (<span className="inline-block px-2 py-0.5 font-bold rounded" style={{ background: '#FBBF24', color: '#2C1810' }}>COP</span>).</p>
        </div>
        <button onClick={onBegin} className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
          style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>Begin <ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M1R1 — POWER LABELER
// ═══════════════════════════════════════════════════════════════

function PowerLabeler({ onComplete, onLoseLife, lives }) {
  const [placed, setPlaced] = useState({ verdamper: false, compressor: false, condensor: false });
  const [draggedId, setDraggedId] = useState(null);
  const [hoverLine, setHoverLine] = useState(null);
  const [flash, setFlash] = useState(null);
  const [points, setPoints] = useState(0);

  const allPlaced = placed.verdamper && placed.compressor && placed.condensor;

  const handleDragStart = (id) => setDraggedId(id);
  const handleDragEnd = () => { setDraggedId(null); setHoverLine(null); };

  const tryPlace = (lineKey) => {
    if (!draggedId) return;
    const label = POWER_LABELS.find(l => l.id === draggedId);
    if (!label) return;
    if (label.lineKey === lineKey) {
      setPlaced(prev => ({ ...prev, [draggedId]: true }));
      setPoints(p => p + SCORING.m1r1.perLabel);
      setFlash({ type: 'correct', id: draggedId });
      setTimeout(() => setFlash(null), 800);
    } else {
      setFlash({ type: 'wrong', id: draggedId, lineKey });
      onLoseLife?.();
      setTimeout(() => setFlash(null), 800);
    }
    setDraggedId(null); setHoverLine(null);
  };

  return (
    <div className="min-h-screen p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-4xl mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <h3 className="text-lg font-extrabold mb-1" style={{ color: '#2C1810' }}>Ronde 1.1 — Vermogens labelen</h3>
          <p className="text-sm italic mb-4" style={{ color: '#5C3A21' }}>Je ziet hier een bootje met enthalpiewaardes. <span className="font-bold">Sleep elk vermogen naar de juiste lijn.</span></p>
          <div className={flash?.type === 'wrong' ? 'flash-red' : ''}>
            <div className="relative">
              <StylizedBootje enthalpies={M1_ENTHALPIES} powerPlaced={placed} dropZoneActive={hoverLine} showGuidelines={true} showCalculations={allPlaced} showDome={true} width={540} height={380} />
              {draggedId && (() => {
                const { xLeft, xP1, xP2, yTop, yBottom } = BOOTJE_VISUAL;
                const p1v = { x: xP1, y: yBottom }; const p2v = { x: xP2, y: yTop };
                const dx = p2v.x - p1v.x, dy = p2v.y - p1v.y; const L = Math.sqrt(dx*dx + dy*dy) || 1;
                const nx = -dy / L, ny = dx / L; const off = 28;
                const compPoly = [[p1v.x + nx*off, p1v.y + ny*off],[p2v.x + nx*off, p2v.y + ny*off],[p2v.x - nx*off, p2v.y - ny*off],[p1v.x - nx*off, p1v.y - ny*off]].map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
                const zoneProps = (key, isPlaced) => ({
                  fill: isPlaced ? 'transparent' : (hoverLine === key ? 'rgba(107,142,61,0.28)' : 'rgba(92,58,33,0.05)'),
                  stroke: isPlaced ? 'transparent' : (hoverLine === key ? '#6B8E3D' : '#8B7355'),
                  strokeDasharray: isPlaced ? 'none' : (hoverLine === key ? 'none' : '6 4'),
                  strokeWidth: isPlaced ? 0 : (hoverLine === key ? 2.5 : 1.5),
                  onDragOver: (e) => { e.preventDefault(); if (!isPlaced) setHoverLine(key); },
                  onDragLeave: () => setHoverLine(prev => prev === key ? null : prev),
                  onDrop: (e) => { e.preventDefault(); if (!isPlaced) tryPlace(key); },
                  style: { pointerEvents: draggedId && !isPlaced ? 'auto' : 'none', transition: 'all 0.2s' },
                });
                return (
                  <svg viewBox="0 0 540 380" className="absolute top-0 left-0 w-full" style={{ pointerEvents: 'none', maxHeight: 380, animation: 'fadeInUp 0.2s' }}>
                    {!placed.verdamper && <rect x={xLeft + 20} y={yBottom - 22} width={p1v.x - xLeft - 40} height={44} rx="8" {...zoneProps('verdamper', false)} />}
                    {!placed.condensor && <rect x={xLeft + 20} y={yTop - 22} width={p2v.x - xLeft - 40} height={44} rx="8" {...zoneProps('condensor', false)} />}
                    {!placed.compressor && <polygon points={compPoly} {...zoneProps('compressor', false)} />}
                  </svg>
                );
              })()}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 justify-center mb-4">
          {POWER_LABELS.map(label => {
            const isPlaced = placed[label.id];
            const isFlash = flash?.id === label.id;
            return (
              <div key={label.id} draggable={!isPlaced} onDragStart={() => handleDragStart(label.id)} onDragEnd={handleDragEnd}
                className="px-4 py-2 rounded-xl font-bold italic text-sm select-none"
                style={{ cursor: isPlaced ? 'default' : 'grab', background: isPlaced ? '#6B8E3D' : 'white', color: isPlaced ? 'white' : label.color, border: `2px solid ${isPlaced ? '#2C1810' : label.color}`, opacity: isPlaced ? 0.55 : 1, boxShadow: isPlaced ? 'none' : '0 3px 0 rgba(0,0,0,0.1)', animation: isFlash && flash?.type === 'wrong' ? 'shake 0.5s' : (isFlash && flash?.type === 'correct' ? 'pop-in 0.3s' : 'none') }}>
                {isPlaced && <Check className="inline mr-1" size={14} />}
                {label.label} <span className="opacity-70 font-normal ml-1">({label.sub})</span>
              </div>
            );
          })}
        </div>
        {allPlaced && (
          <div className="bg-white rounded-2xl p-5 mb-4" style={{ border: '2px solid #6B8E3D', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', animation: 'fadeInUp 0.3s' }}>
            <p className="italic mb-3" style={{ color: '#2C1810', lineHeight: 1.6 }}><span className="font-bold not-italic">Goed!</span> Je leest elk vermogen direct uit het bootje. Tijd voor de EER.</p>
            <button onClick={() => onComplete(points)} className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
              style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>Volgende <ChevronRight size={18} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CALCULATION PANEL
// ═══════════════════════════════════════════════════════════════

function CalculationPanel({ steps, onAllDone, onLoseLife, lives, onStepChange, onStepValidated }) {
  const [values, setValues] = useState(() => Object.fromEntries(steps.map(s => [s.key, ''])));
  const [validated, setValidated] = useState(() => Object.fromEntries(steps.map(s => [s.key, false])));
  const [attempts, setAttempts] = useState(() => Object.fromEntries(steps.map(s => [s.key, 0])));
  const [activeIdx, setActiveIdx] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState({});
  const [shakeKey, setShakeKey] = useState(null);

  useEffect(() => { onStepChange?.(steps[activeIdx]?.key); }, [activeIdx]);

  const handleCheck = (idx) => {
    const step = steps[idx]; const v = parseNum(values[step.key]);
    if (Number.isNaN(v)) return;
    const diff = Math.abs(v - step.correct);
    const newAttempts = attempts[step.key] + 1;
    setAttempts(prev => ({ ...prev, [step.key]: newAttempts }));
    if (diff <= step.margin) {
      setValidated(prev => ({ ...prev, [step.key]: true }));
      setFeedbackMsg(prev => ({ ...prev, [step.key]: { type: 'correct', msg: step.feedbackCorrect || 'Correct!' } }));
      onStepValidated?.(step.key, v);
      setTimeout(() => { if (idx < steps.length - 1) setActiveIdx(idx + 1); else onAllDone?.(values, attempts); }, 400);
    } else {
      onLoseLife?.();
      setShakeKey(step.key); setTimeout(() => setShakeKey(null), 500);
      setFeedbackMsg(prev => ({ ...prev, [step.key]: { type: 'wrong', msg: step.hint || 'Nog niet juist. Probeer opnieuw.' } }));
    }
  };

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => {
        const isActive = idx === activeIdx; const isDone = validated[step.key]; const isFuture = idx > activeIdx;
        const feedback = feedbackMsg[step.key];
        if (isDone && !isActive) {
          return (
            <div key={step.key} className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(107,142,61,0.08)', border: '1.5px solid #6B8E3D' }}>
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#6B8E3D' }}><Check size={13} className="text-white" /></div>
              <span className="text-sm font-bold" style={{ color: '#2C1810' }}>{step.label}</span>
              <span className="text-sm font-bold ml-auto" style={{ color: '#6B8E3D' }}>{fmtNum(parseNum(values[step.key]), step.decimals ?? 1)} {step.unit}</span>
            </div>
          );
        }
        return (
          <div key={step.key} className="rounded-2xl p-4 transition-all"
            style={{ background: isActive ? 'white' : 'rgba(250,250,245,0.6)', border: `2px solid ${isActive ? '#5C3A21' : '#e8e0c8'}`, opacity: isFuture ? 0.45 : 1, boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.08)' : 'none', animation: shakeKey === step.key ? 'shake 0.5s' : 'none' }}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: isActive ? '#FBBF24' : '#e8e0c8', color: '#2C1810' }}>{idx + 1}</div>
              <div className="flex-1">
                <p className="font-bold text-sm" style={{ color: '#2C1810' }}>{step.label}</p>
                <p className="text-xs italic mb-2" style={{ color: '#5C3A21' }}>{step.formula}</p>
                {isActive && !isDone && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-sm font-mono" style={{ color: '#2C1810' }}>{step.prompt}</span>
                    <input type="text" inputMode="decimal" value={values[step.key]} onChange={(e) => setValues(prev => ({ ...prev, [step.key]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') handleCheck(idx); }}
                      className="w-24 px-2 py-1 rounded-lg font-mono text-sm" style={{ background: '#FAFAF5', border: '2px solid #5C3A21', color: '#2C1810' }} placeholder="?" autoFocus />
                    <span className="text-sm" style={{ color: '#5C3A21' }}>{step.unit}</span>
                    <button onClick={() => handleCheck(idx)} disabled={values[step.key] === ''}
                      className="px-3 py-1 rounded-lg font-bold italic text-white text-sm hover:brightness-90 active:scale-95 disabled:opacity-40"
                      style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 2px 0 rgba(0,0,0,0.15)' }}>Controleer</button>
                  </div>
                )}
                {feedback && feedback.type === 'wrong' && <div className="mt-2 p-2 rounded-lg text-xs italic text-white" style={{ background: '#B84A3D' }}>{feedback.msg}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M1R2 — EER CALCULATOR
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// DRAG-DROP CALCULATOR — generieke drag-drop stapsgewijze calc
// ═══════════════════════════════════════════════════════════════

// DragSource: rendert een sleepbaar blok met een waarde
function DragSource({ id, label, value, color = '#FBBF24', onDragStart, disabled = false }) {
  return (
    <div draggable={!disabled}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', id); onDragStart?.(id); }}
      className="inline-flex items-center justify-center px-3 py-2 rounded-lg font-bold text-sm select-none"
      style={{
        cursor: disabled ? 'default' : 'grab',
        background: disabled ? '#e8e0c8' : color,
        color: '#2C1810',
        border: '2px solid #2C1810',
        boxShadow: disabled ? 'none' : '0 2px 0 rgba(0,0,0,0.15)',
        opacity: disabled ? 0.5 : 1,
        minWidth: 80,
      }}>
      {label ? <span className="opacity-80 text-xs mr-1">{label} =</span> : null}
      <span>{value}</span>
    </div>
  );
}

// DropSlot: ontvangt een sleepbare waarde
function DropSlot({ value, label, onDrop, onClear, hasValue, flash = null }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop?.(e.dataTransfer.getData('text/plain')); }}
      className="inline-flex items-center justify-center px-3 py-2 rounded-lg font-bold text-sm"
      style={{
        minWidth: 80,
        minHeight: 40,
        background: hasValue ? '#FBBF24' : (over ? 'rgba(107,142,61,0.2)' : '#FAFAF5'),
        border: `2px ${hasValue ? 'solid' : 'dashed'} ${hasValue ? '#2C1810' : (over ? '#6B8E3D' : '#8B7355')}`,
        color: '#2C1810',
        animation: flash === 'wrong' ? 'shake 0.4s' : (flash === 'correct' ? 'pop-in 0.3s' : 'none'),
        cursor: hasValue ? 'pointer' : 'default',
      }}
      onClick={() => { if (hasValue) onClear?.(); }}
      title={hasValue ? 'Klik om te verwijderen' : ''}
    >
      {hasValue ? (
        <>{label ? <span className="opacity-80 text-xs mr-1">{label} =</span> : null}<span>{value}</span></>
      ) : (
        <span className="opacity-50 italic font-normal">sleep hier</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M1R2 — EER CALCULATOR (drag-drop versie)
// ═══════════════════════════════════════════════════════════════

function EerCalculator({ onComplete, onLoseLife, lives }) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [slots, setSlots] = useState({
    verdamper: { left: null, right: null, result: '', done: false, firstTry: true },
    compressor: { left: null, right: null, result: '', done: false, firstTry: true },
    eer: { left: null, right: null, result: '', done: false, firstTry: true },
  });
  const [placedResults, setPlacedResults] = useState({});
  const [flash, setFlash] = useState(null);
  const [points, setPoints] = useState(0);

  const steps = [
    { key: 'verdamper', label: 'Stap 1 — Verdampervermogen', formula: 'Δh_verd = h1 − h4', leftExpected: 'h1', rightExpected: 'h4', resultCorrect: 170, resultMargin: 2, separator: '−', unit: 'kJ/kg', segment: 'verdamper', leftLabel: '', rightLabel: '' },
    { key: 'compressor', label: 'Stap 2 — Compressorvermogen', formula: 'Δh_comp = h2 − h1', leftExpected: 'h2', rightExpected: 'h1', resultCorrect: 30, resultMargin: 2, separator: '−', unit: 'kJ/kg', segment: 'compressor', leftLabel: '', rightLabel: '' },
    { key: 'eer', label: 'Stap 3 — EER berekenen', formula: 'EER = Δh_verd / Δh_comp', leftExpected: 'dhVerd', rightExpected: 'dhComp', resultCorrect: 5.7, resultMargin: 0.2, separator: '/', unit: '(EER)', segment: null, leftLabel: 'Δh_verd', rightLabel: 'Δh_comp' },
  ];

  const step = steps[currentStepIdx];
  const state = slots[step.key];

  // Beschikbare sleepbare waarden per stap
  const enthalpies = {
    h1: { value: 405, label: 'h1' },
    h2: { value: 435, label: 'h2' },
    h3: { value: 235, label: 'h3' },
    h4: { value: 235, label: 'h4' },
  };
  const results = {
    dhVerd: { value: 170, label: 'Δh_verd' },
    dhComp: { value: 30, label: 'Δh_comp' },
  };
  const sources = currentStepIdx < 2
    ? [{ id: 'h1', ...enthalpies.h1 }, { id: 'h2', ...enthalpies.h2 }, { id: 'h3', ...enthalpies.h3 }, { id: 'h4', ...enthalpies.h4 }]
    : [{ id: 'dhVerd', ...results.dhVerd }, { id: 'dhComp', ...results.dhComp }];

  const getValue = (id) => (enthalpies[id]?.value ?? results[id]?.value ?? null);
  const getLabel = (id) => (enthalpies[id]?.label ?? results[id]?.label ?? '');

  // Automatisch het resultaat uitrekenen wanneer beide slots gevuld zijn
  useEffect(() => {
    if (state.left && state.right && !state.done) {
      const lv = getValue(state.left);
      const rv = getValue(state.right);
      let computed = '';
      if (step.separator === '−') computed = String(lv - rv);
      else if (step.separator === '/') computed = (lv / rv).toFixed(1).replace('.', ',');
      if (computed !== state.result) {
        setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], result: computed } }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.left, state.right, step.key]);

  const handleDrop = (side) => (sourceId) => {
    if (state.done) return;
    setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], [side]: sourceId } }));
  };
  const handleClear = (side) => () => {
    if (state.done) return;
    setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], [side]: null, result: '' } }));
  };
  const handleResultChange = (v) => setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], result: v } }));

  const handleCheck = () => {
    if (state.done) return;
    const leftOk = state.left === step.leftExpected;
    const rightOk = state.right === step.rightExpected;
    const resultVal = parseNum(state.result);
    const resultOk = !Number.isNaN(resultVal) && Math.abs(resultVal - step.resultCorrect) <= step.resultMargin;

    if (!leftOk || !rightOk) {
      setFlash({ step: step.key, type: 'wrong', msg: 'De gesleepte waardes kloppen niet. Gebruik de formule als gids.' });
      onLoseLife?.();
      setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], firstTry: false } }));
      setTimeout(() => setFlash(null), 1500);
      return;
    }
    if (!resultOk) {
      setFlash({ step: step.key, type: 'wrong', msg: `Het resultaat klopt niet. Bereken ${getValue(state.left)} ${step.separator} ${getValue(state.right)}.` });
      onLoseLife?.();
      setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], firstTry: false } }));
      setTimeout(() => setFlash(null), 1500);
      return;
    }

    // Alles klopt
    setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], done: true } }));
    const pts = state.firstTry
      ? (step.key === 'eer' ? SCORING.m1r2.final : SCORING.m1r2.perStep)
      : Math.max(1, Math.floor((step.key === 'eer' ? SCORING.m1r2.final : SCORING.m1r2.perStep) / 2));
    setPoints(p => p + pts);

    // Placed result tonen op bootje
    if (step.segment) {
      setPlacedResults(prev => ({ ...prev, [step.segment]: step.resultCorrect }));
    }

    setFlash({ step: step.key, type: 'correct', msg: 'Correct!' });
    setTimeout(() => {
      setFlash(null);
      if (currentStepIdx < steps.length - 1) setCurrentStepIdx(idx => idx + 1);
    }, 1200);
  };

  const allDone = slots.eer.done;

  return (
    <div className="min-h-screen p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-5xl mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <h3 className="text-lg font-extrabold mb-1" style={{ color: '#2C1810' }}>Ronde 1.2 — EER uitrekenen</h3>
          <p className="text-sm italic mb-3" style={{ color: '#5C3A21' }}>Sleep de juiste waardes uit het diagram naar de formule en bereken het resultaat.</p>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg mb-3" style={{ background: '#FBBF24' }}>
            <span className="font-extrabold text-sm" style={{ color: '#2C1810' }}>EER =</span>
            <div className="inline-flex flex-col items-center"><span className="font-bold text-sm" style={{ color: '#2C1810' }}>Δh verdamper</span><div className="w-full h-0.5 my-0.5" style={{ background: '#2C1810' }} /><span className="font-bold text-sm" style={{ color: '#2C1810' }}>Δh compressor</span></div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <StylizedBootje enthalpies={M1_ENTHALPIES} powerPlaced={{ verdamper: true, compressor: true, condensor: true }} showGuidelines={true} showCalculations={false} showDome={true} placedResults={placedResults} width={540} height={380} />
              {/* Sleepbare bronnen */}
              <div className="mt-3 p-3 rounded-xl" style={{ background: '#f0e8d0', border: '2px solid #d4c9a8' }}>
                <p className="text-xs font-bold mb-2" style={{ color: '#5C3A21' }}>{currentStepIdx < 2 ? 'Sleep een enthalpiewaarde:' : 'Sleep een Δh-waarde (uit het diagram):'}</p>
                <div className="flex flex-wrap gap-2">
                  {sources.map(src => (
                    <DragSource key={src.id} id={src.id} label={src.label} value={src.value} disabled={state.done} />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {steps.map((s, idx) => {
                const st = slots[s.key];
                const isActive = idx === currentStepIdx;
                const isDone = st.done;
                const isFuture = idx > currentStepIdx;
                if (isDone && !isActive) {
                  return (
                    <div key={s.key} className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(107,142,61,0.08)', border: '1.5px solid #6B8E3D' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#6B8E3D' }}><Check size={13} className="text-white" /></div>
                      <span className="text-sm font-bold" style={{ color: '#2C1810' }}>{s.label}</span>
                      <span className="text-sm font-bold ml-auto" style={{ color: '#6B8E3D' }}>{getValue(st.left)} {s.separator} {getValue(st.right)} = {fmtNum(parseNum(st.result), s.key === 'eer' ? 1 : 0)} {s.unit}</span>
                    </div>
                  );
                }
                return (
                  <div key={s.key} className="rounded-2xl p-4 transition-all"
                    style={{ background: isActive ? 'white' : 'rgba(250,250,245,0.6)', border: `2px solid ${isActive ? '#5C3A21' : '#e8e0c8'}`, opacity: isFuture ? 0.45 : 1, boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.08)' : 'none' }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: isActive ? '#FBBF24' : '#e8e0c8', color: '#2C1810' }}>{idx + 1}</div>
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color: '#2C1810' }}>{s.label}</p>
                        <p className="text-xs italic mb-3" style={{ color: '#5C3A21' }}>{s.formula}</p>
                        {isActive && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <DropSlot value={getValue(st.left)} label={getLabel(st.left)} hasValue={!!st.left} onDrop={handleDrop('left')} onClear={handleClear('left')} flash={flash?.step === s.key && !st.left ? flash.type : null} />
                              <span className="text-xl font-bold" style={{ color: '#2C1810' }}>{s.separator}</span>
                              <DropSlot value={getValue(st.right)} label={getLabel(st.right)} hasValue={!!st.right} onDrop={handleDrop('right')} onClear={handleClear('right')} flash={flash?.step === s.key && !st.right ? flash.type : null} />
                              <span className="text-xl font-bold" style={{ color: '#2C1810' }}>=</span>
                              <input type="text" inputMode="decimal" value={st.result} onChange={e => handleResultChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCheck(); }}
                                className="w-20 px-2 py-2 rounded-lg font-mono text-sm" style={{ background: '#FAFAF5', border: '2px solid #5C3A21', color: '#2C1810' }} placeholder="?" />
                              <span className="text-sm" style={{ color: '#5C3A21' }}>{s.unit}</span>
                            </div>
                            <button onClick={handleCheck} disabled={!st.left || !st.right || st.result === ''}
                              className="px-4 py-2 rounded-lg font-bold italic text-white text-sm hover:brightness-90 active:scale-95 disabled:opacity-40"
                              style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 2px 0 rgba(0,0,0,0.15)' }}>Controleer</button>
                            {flash?.step === s.key && flash.type === 'wrong' && (
                              <div className="p-2 rounded-lg text-xs italic text-white" style={{ background: '#B84A3D' }}>{flash.msg}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {allDone && (
            <div className="mt-5 p-4 rounded-xl" style={{ background: 'rgba(107,142,61,0.1)', border: '2px solid #6B8E3D', animation: 'fadeInUp 0.3s' }}>
              <p className="italic mb-3" style={{ color: '#2C1810', lineHeight: 1.6 }}><span className="font-bold">Precies! EER = 170 / 30 ≈ 5,7.</span> Deze koelmachine levert per 1 kW elektrisch vermogen ongeveer 5,7 kW koelvermogen.</p>
              <button onClick={() => onComplete(points)} className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2" style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>Volgende <ChevronRight size={18} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M1R3 — COP CALCULATOR + AHA MOMENT
// ═══════════════════════════════════════════════════════════════

function CopCalculator({ onComplete, onLoseLife, lives }) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [slots, setSlots] = useState({
    condensor: { left: null, right: null, result: '', done: false, firstTry: true },
    compressor: { left: null, right: null, result: '', done: false, firstTry: true },
    cop: { left: null, right: null, result: '', done: false, firstTry: true },
  });
  const [placedResults, setPlacedResults] = useState({});
  const [flash, setFlash] = useState(null);
  const [stepPoints, setStepPoints] = useState(0);
  const [ahaReveal, setAhaReveal] = useState(false);
  const [ahaQuestionSelected, setAhaQuestionSelected] = useState(null);
  const [ahaChecked, setAhaChecked] = useState(false);
  const [ahaAttempts, setAhaAttempts] = useState(0);
  const [ahaDone, setAhaDone] = useState(false);

  const steps = [
    { key: 'condensor', label: 'Stap 1 — Condensorvermogen', formula: 'Δh_cond = h2 − h3', leftExpected: 'h2', rightExpected: 'h3', resultCorrect: 200, resultMargin: 2, separator: '−', unit: 'kJ/kg', segment: 'condensor', leftLabel: '', rightLabel: '' },
    { key: 'compressor', label: 'Stap 2 — Compressorvermogen', formula: 'Δh_comp = h2 − h1', leftExpected: 'h2', rightExpected: 'h1', resultCorrect: 30, resultMargin: 2, separator: '−', unit: 'kJ/kg', segment: 'compressor', leftLabel: '', rightLabel: '' },
    { key: 'cop', label: 'Stap 3 — COP berekenen', formula: 'COP = Δh_cond / Δh_comp', leftExpected: 'dhCond', rightExpected: 'dhComp', resultCorrect: 6.7, resultMargin: 0.2, separator: '/', unit: '(COP)', segment: null, leftLabel: 'Δh_cond', rightLabel: 'Δh_comp' },
  ];

  const step = steps[currentStepIdx];
  const state = slots[step.key];

  const enthalpies = {
    h1: { value: 405, label: 'h1' }, h2: { value: 435, label: 'h2' },
    h3: { value: 235, label: 'h3' }, h4: { value: 235, label: 'h4' },
  };
  const results = {
    dhCond: { value: 200, label: 'Δh_cond' }, dhComp: { value: 30, label: 'Δh_comp' },
  };
  const sources = currentStepIdx < 2
    ? [{ id: 'h1', ...enthalpies.h1 }, { id: 'h2', ...enthalpies.h2 }, { id: 'h3', ...enthalpies.h3 }, { id: 'h4', ...enthalpies.h4 }]
    : [{ id: 'dhCond', ...results.dhCond }, { id: 'dhComp', ...results.dhComp }];

  const getValue = (id) => (enthalpies[id]?.value ?? results[id]?.value ?? null);
  const getLabel = (id) => (enthalpies[id]?.label ?? results[id]?.label ?? '');

  // Automatisch het resultaat uitrekenen wanneer beide slots gevuld zijn
  useEffect(() => {
    if (state.left && state.right && !state.done) {
      const lv = getValue(state.left);
      const rv = getValue(state.right);
      let computed = '';
      if (step.separator === '−') computed = String(lv - rv);
      else if (step.separator === '/') computed = (lv / rv).toFixed(1).replace('.', ',');
      if (computed !== state.result) {
        setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], result: computed } }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.left, state.right, step.key]);

  const handleDrop = (side) => (sourceId) => { if (state.done) return; setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], [side]: sourceId } })); };
  const handleClear = (side) => () => { if (state.done) return; setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], [side]: null, result: '' } })); };
  const handleResultChange = (v) => setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], result: v } }));

  const handleCheck = () => {
    if (state.done) return;
    const leftOk = state.left === step.leftExpected;
    const rightOk = state.right === step.rightExpected;
    const resultVal = parseNum(state.result);
    const resultOk = !Number.isNaN(resultVal) && Math.abs(resultVal - step.resultCorrect) <= step.resultMargin;

    if (!leftOk || !rightOk) {
      setFlash({ step: step.key, type: 'wrong', msg: 'De gesleepte waardes kloppen niet. Gebruik de formule als gids.' });
      onLoseLife?.();
      setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], firstTry: false } }));
      setTimeout(() => setFlash(null), 1500);
      return;
    }
    if (!resultOk) {
      setFlash({ step: step.key, type: 'wrong', msg: `Het resultaat klopt niet. Bereken ${getValue(state.left)} ${step.separator} ${getValue(state.right)}.` });
      onLoseLife?.();
      setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], firstTry: false } }));
      setTimeout(() => setFlash(null), 1500);
      return;
    }

    setSlots(prev => ({ ...prev, [step.key]: { ...prev[step.key], done: true } }));
    if (step.key === 'cop') {
      const pts = state.firstTry ? SCORING.m1r3.first : Math.max(1, Math.floor(SCORING.m1r3.first / 2));
      setStepPoints(p => p + pts);
    }
    if (step.segment) setPlacedResults(prev => ({ ...prev, [step.segment]: step.resultCorrect }));

    setFlash({ step: step.key, type: 'correct', msg: 'Correct!' });
    setTimeout(() => {
      setFlash(null);
      if (currentStepIdx < steps.length - 1) setCurrentStepIdx(idx => idx + 1);
      else setTimeout(() => setAhaReveal(true), 500);
    }, 1200);
  };

  const ahaOptions = ['3,2', '4,2 (ze zijn altijd gelijk)', '5,2', '8,4 (dubbel)'];
  const ahaCorrect = 2;
  const handleAhaCheck = () => {
    if (ahaQuestionSelected === null) return;
    const newAttempts = ahaAttempts + 1; setAhaAttempts(newAttempts); setAhaChecked(true);
    if (ahaQuestionSelected === ahaCorrect) {
      const ahaPts = newAttempts === 1 ? SCORING.m1r3.aha : Math.floor(SCORING.m1r3.aha / 2);
      setStepPoints(p => p + ahaPts); setAhaDone(true);
    } else { onLoseLife?.(); }
  };

  return (
    <div className="min-h-screen p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-5xl mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <h3 className="text-lg font-extrabold mb-1" style={{ color: '#2C1810' }}>Ronde 1.3 — COP uitrekenen</h3>
          <p className="text-sm italic mb-3" style={{ color: '#5C3A21' }}>Sleep de juiste waardes uit het diagram naar de formule en bereken het resultaat.</p>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg mb-3" style={{ background: '#FBBF24' }}>
            <span className="font-extrabold text-sm" style={{ color: '#2C1810' }}>COP =</span>
            <div className="inline-flex flex-col items-center"><span className="font-bold text-sm" style={{ color: '#2C1810' }}>Δh condensor</span><div className="w-full h-0.5 my-0.5" style={{ background: '#2C1810' }} /><span className="font-bold text-sm" style={{ color: '#2C1810' }}>Δh compressor</span></div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <StylizedBootje enthalpies={M1_ENTHALPIES} powerPlaced={{ verdamper: true, compressor: true, condensor: true }} showGuidelines={true} showCalculations={false} showDome={true} placedResults={placedResults} width={540} height={380} />
              <div className="mt-3 p-3 rounded-xl" style={{ background: '#f0e8d0', border: '2px solid #d4c9a8' }}>
                <p className="text-xs font-bold mb-2" style={{ color: '#5C3A21' }}>{currentStepIdx < 2 ? 'Sleep een enthalpiewaarde:' : 'Sleep een Δh-waarde (uit het diagram):'}</p>
                <div className="flex flex-wrap gap-2">
                  {sources.map(src => (
                    <DragSource key={src.id} id={src.id} label={src.label} value={src.value} disabled={state.done} />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {steps.map((s, idx) => {
                const st = slots[s.key];
                const isActive = idx === currentStepIdx;
                const isDone = st.done;
                const isFuture = idx > currentStepIdx;
                if (isDone && !isActive) {
                  return (
                    <div key={s.key} className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(107,142,61,0.08)', border: '1.5px solid #6B8E3D' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#6B8E3D' }}><Check size={13} className="text-white" /></div>
                      <span className="text-sm font-bold" style={{ color: '#2C1810' }}>{s.label}</span>
                      <span className="text-sm font-bold ml-auto" style={{ color: '#6B8E3D' }}>{getValue(st.left)} {s.separator} {getValue(st.right)} = {fmtNum(parseNum(st.result), s.key === 'cop' ? 1 : 0)} {s.unit}</span>
                    </div>
                  );
                }
                return (
                  <div key={s.key} className="rounded-2xl p-4 transition-all"
                    style={{ background: isActive ? 'white' : 'rgba(250,250,245,0.6)', border: `2px solid ${isActive ? '#5C3A21' : '#e8e0c8'}`, opacity: isFuture ? 0.45 : 1, boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.08)' : 'none' }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: isActive ? '#FBBF24' : '#e8e0c8', color: '#2C1810' }}>{idx + 1}</div>
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color: '#2C1810' }}>{s.label}</p>
                        <p className="text-xs italic mb-3" style={{ color: '#5C3A21' }}>{s.formula}</p>
                        {isActive && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <DropSlot value={getValue(st.left)} label={getLabel(st.left)} hasValue={!!st.left} onDrop={handleDrop('left')} onClear={handleClear('left')} />
                              <span className="text-xl font-bold" style={{ color: '#2C1810' }}>{s.separator}</span>
                              <DropSlot value={getValue(st.right)} label={getLabel(st.right)} hasValue={!!st.right} onDrop={handleDrop('right')} onClear={handleClear('right')} />
                              <span className="text-xl font-bold" style={{ color: '#2C1810' }}>=</span>
                              <input type="text" inputMode="decimal" value={st.result} onChange={e => handleResultChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCheck(); }}
                                className="w-20 px-2 py-2 rounded-lg font-mono text-sm" style={{ background: '#FAFAF5', border: '2px solid #5C3A21', color: '#2C1810' }} placeholder="?" />
                              <span className="text-sm" style={{ color: '#5C3A21' }}>{s.unit}</span>
                            </div>
                            <button onClick={handleCheck} disabled={!st.left || !st.right || st.result === ''}
                              className="px-4 py-2 rounded-lg font-bold italic text-white text-sm hover:brightness-90 active:scale-95 disabled:opacity-40"
                              style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 2px 0 rgba(0,0,0,0.15)' }}>Controleer</button>
                            {flash?.step === s.key && flash.type === 'wrong' && (
                              <div className="p-2 rounded-lg text-xs italic text-white" style={{ background: '#B84A3D' }}>{flash.msg}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {ahaReveal && (
            <div className="mt-5 p-5 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.05))', border: '3px solid #FBBF24', animation: 'fadeInUp 0.5s' }}>
              <div className="flex items-center gap-2 mb-2"><Lightbulb size={22} style={{ color: '#D97706' }} /><h4 className="font-extrabold italic text-lg" style={{ color: '#2C1810' }}>Wacht eens…</h4></div>
              <p className="italic mb-3" style={{ color: '#2C1810', lineHeight: 1.6 }}><span className="font-bold">6,7 − 5,7 = precies 1!</span> Dat is geen toeval. COP is altijd precies 1 hoger dan EER. De condensor voert <em>álle</em> warmte af: verdamper <em>plus</em> compressor.</p>
              <div className="p-3 rounded-xl" style={{ background: 'white', border: '2px solid #2C1810' }}><p className="text-center font-extrabold text-lg" style={{ color: '#2C1810' }}>COP = EER + 1</p></div>
            </div>
          )}
          {ahaReveal && !ahaDone && (
            <div className="mt-4 p-5 rounded-2xl bg-white" style={{ border: '2px solid #2C1810', animation: 'fadeInUp 0.3s' }}>
              <p className="font-bold mb-1" style={{ color: '#2C1810' }}>Extra vraag</p>
              <p className="text-sm italic mb-3" style={{ color: '#5C3A21' }}>Een koelmachine heeft een EER van 4,2. Wat is de COP als warmtepomp?</p>
              <div className="grid sm:grid-cols-2 gap-2 mb-3">
                {ahaOptions.map((opt, i) => {
                  let optStyle = { border: '2px solid #e8e0c8', background: '#FAFAF5' };
                  if (ahaQuestionSelected === i && !ahaChecked) optStyle = { border: '2px solid #5C3A21', background: '#f0e8d0' };
                  if (ahaChecked && i === ahaCorrect) optStyle = { border: '2px solid #6B8E3D', background: 'rgba(107,142,61,0.1)' };
                  if (ahaChecked && ahaQuestionSelected === i && i !== ahaCorrect) optStyle = { border: '2px solid #B84A3D', background: 'rgba(184,74,61,0.1)' };
                  return <button key={i} disabled={ahaDone || ahaChecked} onClick={() => setAhaQuestionSelected(i)} className="text-left px-4 py-3 rounded-xl text-sm transition-all hover:brightness-95" style={optStyle}><span style={{ color: '#2C1810' }}>{opt}</span></button>;
                })}
              </div>
              {!ahaChecked && <button onClick={handleAhaCheck} disabled={ahaQuestionSelected === null} className="w-full py-3 rounded-xl font-bold italic text-white hover:brightness-90 active:scale-95 disabled:opacity-40" style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 rgba(0,0,0,0.2)' }}>Controleer</button>}
              {ahaChecked && ahaQuestionSelected !== ahaCorrect && <div className="p-3 rounded-xl text-white text-sm italic mb-2" style={{ background: '#B84A3D' }}>Onthoud: COP = EER + 1. Bij EER = 4,2 is COP = 5,2.</div>}
              {ahaChecked && ahaQuestionSelected !== ahaCorrect && <button onClick={() => { setAhaChecked(false); setAhaQuestionSelected(null); }} className="w-full py-3 rounded-xl font-bold italic text-white hover:brightness-90 active:scale-95" style={{ background: '#B84A3D', border: '2px solid #2C1810', boxShadow: '0 3px 0 rgba(0,0,0,0.2)' }}>Probeer opnieuw</button>}
            </div>
          )}
          {ahaDone && (
            <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(107,142,61,0.1)', border: '2px solid #6B8E3D', animation: 'fadeInUp 0.3s' }}>
              <p className="italic mb-3" style={{ color: '#2C1810', lineHeight: 1.6 }}><span className="font-bold">Perfect!</span> COP is altijd EER + 1.</p>
              <button onClick={() => onComplete(stepPoints)} className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2" style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>Volgende <ChevronRight size={18} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M2 INTRO
// ═══════════════════════════════════════════════════════════════

function M2IntroScreen({ onBegin }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-lg bg-white rounded-2xl p-8" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', animation: 'fadeInUp 0.5s ease-out' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.2)' }}>
            <Thermometer size={22} style={{ color: '#5C3A21' }} />
          </div>
          <h2 className="text-xl font-extrabold" style={{ color: '#2C1810' }}>Missie 2 — Oververhitting & Nakoeling</h2>
        </div>
        <div className="italic leading-relaxed mb-6" style={{ color: '#5C3A21', lineHeight: 1.7 }}>
          <p className="font-extrabold text-lg mb-2" style={{ color: '#2C1810' }}>De koelinstallatie beoordelen</p>
          <p className="mb-2">Je kent het rendement. Nu komen twee nieuwe begrippen: <span className="font-bold">oververhitting</span> en <span className="font-bold">nakoeling</span>.</p>
          <p>Met deze twee waarden bepaal je hoe goed je koelmachine werkt en of er genoeg koelmiddel in zit. Je leest ze af in het diagram.</p>
        </div>
        <button onClick={onBegin} className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
          style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>Aan de slag <ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXAM-STYLE BOOTJE FIGURE — schematische bootje met enthalpie-brackets A-F
// Net als het examen: brackets onder/boven het bootje markeren enthalpie-bereiken
// ═══════════════════════════════════════════════════════════════

function ExamBootjeFigure() {
  // Schematic bootje met asymmetrische dome (zoals in StylizedBootje, smaller)
  // Y-waardes: yTop = 100, yBottom = 220
  // Dome kruist bootje-lijnen bij deze x-waardes (uitgerekend uit Bezier curves):
  //   h3'  ≈ 170 (liquid-lijn kruist bootje-toplijn bij y=100)
  //   h2'  ≈ 378 (vapor-lijn kruist bootje-toplijn bij y=100)
  //   h1'  ≈ 380 (vapor-lijn kruist bootje-bottomlijn bij y=220)
  const W = 560, H = 400;
  const yTop = 100, yBottom = 220;
  const h3 = 110, h3prime = 170;
  const h2prime = 378, h2 = 460;
  const h4 = h3, h1prime = 380, h1 = 425;

  const Bracket = ({ x1, x2, y, label, above = true, color = '#2C1810' }) => {
    const tickH = 8;
    // Tick marks wijzen naar bootje toe (above = down, below = up)
    const tickDir = above ? 1 : -1;
    // Label blijft aan buitenkant van bracket
    const labelDir = above ? -1 : 1;
    return (
      <g>
        <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="1.5" />
        <line x1={x1} y1={y} x2={x1} y2={y + tickDir * tickH} stroke={color} strokeWidth="1.5" />
        <line x1={x2} y1={y} x2={x2} y2={y + tickDir * tickH} stroke={color} strokeWidth="1.5" />
        <text x={(x1 + x2) / 2} y={y + labelDir * 8} textAnchor="middle" fontSize="15" fontWeight="bold" fill={color} fontFamily="Nunito">{label}</text>
      </g>
    );
  };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 400, background: '#FFFDF5', borderRadius: 8, border: '1.5px solid #2C1810' }}>
        {/* Dome — asymmetrisch, smaller versie */}
        {/* Vloeistoflijn (blauw): (60,300) via (75,180), (190,55) naar K (285,30) */}
        {/* Damplijn (rood): K (285,30) via (395,30), (405,155) naar (360,300) */}
        <path d="M 60 300 C 75 180, 190 55, 285 30 C 395 30, 405 155, 360 300 Z"
          fill="rgba(168, 85, 247, 0.08)" />
        <path d="M 60 300 C 75 180, 190 55, 285 30"
          fill="none" stroke="#3B82F6" strokeWidth="2" />
        <path d="M 285 30 C 395 30, 405 155, 360 300"
          fill="none" stroke="#EF4444" strokeWidth="2" />
        <circle cx={285} cy={30} r="3.5" fill="#2C1810" />
        <text x={292} y={28} fontSize="10" fontWeight="700" fill="#2C1810" fontFamily="Nunito">K</text>

        {/* Bootje — quadrilateral met punten 1-4 */}
        <line x1={h4} y1={yBottom} x2={h1} y2={yBottom} stroke="#2C1810" strokeWidth="2" />
        <line x1={h3} y1={yTop} x2={h2} y2={yTop} stroke="#2C1810" strokeWidth="2" />
        <line x1={h3} y1={yTop} x2={h4} y2={yBottom} stroke="#2C1810" strokeWidth="2" />
        <line x1={h1} y1={yBottom} x2={h2} y2={yTop} stroke="#2C1810" strokeWidth="2" />

        {/* Verticale stippellijnen naar de brackets — uitgelijnd op dome-kruisingen */}
        <line x1={h3prime} y1={yTop} x2={h3prime} y2={55} stroke="#2C1810" strokeWidth="0.8" strokeDasharray="2 3" />
        <line x1={h2prime} y1={yTop} x2={h2prime} y2={55} stroke="#2C1810" strokeWidth="0.8" strokeDasharray="2 3" />
        <line x1={h1prime} y1={yBottom} x2={h1prime} y2={285} stroke="#2C1810" strokeWidth="0.8" strokeDasharray="2 3" />

        {/* Brackets bovenaan: C, D, E */}
        <Bracket x1={h3} x2={h3prime} y={75} label="C" above={true} />
        <Bracket x1={h3prime} x2={h2prime} y={75} label="D" above={true} />
        <Bracket x1={h2prime} x2={h2} y={75} label="E" above={true} />

        {/* Brackets onderaan: B (verdamping), F (oververhitting), A (verdampervermogen) */}
        <Bracket x1={h4} x2={h1prime} y={245} label="B" above={false} />
        <Bracket x1={h1prime} x2={h1} y={245} label="F" above={false} />
        <Bracket x1={h4} x2={h1} y={290} label="A" above={false} />

        {/* Bootje punten 1, 2, 3, 4 */}
        {[
          { x: h1, y: yBottom, label: '1' },
          { x: h2, y: yTop, label: '2' },
          { x: h3, y: yTop, label: '3' },
          { x: h4, y: yBottom, label: '4' },
        ].map(p => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="11" fill="white" stroke="#2C1810" strokeWidth="1.5" />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#2C1810" fontFamily="Nunito">{p.label}</text>
          </g>
        ))}
      </svg>
      <p className="text-xs italic text-center mt-1" style={{ color: '#5C3A21' }}>Figuur 1</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M2R1 — IDENTIFY OVH & NAK ON DIAGRAM
// ═══════════════════════════════════════════════════════════════

function IdentifyOvhNak({ onComplete, onLoseLife, lives }) {
  const svgRef = useRef(null);
  const m = M2_MEASUREMENTS;
  const [phase, setPhase] = useState('ovh'); // 'ovh' | 'nak' | 'explain' | 'done'
  const [points, setPoints] = useState(0);
  const [flash, setFlash] = useState(null);

  // Compute bootje points
  const p1 = computePoint(m.T_zuigleiding, m.lowPressureAbs, 'superheated');
  const p2 = computePoint(m.T_eindcompressie, m.highPressureAbs, 'superheated');
  const p3 = computePoint(m.T_voor_expansie, m.highPressureAbs, 'subcooled');
  const p4 = { h: p3.h, P: m.lowPressureAbs };
  const satLP = satAtP(m.lowPressureAbs);
  const satHP = satAtP(m.highPressureAbs);
  const p1prime = { h: satLP.hV, P: m.lowPressureAbs };  // exact op snijpunt damplijn × lagedruklijn
  const p3prime = { h: satHP.hL, P: m.highPressureAbs };  // exact op snijpunt vloeistoflijn × hogedruklijn

  // Segment definitions
  const segments = [
    { key: 'compressor', from: p1, to: p2, color: '#2563EB', label: 'Compressor', labelNum: 'A' },
    { key: 'condensor', from: p2, to: p3prime, color: '#DC2626', label: 'Condensor', labelNum: 'B' },
    { key: 'nakoeling', from: p3prime, to: p3, color: '#06B6D4', label: 'Nakoeling', labelNum: 'C' },
    { key: 'expansie', from: p3, to: p4, color: '#7C3AED', label: 'Expansie', labelNum: 'D' },
    { key: 'verdamper', from: p4, to: p1prime, color: '#059669', label: 'Verdamper', labelNum: 'E' },
    { key: 'oververhitting', from: p1prime, to: p1, color: '#F59E0B', label: 'Oververhitting', labelNum: 'F' },
  ];

  const handleSegmentClick = (key) => {
    if (phase === 'ovh') {
      if (key === 'oververhitting') {
        setPoints(p => p + SCORING.m2r1.perSegment);
        setFlash({ type: 'correct', msg: 'Goed! Dit segment is de oververhitting (1\' → 1).' });
        setTimeout(() => { setFlash(null); setPhase('nak'); }, 1500);
      } else {
        setFlash({ type: 'wrong', msg: 'Dat is niet de oververhitting. Zoek het segment tussen punt 1\' (damplijn) en punt 1.' });
        onLoseLife?.();
        setTimeout(() => setFlash(null), 2000);
      }
    } else if (phase === 'nak') {
      if (key === 'nakoeling') {
        setPoints(p => p + SCORING.m2r1.perSegment);
        setFlash({ type: 'correct', msg: 'Correct! Dit segment is de nakoeling (3\' → 3).' });
        setTimeout(() => { setFlash(null); setPhase('explain'); }, 1500);
      } else {
        setFlash({ type: 'wrong', msg: 'Dat is niet de nakoeling. Zoek het segment tussen punt 3\' (vloeistoflijn) en punt 3.' });
        onLoseLife?.();
        setTimeout(() => setFlash(null), 2000);
      }
    }
  };

  return (
    <div className="min-h-screen p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-5xl mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <h3 className="text-lg font-extrabold mb-1" style={{ color: '#2C1810' }}>Ronde 2.1 — OVH & NAK herkennen</h3>
          <p className="text-sm italic mb-4" style={{ color: '#5C3A21' }}>
            {phase === 'ovh' && <><span className="font-bold not-italic">Klik op het segment dat de oververhitting voorstelt.</span></>}
            {phase === 'nak' && <><span className="font-bold not-italic">Klik nu op het segment dat de nakoeling voorstelt.</span></>}
            {phase === 'explain' && 'Goed gevonden! Lees de uitleg hieronder.'}
            {phase === 'done' && 'Klaar!'}
          </p>

          {flash && (
            <div className="p-3 rounded-xl text-sm mb-3 text-white italic" style={{ background: flash.type === 'correct' ? '#6B8E3D' : '#B84A3D' }}>
              {flash.msg}
            </div>
          )}

          <R134aDiagram svgRef={svgRef} lines={{ highP: m.highPressureAbs, lowP: m.lowPressureAbs }} showCrosshair={false} showReadout={false}>
            {/* Draw segments as clickable lines */}
            {segments.map(seg => {
              const [x1, y1] = hpToXY(seg.from.h, seg.from.P);
              const [x2, y2] = hpToXY(seg.to.h, seg.to.P);
              const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
              const isTarget = (phase === 'ovh' && seg.key === 'oververhitting') || (phase === 'nak' && seg.key === 'nakoeling');
              const isClickable = phase === 'ovh' || phase === 'nak';
              const highlighted = (phase === 'nak' && seg.key === 'oververhitting') || (phase === 'explain' && (seg.key === 'oververhitting' || seg.key === 'nakoeling'));
              return (
                <g key={seg.key}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={seg.color} strokeWidth={highlighted ? 5 : 3} strokeLinecap="round" />
                  {/* Invisible wider hit area */}
                  {isClickable && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="20" style={{ cursor: 'pointer' }} onClick={() => handleSegmentClick(seg.key)} />}
{null}
                </g>
              );
            })}
            {/* Extra points 1' and 3' */}
            {[{ pt: p1prime, label: "1'" }, { pt: p3prime, label: "3'" }].map(({ pt, label }) => {
              const [x, y] = hpToXY(pt.h, pt.P);
              return (
                <g key={label}>
                  <circle cx={x} cy={y} r="9" fill="#FBBF24" stroke="#2C1810" strokeWidth="2" />
                  <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#2C1810" fontFamily="Nunito">{label}</text>
                </g>
              );
            })}
            {/* Regular bootje points */}
            {[{ pt: p1, label: '1' }, { pt: p2, label: '2' }, { pt: p3, label: '3' }, { pt: p4, label: '4' }].map(({ pt, label }) => {
              const [x, y] = hpToXY(pt.h, pt.P);
              return (
                <g key={`bp${label}`}>
                  <circle cx={x} cy={y} r="10" fill="white" stroke="#2C1810" strokeWidth="2" />
                  <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#2C1810" fontFamily="Nunito">{label}</text>
                </g>
              );
            })}
          </R134aDiagram>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {segments.map(seg => (
              <span key={seg.key} className="text-xs px-2 py-1 rounded-lg font-bold" style={{ background: `${seg.color}15`, color: seg.color, border: `1px solid ${seg.color}40` }}>
                {seg.label}
              </span>
            ))}
          </div>
        </div>

        {/* Explanation panel */}
        {phase === 'explain' && (
          <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: '2px solid #6B8E3D', animation: 'fadeInUp 0.4s' }}>
            <div className="flex items-center gap-2 mb-3"><Lightbulb size={20} style={{ color: '#D97706' }} /><h4 className="font-extrabold" style={{ color: '#2C1810' }}>Waarom zijn deze zo belangrijk?</h4></div>
            <div className="space-y-3 italic text-sm" style={{ color: '#2C1810', lineHeight: 1.7 }}>
              <p><span className="font-bold not-italic" style={{ color: '#F59E0B' }}>Oververhitting</span> beschermt de compressor: die mag onder geen beding <em>nat</em> koudemiddel aanzuigen. Het temperatuurverschil tussen punt 1' en 1 zegt iets over de hoeveelheid koudemiddel in de installatie.</p>
              <p><span className="font-bold not-italic" style={{ color: '#06B6D4' }}>Nakoeling</span> vergroot het enthalpieverschil in de verdamper, waardoor het rendement stijgt. Ook dit temperatuurverschil is een parameter voor de hoeveelheid koudemiddel.</p>
              <p>Samen geven ze je inzicht in hoe efficiënt en stabiel het koelproces verloopt en of het koudemiddel zich in de juiste fase en hoeveelheid door het systeem beweegt.</p>
            </div>
            <button onClick={() => onComplete(points)} className="w-full mt-4 py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
              style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>Volgende <ChevronRight size={18} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M2R2 — TABLES GAME
// ═══════════════════════════════════════════════════════════════

function DiagnosticTable({ title, headers, rows, color }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '2px solid #2C1810' }}>
      <div className="px-3 py-2 text-white font-bold text-sm" style={{ background: color }}>{title}</div>
      <table className="w-full text-xs">
        <thead><tr>{headers.map((h, i) => <th key={i} className="px-2 py-1.5 text-left font-bold" style={{ background: '#f0e8d0', color: '#2C1810', borderBottom: '1px solid #d4c9a8' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="px-2 py-1.5" style={{ borderBottom: '1px solid #e8e0c8', color: '#2C1810' }}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function TablesGame({ onComplete, onLoseLife, lives }) {
  const [phase, setPhase] = useState('study'); // 'study' | 'quiz'
  const [scenarios] = useState(() => shuffleArray(M2R2_SCENARIOS));
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [step, setStep] = useState(0); // 0=ovh, 1=nak, 2=diagnosis
  const [points, setPoints] = useState(0);
  const [allCorrectFirstTry, setAllCorrectFirstTry] = useState(true);
  const [flash, setFlash] = useState(null);
  const [scenarioDone, setScenarioDone] = useState(false);

  const scenario = scenarios[scenarioIdx];
  const isLastScenario = scenarioIdx === scenarios.length - 1;

  const classifyLabel = (cls) => cls === 'low' ? 'Te laag' : cls === 'normal' ? 'Normaal' : 'Te hoog';

  const handleClassify = (choice) => {
    const expected = step === 0 ? scenario.ovhClass : scenario.nakClass;
    if (choice === expected) {
      setFlash({ type: 'correct', msg: `Correct! ${step === 0 ? 'OVH' : 'NAK'} is ${classifyLabel(expected)}.` });
      setTimeout(() => { setFlash(null); setStep(s => s + 1); }, 1000);
    } else {
      setFlash({ type: 'wrong', msg: `Niet juist. Kijk nog eens naar de tabel.` });
      onLoseLife?.(); setAllCorrectFirstTry(false);
      setTimeout(() => setFlash(null), 1500);
    }
  };

  const handleDiagnosis = (key) => {
    if (key === scenario.diagnosisKey) {
      const diagLabel = DIAGNOSIS_TABLE.find(d => d.key === key)?.diagnosis;
      setPoints(p => p + SCORING.m2r2.perScenario);
      setFlash({ type: 'correct', msg: `Correct! ${diagLabel}.` });
      setScenarioDone(true);
      setTimeout(() => setFlash(null), 1500);
    } else {
      setFlash({ type: 'wrong', msg: 'Niet juist. Combineer OVH en NAK in de diagnosetabel.' });
      onLoseLife?.(); setAllCorrectFirstTry(false);
      setTimeout(() => setFlash(null), 1500);
    }
  };

  const handleNext = () => {
    if (isLastScenario) {
      const bonus = allCorrectFirstTry ? SCORING.m2r2.bonus : 0;
      onComplete(points + bonus);
    } else {
      setScenarioIdx(i => i + 1); setStep(0); setScenarioDone(false); setFlash(null);
    }
  };

  if (phase === 'study') {
    return (
      <div className="min-h-screen p-4" style={{ background: '#F5EDD6' }}>
        <div className="max-w-5xl mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
          <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <h3 className="text-lg font-extrabold mb-1" style={{ color: '#2C1810' }}>Ronde 2.2 — Diagnosetabellen</h3>
            <p className="text-sm italic mb-4" style={{ color: '#5C3A21' }}>Bestudeer de tabellen hieronder. Daarna ga je scenario's beoordelen.</p>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <DiagnosticTable title="Oververhitting" color="#F59E0B" headers={['Waarde', 'Mogelijke oorzaak', 'Betekenis']}
                rows={OVH_TABLE.map(r => [r.range, r.cause, r.meaning])} />
              <DiagnosticTable title="Nakoeling" color="#06B6D4" headers={['Waarde', 'Mogelijke oorzaak', 'Betekenis']}
                rows={NAK_TABLE.map(r => [r.range, r.cause, r.meaning])} />
            </div>
            <DiagnosticTable title="Diagnose (combinatie)" color="#5C3A21" headers={['Oververhitting', 'Nakoeling', 'Diagnose']}
              rows={DIAGNOSIS_TABLE.map(d => [d.ovh, d.nak, d.diagnosis])} />
            <button onClick={() => setPhase('quiz')} className="w-full mt-4 py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
              style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>Ik snap het — Start de quiz <ChevronRight size={18} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-2xl mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-extrabold" style={{ color: '#2C1810' }}>Scenario {scenarioIdx + 1} van {scenarios.length}</h3>
            <span className="text-sm font-bold px-2 py-1 rounded-lg" style={{ background: '#FBBF24', color: '#2C1810' }}>{scenario.label}</span>
          </div>

          <div className="p-4 rounded-xl mb-4" style={{ background: '#f0e8d0', border: '2px solid #d4c9a8' }}>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div><p className="text-xs font-bold mb-1" style={{ color: '#F59E0B' }}>Oververhitting</p><p className="text-2xl font-extrabold" style={{ color: '#2C1810' }}>{fmtNum(scenario.ovhValue, 1)} K</p></div>
              <div><p className="text-xs font-bold mb-1" style={{ color: '#06B6D4' }}>Nakoeling</p><p className="text-2xl font-extrabold" style={{ color: '#2C1810' }}>{fmtNum(scenario.nakValue, 1)} K</p></div>
            </div>
          </div>

          {flash && <div className="p-3 rounded-xl text-sm mb-3 text-white italic" style={{ background: flash.type === 'correct' ? '#6B8E3D' : '#B84A3D' }}>{flash.msg}</div>}

          {/* Step 0: Classify OVH */}
          {step === 0 && (
            <div>
              <p className="text-sm font-bold mb-2" style={{ color: '#2C1810' }}>Stap 1: Beoordeel de oververhitting</p>
              <div className="flex gap-2">
                {['low', 'normal', 'high'].map(cls => (
                  <button key={cls} onClick={() => handleClassify(cls)} className="flex-1 py-3 rounded-xl font-bold text-sm hover:brightness-90 active:scale-95"
                    style={{ background: '#F59E0B', color: 'white', border: '2px solid #2C1810', boxShadow: '0 2px 0 rgba(0,0,0,0.15)' }}>
                    {classifyLabel(cls)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Classify NAK */}
          {step === 1 && (
            <div>
              <p className="text-sm font-bold mb-2" style={{ color: '#2C1810' }}>Stap 2: Beoordeel de nakoeling</p>
              <div className="flex gap-2">
                {['low', 'normal', 'high'].map(cls => (
                  <button key={cls} onClick={() => handleClassify(cls)} className="flex-1 py-3 rounded-xl font-bold text-sm hover:brightness-90 active:scale-95"
                    style={{ background: '#06B6D4', color: 'white', border: '2px solid #2C1810', boxShadow: '0 2px 0 rgba(0,0,0,0.15)' }}>
                    {classifyLabel(cls)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Diagnosis */}
          {step === 2 && !scenarioDone && (
            <div>
              <p className="text-sm font-bold mb-2" style={{ color: '#2C1810' }}>Stap 3: Wat is de diagnose?</p>
              <div className="space-y-2">
                {DIAGNOSIS_TABLE.map(d => (
                  <button key={d.key} onClick={() => handleDiagnosis(d.key)} className="w-full text-left px-4 py-3 rounded-xl text-sm hover:brightness-95 active:scale-[0.98]"
                    style={{ border: '2px solid #e8e0c8', background: '#FAFAF5', color: '#2C1810' }}>
                    {d.diagnosis}
                  </button>
                ))}
              </div>
            </div>
          )}

          {scenarioDone && (
            <button onClick={handleNext} className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
              style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>
              {isLastScenario ? 'Volgende' : 'Volgend scenario'} <ChevronRight size={18} />
            </button>
          )}
        </div>

        {/* Tabellen als naslagwerk onder het scenario */}
        <div className="space-y-3 mb-4">
          {step === 0 && <DiagnosticTable title="Oververhitting" color="#F59E0B" headers={['Waarde', 'Mogelijke oorzaak', 'Betekenis']} rows={OVH_TABLE.map(r => [r.range, r.cause, r.meaning])} />}
          {step === 1 && <DiagnosticTable title="Nakoeling" color="#06B6D4" headers={['Waarde', 'Mogelijke oorzaak', 'Betekenis']} rows={NAK_TABLE.map(r => [r.range, r.cause, r.meaning])} />}
          {step === 2 && !scenarioDone && <DiagnosticTable title="Diagnose (combinatie)" color="#5C3A21" headers={['Oververhitting', 'Nakoeling', 'Diagnose']} rows={DIAGNOSIS_TABLE.map(d => [d.ovh, d.nak, d.diagnosis])} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M2R3 — MEASURE AND ASSESS FROM DIAGRAM
// ═══════════════════════════════════════════════════════════════

function MeasureAndAssess({ onComplete, onLoseLife, lives }) {
  const svgRef = useRef(null);
  const [scenarios] = useState(() => shuffleArray(M2R3_SCENARIOS));
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [step, setStep] = useState(0); // 0=readOVH, 1=readNAK, 2=assessOVH, 3=assessNAK, 4=done
  const [ovhInput, setOvhInput] = useState('');
  const [nakInput, setNakInput] = useState('');
  const [ovhSlots, setOvhSlots] = useState({ left: null, right: null });
  const [nakSlots, setNakSlots] = useState({ left: null, right: null });
  const [points, setPoints] = useState(0);
  const [flash, setFlash] = useState(null);

  const scenario = scenarios[scenarioIdx];
  const isLastScenario = scenarioIdx === scenarios.length - 1;

  // Compute diagram points
  const p1 = computePoint(scenario.T_zuig, scenario.lowP, 'superheated');
  const p2 = computePoint(scenario.T_eindcompressie, scenario.highP, 'superheated');
  const p3 = computePoint(scenario.T_voor_expansie, scenario.highP, 'subcooled');
  const p4 = { h: p3.h, P: scenario.lowP };
  const satLP = satAtP(scenario.lowP);
  const satHP = satAtP(scenario.highP);
  const p1prime = { h: satLP.hV, P: scenario.lowP };
  const p3prime = { h: satHP.hL, P: scenario.highP };

  const assessLabel = (cls) => cls === 'low' ? 'Te laag' : cls === 'normal' ? 'Normaal' : 'Te hoog';

  // Beschikbare temperatuurblokken (draggable)
  const tempSources = [
    { id: 'T_verd', label: 'T_verdamping', value: scenario.T_verdamping },
    { id: 'T_zuig', label: 'T_zuig', value: scenario.T_zuig },
    { id: 'T_cond', label: 'T_condensatie', value: scenario.T_condensatie },
    { id: 'T_vexp', label: 'T_voor_expansie', value: scenario.T_voor_expansie },
  ];
  const tempById = Object.fromEntries(tempSources.map(t => [t.id, t]));

  // Automatisch OVH/NAK uitrekenen wanneer beide temperatuurblokken zijn neergezet
  useEffect(() => {
    if (ovhSlots.left && ovhSlots.right) {
      const computed = String(tempById[ovhSlots.left].value - tempById[ovhSlots.right].value);
      if (computed !== ovhInput) setOvhInput(computed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ovhSlots.left, ovhSlots.right, scenarioIdx]);

  useEffect(() => {
    if (nakSlots.left && nakSlots.right) {
      const computed = String(tempById[nakSlots.left].value - tempById[nakSlots.right].value);
      if (computed !== nakInput) setNakInput(computed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nakSlots.left, nakSlots.right, scenarioIdx]);

  const handleReadingCheck = (isOvh) => {
    const slots = isOvh ? ovhSlots : nakSlots;
    const input = isOvh ? ovhInput : nakInput;
    const expectedLeft = isOvh ? 'T_zuig' : 'T_cond';
    const expectedRight = isOvh ? 'T_verd' : 'T_vexp';
    const leftOk = slots.left === expectedLeft;
    const rightOk = slots.right === expectedRight;
    const v = parseNum(input);
    const expected = isOvh ? scenario.expectedOVH : scenario.expectedNAK;

    if (!leftOk || !rightOk) {
      setFlash({ type: 'wrong', msg: `Niet juist. Voor ${isOvh ? 'OVH' : 'NAK'} gebruik je ${isOvh ? 'T_zuig − T_verdamping' : 'T_condensatie − T_voor_expansie'}.` });
      onLoseLife?.();
      setTimeout(() => setFlash(null), 2000);
      return;
    }
    if (Number.isNaN(v)) return;
    if (Math.abs(v - expected) > 2) {
      setFlash({ type: 'wrong', msg: `Het resultaat klopt niet. Bereken ${tempById[slots.left].value} − (${tempById[slots.right].value}).` });
      onLoseLife?.();
      setTimeout(() => setFlash(null), 2000);
      return;
    }
    setPoints(p => p + SCORING.m2r3.perReading);
    setFlash({ type: 'correct', msg: `Correct! ${isOvh ? 'OVH' : 'NAK'} = ${expected}K.` });
    setTimeout(() => { setFlash(null); setStep(s => s + 1); }, 1000);
  };

  const handleAssessment = (choice) => {
    const isOvh = step === 2;
    const expected = isOvh ? scenario.ovhAssessment : scenario.nakAssessment;
    if (choice === expected) {
      setPoints(p => p + SCORING.m2r3.perAssessment);
      setFlash({ type: 'correct', msg: `Correct! ${isOvh ? 'OVH' : 'NAK'} is ${assessLabel(expected)}.` });
      setTimeout(() => {
        setFlash(null);
        if (step === 3) setStep(4);
        else setStep(s => s + 1);
      }, 1000);
    } else {
      setFlash({ type: 'wrong', msg: 'Niet juist. Kijk naar de waarde en vergelijk met de normaalwaarden.' });
      onLoseLife?.();
      setTimeout(() => setFlash(null), 1500);
    }
  };

  const handleNext = () => {
    if (isLastScenario) {
      onComplete(points);
    } else {
      setScenarioIdx(i => i + 1); setStep(0);
      setOvhInput(''); setNakInput('');
      setOvhSlots({ left: null, right: null }); setNakSlots({ left: null, right: null });
      setFlash(null);
    }
  };

  return (
    <div className="min-h-screen p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-5xl mx-auto" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-extrabold" style={{ color: '#2C1810' }}>Ronde 2.3 — Meten & beoordelen</h3>
            <span className="text-sm font-bold px-2 py-1 rounded-lg" style={{ background: '#FBBF24', color: '#2C1810' }}>{scenario.label} ({scenarioIdx + 1}/{scenarios.length})</span>
          </div>

          {/* Temperature info panel — sleepbare blokken (alleen zichtbaar in stap 0 en 1) */}
          {(step === 0 || step === 1) && (
            <div className="p-3 rounded-xl mb-3" style={{ background: '#f0e8d0', border: '2px solid #d4c9a8' }}>
              <p className="text-xs font-bold mb-2" style={{ color: '#5C3A21' }}>Sleep de juiste temperatuur naar de berekening:</p>
              <div className="flex flex-wrap gap-2">
                {tempSources.map(t => (
                  <div key={t.id} draggable={true}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                    className="inline-flex flex-col items-center px-3 py-2 rounded-lg font-bold text-xs select-none"
                    style={{ cursor: 'grab', background: '#FBBF24', color: '#2C1810', border: '2px solid #2C1810', boxShadow: '0 2px 0 rgba(0,0,0,0.15)', minWidth: 110 }}>
                    <span className="opacity-80 text-[10px]">{t.label}</span>
                    <span className="text-sm">{t.value > 0 ? '+' : ''}{t.value}°C</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Read-only temps bij stappen 2+ */}
          {step >= 2 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-center">
              <div className="p-2 rounded-lg" style={{ background: '#f0e8d0' }}><p className="text-xs" style={{ color: '#5C3A21' }}>T verdamping</p><p className="font-bold" style={{ color: '#2C1810' }}>{scenario.T_verdamping}°C</p></div>
              <div className="p-2 rounded-lg" style={{ background: '#f0e8d0' }}><p className="text-xs" style={{ color: '#5C3A21' }}>T zuigleiding</p><p className="font-bold" style={{ color: '#2C1810' }}>{scenario.T_zuig}°C</p></div>
              <div className="p-2 rounded-lg" style={{ background: '#f0e8d0' }}><p className="text-xs" style={{ color: '#5C3A21' }}>T condensatie</p><p className="font-bold" style={{ color: '#2C1810' }}>{scenario.T_condensatie}°C</p></div>
              <div className="p-2 rounded-lg" style={{ background: '#f0e8d0' }}><p className="text-xs" style={{ color: '#5C3A21' }}>T voor expansie</p><p className="font-bold" style={{ color: '#2C1810' }}>{scenario.T_voor_expansie}°C</p></div>
            </div>
          )}

          {flash && <div className="p-3 rounded-xl text-sm mb-3 text-white italic" style={{ background: flash.type === 'correct' ? '#6B8E3D' : '#B84A3D' }}>{flash.msg}</div>}

          {/* Diagram */}
          <R134aDiagram svgRef={svgRef} lines={{ highP: scenario.highP, lowP: scenario.lowP }} showCrosshair={false} showReadout={false}>
            {/* OVH segment */}
            {(() => {
              const [x1, y1] = hpToXY(p1prime.h, p1prime.P);
              const [x2, y2] = hpToXY(p1.h, p1.P);
              return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />;
            })()}
            {/* NAK segment */}
            {(() => {
              const [x1, y1] = hpToXY(p3prime.h, p3prime.P);
              const [x2, y2] = hpToXY(p3.h, p3.P);
              return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#06B6D4" strokeWidth="4" strokeLinecap="round" />;
            })()}
            {/* Bootje lines */}
            {(() => {
              const [x1a, y1a] = hpToXY(p1.h, p1.P); const [x2a, y2a] = hpToXY(p2.h, p2.P);
              const [x3a, y3a] = hpToXY(p3prime.h, p3prime.P); const [x4a, y4a] = hpToXY(p4.h, p4.P);
              const [x1p, y1p] = hpToXY(p1prime.h, p1prime.P);
              return <>
                <line x1={x1a} y1={y1a} x2={x2a} y2={y2a} stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
                <line x1={x2a} y1={y2a} x2={x3a} y2={y3a} stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
                <line x1={hpToXY(p3.h, p3.P)[0]} y1={hpToXY(p3.h, p3.P)[1]} x2={x4a} y2={y4a} stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" />
                <line x1={x4a} y1={y4a} x2={x1p} y2={y1p} stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
              </>;
            })()}
            {/* OVH/NAK labels on diagram */}
            {(() => {
              const [xo1, yo1] = hpToXY(p1prime.h, p1prime.P);
              const [xo2, yo2] = hpToXY(p1.h, p1.P);
              const midXo = (xo1 + xo2) / 2, midYo = (yo1 + yo2) / 2;
              return <text x={midXo} y={midYo + 20} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#F59E0B" fontFamily="Nunito">OVH</text>;
            })()}
            {(() => {
              const [xn1, yn1] = hpToXY(p3prime.h, p3prime.P);
              const [xn2, yn2] = hpToXY(p3.h, p3.P);
              const midXn = (xn1 + xn2) / 2, midYn = (yn1 + yn2) / 2;
              return <text x={midXn} y={midYn - 10} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#06B6D4" fontFamily="Nunito">NAK</text>;
            })()}
            {/* Points */}
            {[{ pt: p1prime, label: "1'" }, { pt: p3prime, label: "3'" }].map(({ pt, label }) => {
              const [x, y] = hpToXY(pt.h, pt.P);
              return <g key={label}><circle cx={x} cy={y} r="9" fill="#FBBF24" stroke="#2C1810" strokeWidth="2" /><text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#2C1810" fontFamily="Nunito">{label}</text></g>;
            })}
            {[{ pt: p1, label: '1' }, { pt: p2, label: '2' }, { pt: p3, label: '3' }, { pt: p4, label: '4' }].map(({ pt, label }) => {
              const [x, y] = hpToXY(pt.h, pt.P);
              return <g key={`p${label}`}><circle cx={x} cy={y} r="10" fill="white" stroke="#2C1810" strokeWidth="2" /><text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#2C1810" fontFamily="Nunito">{label}</text></g>;
            })}
          </R134aDiagram>

          {/* Input steps */}
          <div className="mt-4">
            {step === 0 && (
              <div className="p-4 rounded-xl" style={{ background: '#f0e8d0', border: '2px solid #F59E0B' }}>
                <p className="text-sm font-bold mb-3" style={{ color: '#2C1810' }}>Bereken de oververhitting: OVH = T_zuigleiding − T_verdamping</p>
                <div className="flex flex-wrap items-center gap-2">
                  <DropSlot value={ovhSlots.left ? `${tempById[ovhSlots.left].value > 0 ? '+' : ''}${tempById[ovhSlots.left].value}°C` : null} hasValue={!!ovhSlots.left} onDrop={(id) => setOvhSlots(s => ({ ...s, left: id }))} onClear={() => { setOvhSlots(s => ({ ...s, left: null })); setOvhInput(''); }} />
                  <span className="text-xl font-bold" style={{ color: '#2C1810' }}>−</span>
                  <DropSlot value={ovhSlots.right ? `${tempById[ovhSlots.right].value > 0 ? '+' : ''}${tempById[ovhSlots.right].value}°C` : null} hasValue={!!ovhSlots.right} onDrop={(id) => setOvhSlots(s => ({ ...s, right: id }))} onClear={() => { setOvhSlots(s => ({ ...s, right: null })); setOvhInput(''); }} />
                  <span className="text-xl font-bold" style={{ color: '#2C1810' }}>=</span>
                  <input type="text" inputMode="decimal" value={ovhInput} onChange={e => setOvhInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleReadingCheck(true); }}
                    className="w-20 px-2 py-2 rounded-lg font-mono text-sm" style={{ background: 'white', border: '2px solid #F59E0B', color: '#2C1810' }} placeholder="?" />
                  <span className="text-sm" style={{ color: '#5C3A21' }}>K</span>
                  <button onClick={() => handleReadingCheck(true)} disabled={!ovhSlots.left || !ovhSlots.right || ovhInput === ''} className="px-3 py-2 rounded-lg font-bold italic text-white text-sm hover:brightness-90 active:scale-95 disabled:opacity-40"
                    style={{ background: '#F59E0B', border: '2px solid #2C1810' }}>Controleer</button>
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="p-4 rounded-xl" style={{ background: '#f0e8d0', border: '2px solid #06B6D4' }}>
                <p className="text-sm font-bold mb-3" style={{ color: '#2C1810' }}>Bereken de nakoeling: NAK = T_condensatie − T_voor_expansie</p>
                <div className="flex flex-wrap items-center gap-2">
                  <DropSlot value={nakSlots.left ? `${tempById[nakSlots.left].value > 0 ? '+' : ''}${tempById[nakSlots.left].value}°C` : null} hasValue={!!nakSlots.left} onDrop={(id) => setNakSlots(s => ({ ...s, left: id }))} onClear={() => { setNakSlots(s => ({ ...s, left: null })); setNakInput(''); }} />
                  <span className="text-xl font-bold" style={{ color: '#2C1810' }}>−</span>
                  <DropSlot value={nakSlots.right ? `${tempById[nakSlots.right].value > 0 ? '+' : ''}${tempById[nakSlots.right].value}°C` : null} hasValue={!!nakSlots.right} onDrop={(id) => setNakSlots(s => ({ ...s, right: id }))} onClear={() => { setNakSlots(s => ({ ...s, right: null })); setNakInput(''); }} />
                  <span className="text-xl font-bold" style={{ color: '#2C1810' }}>=</span>
                  <input type="text" inputMode="decimal" value={nakInput} onChange={e => setNakInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleReadingCheck(false); }}
                    className="w-20 px-2 py-2 rounded-lg font-mono text-sm" style={{ background: 'white', border: '2px solid #06B6D4', color: '#2C1810' }} placeholder="?" />
                  <span className="text-sm" style={{ color: '#5C3A21' }}>K</span>
                  <button onClick={() => handleReadingCheck(false)} disabled={!nakSlots.left || !nakSlots.right || nakInput === ''} className="px-3 py-2 rounded-lg font-bold italic text-white text-sm hover:brightness-90 active:scale-95 disabled:opacity-40"
                    style={{ background: '#06B6D4', border: '2px solid #2C1810' }}>Controleer</button>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="p-4 rounded-xl" style={{ background: '#f0e8d0', border: '2px solid #F59E0B' }}>
                <p className="text-sm font-bold mb-2" style={{ color: '#2C1810' }}>Beoordeel de oververhitting ({scenario.expectedOVH}K):</p>
                <div className="flex gap-2">
                  {['low', 'normal', 'high'].map(cls => (
                    <button key={cls} onClick={() => handleAssessment(cls)} className="flex-1 py-3 rounded-xl font-bold text-sm hover:brightness-90 active:scale-95"
                      style={{ background: '#F59E0B', color: 'white', border: '2px solid #2C1810' }}>{assessLabel(cls)}</button>
                  ))}
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="p-4 rounded-xl" style={{ background: '#f0e8d0', border: '2px solid #06B6D4' }}>
                <p className="text-sm font-bold mb-2" style={{ color: '#2C1810' }}>Beoordeel de nakoeling ({scenario.expectedNAK}K):</p>
                <div className="flex gap-2">
                  {['low', 'normal', 'high'].map(cls => (
                    <button key={cls} onClick={() => handleAssessment(cls)} className="flex-1 py-3 rounded-xl font-bold text-sm hover:brightness-90 active:scale-95"
                      style={{ background: '#06B6D4', color: 'white', border: '2px solid #2C1810' }}>{assessLabel(cls)}</button>
                  ))}
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="p-4 rounded-xl" style={{ background: 'rgba(107,142,61,0.1)', border: '2px solid #6B8E3D', animation: 'fadeInUp 0.3s' }}>
                <p className="italic mb-2" style={{ color: '#2C1810' }}><span className="font-bold">Goed!</span> OVH = {scenario.expectedOVH}K ({assessLabel(scenario.ovhAssessment)}), NAK = {scenario.expectedNAK}K ({assessLabel(scenario.nakAssessment)}).</p>
                {scenario.diagnosis && (
                  <div className="mb-3 p-3 rounded-lg" style={{ background: '#FBBF24', border: '1.5px solid #2C1810' }}>
                    <p className="text-sm font-bold" style={{ color: '#2C1810' }}>Diagnose: <span className="font-extrabold">{scenario.diagnosis}</span></p>
                  </div>
                )}
                <button onClick={handleNext} className="w-full py-3 text-white rounded-xl font-bold italic hover:brightness-90 active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: '#5C3A21', border: '2px solid #2C1810', boxShadow: '0 3px 0 #3d2615' }}>
                  {isLastScenario ? 'Volgende' : 'Volgend scenario'} <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DEBUG NAV
// ═══════════════════════════════════════════════════════════════

function DebugNav({ visible, currentScreen, onNavigate, onClose }) {
  if (!visible) return null;
  const menuItems = [
    { section: 'Missie 1: Vermogens & rendement' },
    { screen: 'm1r1', label: 'Ronde 1.1: Vermogens labelen' },
    { screen: 'm1r1_check', label: 'Check 1.1', isCheck: true },
    { screen: 'm1r2', label: 'Ronde 1.2: EER berekenen' },
    { screen: 'm1r2_check', label: 'Check 1.2', isCheck: true },
    { screen: 'm1r3', label: 'Ronde 1.3: COP + aha' },
    { screen: 'm1r3_check', label: 'Check 1.3', isCheck: true },
    { section: 'Missie 2: Oververhitting & Nakoeling' },
    { screen: 'm2r1', label: 'Ronde 2.1: OVH & NAK herkennen' },
    { screen: 'm2r1_check', label: 'Check 2.1', isCheck: true },
    { screen: 'm2r2', label: 'Ronde 2.2: Diagnosetabellen' },
    { screen: 'm2r2_check', label: 'Check 2.2', isCheck: true },
    { screen: 'm2r3', label: 'Ronde 2.3: Meten & beoordelen' },
    { screen: 'm2r3_check', label: 'Check 2.3', isCheck: true },
  ];
  const navBtn = (screen, label, bg, color) => (
    <button key={screen} onClick={() => onNavigate(screen)}
      className="w-full text-left px-4 py-2.5 rounded-lg font-semibold text-sm hover:brightness-90 active:scale-[0.98] transition-all"
      style={{ background: currentScreen === screen ? '#FBBF24' : bg, color: currentScreen === screen ? '#2C1810' : color }}>{label}</button>
  );
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-2xl p-6 w-80 max-h-[85vh] overflow-y-auto" style={{ background: '#F5EDD6', border: '3px solid #2C1810' }}>
        <div className="flex justify-between items-center mb-5">
          <span className="text-lg font-extrabold" style={{ color: '#2C1810' }}>Snelmenu (Ctrl+D)</span>
          <button onClick={onClose} className="hover:opacity-70" style={{ color: '#2C1810' }}><X size={20} /></button>
        </div>
        <div className="space-y-1.5">
          {menuItems.map((item, i) => {
            if (item.section) return <p key={i} className="text-sm font-bold pt-3 pb-1 first:pt-0" style={{ color: '#5C3A21' }}>{item.section}</p>;
            if (item.isCheck) return navBtn(item.screen, item.label, '#FBBF24', '#2C1810');
            return navBtn(item.screen, item.label, '#5C3A21', 'white');
          })}
        </div>
        <div className="mt-4 pt-3 space-y-1.5" style={{ borderTop: '1px solid #d4c9a8' }}>
          {navBtn('start', 'Startscherm', '#B84A3D', 'white')}
          {navBtn('end', 'Eindscherm', '#B84A3D', 'white')}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// START & END SCREENS
// ═══════════════════════════════════════════════════════════════

function StartScreen({ onStart }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: '#F5EDD6' }}>
      <div className="text-center max-w-md" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4" style={{ background: 'rgba(251,191,36,0.2)' }}>
          <Thermometer size={40} style={{ color: '#5C3A21' }} />
        </div>
        <h1 className="text-4xl font-extrabold mb-1" style={{ color: '#2C1810' }}>OVH en NAK</h1>
        <h2 className="text-xl font-bold italic mb-4" style={{ color: '#5C3A21' }}>Oververhitting & Nakoeling</h2>
        <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <p className="italic leading-relaxed" style={{ color: '#5C3A21', lineHeight: 1.7 }}>
            Leer de vermogens uit een h-log p diagram aflezen, het rendement berekenen en de koelinstallatie beoordelen aan de hand van oververhitting en nakoeling.
          </p>
        </div>
        <button onClick={onStart}
          className="px-10 py-4 text-white rounded-2xl font-extrabold italic text-xl hover:brightness-90 active:scale-95 transition-all"
          style={{ background: '#6B8E3D', border: '3px solid #2C1810', boxShadow: '0 4px 0 #4a6b2a' }}>Start</button>
        <p className="text-xs mt-3" style={{ color: '#5C3A21', opacity: 0.7 }}>Tip: Ctrl+D voor snelmenu</p>
      </div>
    </div>
  );
}

function EndScreen({ score, onRestart }) {
  const stars = score >= 80 ? 3 : score >= 60 ? 2 : score >= 40 ? 1 : 0;
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-md text-center" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
        <div className="inline-flex items-center justify-center w-32 h-32 rounded-full mb-4 text-6xl"
          style={{ background: 'linear-gradient(135deg, #FBBF24, #06B6D4)', border: '4px solid #2C1810', boxShadow: '0 8px 24px rgba(251,191,36,0.4)' }}>&#127942;</div>
        <h2 className="text-3xl font-extrabold mb-2" style={{ color: '#2C1810' }}>Gefeliciteerd!</h2>
        <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div className="text-4xl mb-2">{[1, 2, 3].map(s => <span key={s} className="mx-1" style={{ color: s <= stars ? '#FBBF24' : '#ccc' }}>&#9733;</span>)}</div>
          <p className="text-2xl font-extrabold mb-1" style={{ color: '#2C1810' }}>{score} punten</p>
          <p className="text-sm italic" style={{ color: '#5C3A21' }}>{stars === 3 ? 'Uitstekend!' : stars === 2 ? 'Goed gedaan!' : stars === 1 ? 'Aardig werk!' : 'Blijf oefenen!'}</p>
        </div>
        <div className="rounded-2xl p-5 mb-6 text-left" style={{ background: 'rgba(107,142,61,0.1)', border: '2px solid #6B8E3D' }}>
          <p className="text-sm italic leading-relaxed" style={{ color: '#2C1810' }}>
            Je kunt nu de oververhitting en nakoeling aflezen uit het h-log p diagram en de vultoestand van een koelinstallatie beoordelen. Je weet wat een te hoge of te lage waarde betekent en welke acties nodig zijn. Dit zijn essentiële vaardigheden voor elke koeltechnicus!
          </p>
        </div>
        <button onClick={onRestart}
          className="px-10 py-4 text-white rounded-2xl font-extrabold italic text-lg hover:brightness-90 active:scale-95 flex items-center justify-center gap-2 mx-auto"
          style={{ background: '#5C3A21', border: '3px solid #2C1810', boxShadow: '0 4px 0 #3d2615' }}><RotateCcw size={18} /> Opnieuw spelen</button>
      </div>
    </div>
  );
}

function GameOverScreen({ score, onRestart }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F5EDD6' }}>
      <div className="max-w-md text-center" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
        <div className="flex justify-center gap-1 mb-4">{[1, 2, 3, 4, 5].map(i => <Heart key={i} className="w-8 h-8" fill="transparent" stroke="#ccc" style={{ opacity: 0.3 }} />)}</div>
        <h2 className="text-3xl font-extrabold mb-2" style={{ color: '#B84A3D' }}>Game Over</h2>
        <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: '2px solid #2C1810', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <p className="italic mb-2" style={{ color: '#5C3A21' }}>Je hebt geen levens meer.</p>
          <p className="text-lg font-bold" style={{ color: '#2C1810' }}>Score: {score}</p>
        </div>
        <button onClick={onRestart}
          className="px-10 py-4 text-white rounded-2xl font-extrabold italic text-lg hover:brightness-90 active:scale-95 flex items-center justify-center gap-2 mx-auto"
          style={{ background: '#5C3A21', border: '3px solid #2C1810', boxShadow: '0 4px 0 #3d2615' }}><RotateCcw size={18} /> Opnieuw proberen</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN GAME
// ═══════════════════════════════════════════════════════════════

export default function OververhittingNakoelingGame() {
  const [screen, setScreen] = useState('start');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [quizQuestions, setQuizQuestions] = useState(null);
  const [debugVisible, setDebugVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); setDebugVisible(v => !v); }
      if (e.key === 'Escape' && debugVisible) setDebugVisible(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [debugVisible]);

  useEffect(() => {
    if (screen.endsWith('_check') && ITEMBANKS[screen]) setQuizQuestions(prepareAllQuestions(ITEMBANKS[screen]));
  }, [screen]);

  useEffect(() => {
    const roundScreens = ['m1r1', 'm1r2', 'm1r3', 'm2r1', 'm2r2', 'm2r3'];
    if (roundScreens.includes(screen)) setLives(5);
  }, [screen]);

  const goToScreen = (s) => setScreen(s);
  const addScore = (pts) => setScore(prev => prev + pts);

  const loseLife = useCallback(() => {
    setLives(prev => {
      const newLives = Math.max(0, prev - 1);
      if (newLives === 0) setTimeout(() => setScreen('game_over'), 800);
      return newLives;
    });
  }, []);

  const handleRoundComplete = (nextScreen) => (pts) => { addScore(pts); goToScreen(nextScreen); };

  const handleRestart = () => { setScore(0); setLives(5); setQuizQuestions(null); goToScreen('start'); };

  const renderScreen = () => {
    switch (screen) {
      case 'start': return <StartScreen onStart={() => goToScreen('m1_intro')} />;
      case 'm1_intro': return <M1IntroScreen onBegin={() => goToScreen('m1r1')} />;
      case 'm1r1': return <PowerLabeler onComplete={handleRoundComplete('m1r1_check')} onLoseLife={loseLife} lives={lives} />;
      case 'm1r1_check': return quizQuestions ? <div className="min-h-screen p-4 pt-16" style={{ background: '#F5EDD6' }}><QuizCheck quizQs={quizQuestions} maxPoints={SCORING.m1r1_check} onComplete={handleRoundComplete('m1r2')} onLoseLife={loseLife} lives={lives} examFigure="exam" /></div> : null;
      case 'm1r2': return <EerCalculator onComplete={handleRoundComplete('m1r2_check')} onLoseLife={loseLife} lives={lives} />;
      case 'm1r2_check': return quizQuestions ? <div className="min-h-screen p-4 pt-16" style={{ background: '#F5EDD6' }}><QuizCheck quizQs={quizQuestions} maxPoints={SCORING.m1r2_check} onComplete={handleRoundComplete('m1r3')} onLoseLife={loseLife} lives={lives} showBootje={true} /></div> : null;
      case 'm1r3': return <CopCalculator onComplete={handleRoundComplete('m1r3_check')} onLoseLife={loseLife} lives={lives} />;
      case 'm1r3_check': return quizQuestions ? <div className="min-h-screen p-4 pt-16" style={{ background: '#F5EDD6' }}><QuizCheck quizQs={quizQuestions} maxPoints={SCORING.m1r3_check} onComplete={handleRoundComplete('m2_intro')} onLoseLife={loseLife} lives={lives} showBootje={true} /></div> : null;
      case 'm2_intro': return <M2IntroScreen onBegin={() => goToScreen('m2r1')} />;
      case 'm2r1': return <IdentifyOvhNak onComplete={handleRoundComplete('m2r1_check')} onLoseLife={loseLife} lives={lives} />;
      case 'm2r1_check': return quizQuestions ? <div className="min-h-screen p-4 pt-16" style={{ background: '#F5EDD6' }}><QuizCheck quizQs={quizQuestions} maxPoints={SCORING.m2r1_check} onComplete={handleRoundComplete('m2r2')} onLoseLife={loseLife} lives={lives} examFigure="exam" /></div> : null;
      case 'm2r2': return <TablesGame onComplete={handleRoundComplete('m2r2_check')} onLoseLife={loseLife} lives={lives} />;
      case 'm2r2_check': return quizQuestions ? <div className="min-h-screen p-4 pt-16" style={{ background: '#F5EDD6' }}><QuizCheck quizQs={quizQuestions} maxPoints={SCORING.m2r2_check} onComplete={handleRoundComplete('m2r3')} onLoseLife={loseLife} lives={lives} /></div> : null;
      case 'm2r3': return <MeasureAndAssess onComplete={handleRoundComplete('m2r3_check')} onLoseLife={loseLife} lives={lives} />;
      case 'm2r3_check': return quizQuestions ? <div className="min-h-screen p-4 pt-16" style={{ background: '#F5EDD6' }}><QuizCheck quizQs={quizQuestions} maxPoints={SCORING.m2r3_check} onComplete={handleRoundComplete('end')} onLoseLife={loseLife} lives={lives} /></div> : null;
      case 'end': return <EndScreen score={score} onRestart={handleRestart} />;
      case 'game_over': return <GameOverScreen score={score} onRestart={handleRestart} />;
      default: return <StartScreen onStart={() => goToScreen('m1_intro')} />;
    }
  };

  const showProgress = screen !== 'start' && screen !== 'end' && screen !== 'game_over';

  return (
    <div className="relative min-h-screen" style={{ background: '#F5EDD6' }}>
      {showProgress && <ProgressBar screen={screen} lives={lives} score={score} />}
      {renderScreen()}
      <DebugNav visible={debugVisible} currentScreen={screen} onNavigate={goToScreen} onClose={() => setDebugVisible(false)} />
    </div>
  );
}
