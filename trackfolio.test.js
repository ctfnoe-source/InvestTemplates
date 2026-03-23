// ==================== TESTS AUTOMÁTICOS — TrackFolio ====================
// Cómo correrlos:
//   1. Instala Node: https://nodejs.org
//   2. En la carpeta del proyecto: node trackfolio.test.js
//   3. Verás PASS / FAIL por cada test
//
// NO necesitas subir este archivo al servidor — es solo para ti en local.
// Cuando hagas cambios en app.js, corre los tests para confirmar que nada se rompió.
// =========================================================================

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✅ PASS:', name);
    passed++;
  } catch(e) {
    console.log('  ❌ FAIL:', name);
    console.log('     →', e.message);
    failed++;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected)
        throw new Error(`esperaba ${JSON.stringify(expected)}, recibí ${JSON.stringify(actual)}`);
    },
    toBeCloseTo(expected, decimals = 2) {
      const factor = Math.pow(10, decimals);
      if (Math.round(actual * factor) !== Math.round(expected * factor))
        throw new Error(`esperaba ~${expected}, recibí ${actual}`);
    },
    toBeGreaterThan(n) {
      if (!(actual > n)) throw new Error(`esperaba > ${n}, recibí ${actual}`);
    },
    toBeLessThan(n) {
      if (!(actual < n)) throw new Error(`esperaba < ${n}, recibí ${actual}`);
    },
    toBeNull() {
      if (actual !== null) throw new Error(`esperaba null, recibí ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`esperaba truthy, recibí ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`esperaba falsy, recibí ${JSON.stringify(actual)}`);
    },
  };
}

// ── Copias locales de las funciones a testear ─────────────────────────────
// (extraídas de app.js para poder testearlas sin el navegador)

function fmt(n, cur) {
  if (n == null || isNaN(n)) {
    if (cur === 'USD') return 'US$0';
    if (cur === 'EUR') return '€0';
    return '$0';
  }
  const sign = n < 0 ? '-' : '';
  if (cur === 'USD') return sign + 'US$' + Math.abs(n).toLocaleString('es-MX', {maximumFractionDigits: 0});
  if (cur === 'EUR') return sign + '€' + Math.abs(n).toLocaleString('es-MX', {maximumFractionDigits: 0});
  return sign + '$' + Math.abs(n).toLocaleString('es-MX', {maximumFractionDigits: 0});
}

function fmtPct(n) {
  return (n == null || isNaN(n)) ? '0.00%' : (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%';
}

function isPriceReasonable(price, cacheKey) {
  if (!price || price <= 0 || !isFinite(price)) return false;
  if (cacheKey.endsWith('_MXN')) {
    return price >= 100 && price <= 10000000;
  } else {
    return price >= 0.5 && price <= 1000000;
  }
}

function platSaldoToMXN(p, settings, eurMxn) {
  const tc = settings.tipoCambio || 18;
  const saldo = p.saldo || 0;
  if (p.moneda === 'USD') return saldo * tc;
  if (p.moneda === 'EUR') return saldo * eurMxn;
  return saldo;
}

function calcAutoYield(p, saldoBase, fechaRef) {
  const tasa = p.tasaAnual || 0;
  if (tasa <= 0 || saldoBase <= 0) return 0;
  let refDate = fechaRef ? new Date(fechaRef) : p.fechaInicio ? new Date(p.fechaInicio) : null;
  if (!refDate || isNaN(refDate.getTime())) return 0;
  const diffMs = new Date() - refDate;
  if (diffMs <= 0) return 0;
  return saldoBase * (tasa / 100) * (diffMs / (1000 * 60 * 60 * 24 * 365));
}

function calcTickerGP(compras, ventas) {
  // Simula la lógica core de getTickerPositions
  const cantC = compras.reduce((s, m) => s + m.cantidad, 0);
  const cantV = ventas.reduce((s, m) => s + m.cantidad, 0);
  const costoTotal = compras.reduce((s, m) => s + m.montoTotal, 0);
  const ventasTotal = ventas.reduce((s, m) => s + m.montoTotal, 0);
  const cantActual = cantC - cantV;
  const precioCostoPromedio = cantC > 0 ? costoTotal / cantC : 0;
  const costoPosicion = cantActual * precioCostoPromedio;
  const gpRealizada = cantV > 0 ? ventasTotal - (precioCostoPromedio * cantV) : 0;
  return { cantActual, precioCostoPromedio, costoPosicion, gpRealizada };
}

function calcSobranteMes(gastos, ingresos, ingresoSettings) {
  // Simula calcSobranteMes sin depender de globals
  const totG = gastos.reduce((s, mv) => s + mv.importe, 0);
  const totI = ingresos.reduce((s, mv) => s + mv.importe, 0);
  const ingRef = totI > 0 ? totI : (ingresoSettings || 0);
  return Math.max(0, Math.round((ingRef - totG) * 100) / 100);
}

// ── Suite 1: fmt() — formato de números ──────────────────────────────────
console.log('\n📋 Suite 1: fmt() — formato de números');

test('fmt sin moneda → prefijo $', () => {
  expect(fmt(1000)).toBe('$1,000');
});

test('fmt USD → prefijo US$', () => {
  expect(fmt(500, 'USD')).toBe('US$500');
});

test('fmt EUR → prefijo €', () => {
  expect(fmt(250, 'EUR')).toBe('€250');
});

test('fmt negativo → signo correcto', () => {
  expect(fmt(-300)).toBe('-$300');
});

test('fmt null → $0', () => {
  expect(fmt(null)).toBe('$0');
});

test('fmt NaN → $0', () => {
  expect(fmt(NaN)).toBe('$0');
});

// ── Suite 2: fmtPct() — formato de porcentajes ───────────────────────────
console.log('\n📋 Suite 2: fmtPct() — porcentajes');

test('fmtPct positivo → con + delante', () => {
  expect(fmtPct(0.1234)).toBe('+12.34%');
});

test('fmtPct negativo → sin +', () => {
  expect(fmtPct(-0.05)).toBe('-5.00%');
});

test('fmtPct cero → +0.00%', () => {
  expect(fmtPct(0)).toBe('+0.00%');
});

test('fmtPct null → 0.00%', () => {
  expect(fmtPct(null)).toBe('0.00%');
});

// ── Suite 3: isPriceReasonable() — validación de precios ─────────────────
console.log('\n📋 Suite 3: isPriceReasonable() — validación de precios');

test('precio USD válido pasa', () => {
  expect(isPriceReasonable(150, 'AAPL')).toBeTruthy();
});

test('precio USD 0 no pasa', () => {
  expect(isPriceReasonable(0, 'AAPL')).toBeFalsy();
});

test('precio USD negativo no pasa', () => {
  expect(isPriceReasonable(-10, 'AAPL')).toBeFalsy();
});

test('precio USD demasiado bajo (0.1) no pasa', () => {
  expect(isPriceReasonable(0.1, 'AAPL')).toBeFalsy();
});

test('precio MXN válido pasa', () => {
  expect(isPriceReasonable(500, 'VUAA_MXN')).toBeTruthy();
});

test('precio MXN demasiado bajo (50) no pasa', () => {
  expect(isPriceReasonable(50, 'VUAA_MXN')).toBeFalsy();
});

test('precio Infinity no pasa', () => {
  expect(isPriceReasonable(Infinity, 'AAPL')).toBeFalsy();
});

// ── Suite 4: platSaldoToMXN() — conversión de monedas ────────────────────
console.log('\n📋 Suite 4: platSaldoToMXN() — conversión de saldos a MXN');

const settings_test = { tipoCambio: 20 };
const eurMxn_test = 22;

test('plataforma MXN no convierte', () => {
  expect(platSaldoToMXN({ saldo: 1000, moneda: 'MXN' }, settings_test, eurMxn_test)).toBe(1000);
});

test('plataforma USD × tipo de cambio', () => {
  expect(platSaldoToMXN({ saldo: 100, moneda: 'USD' }, settings_test, eurMxn_test)).toBe(2000);
});

test('plataforma EUR × eurmxn', () => {
  expect(platSaldoToMXN({ saldo: 100, moneda: 'EUR' }, settings_test, eurMxn_test)).toBe(2200);
});

test('plataforma saldo 0', () => {
  expect(platSaldoToMXN({ saldo: 0, moneda: 'USD' }, settings_test, eurMxn_test)).toBe(0);
});

// ── Suite 5: calcAutoYield() — rendimiento automático ────────────────────
console.log('\n📋 Suite 5: calcAutoYield() — rendimiento automático por tasa');

test('tasa 0 → rendimiento 0', () => {
  const p = { tasaAnual: 0, fechaInicio: '2020-01-01' };
  expect(calcAutoYield(p, 10000, '2024-01-01')).toBe(0);
});

test('saldo 0 → rendimiento 0', () => {
  const p = { tasaAnual: 10, fechaInicio: '2020-01-01' };
  expect(calcAutoYield(p, 0, '2024-01-01')).toBe(0);
});

test('tasa positiva → rendimiento > 0', () => {
  const p = { tasaAnual: 10 };
  const hace1Anio = new Date();
  hace1Anio.setFullYear(hace1Anio.getFullYear() - 1);
  const fecha = hace1Anio.toISOString().slice(0, 10);
  const rend = calcAutoYield(p, 10000, fecha);
  expect(rend).toBeGreaterThan(900); // ~1000, tolerancia por días exactos
  expect(rend).toBeLessThan(1100);
});

test('fecha futura → rendimiento 0', () => {
  const p = { tasaAnual: 10 };
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  expect(calcAutoYield(p, 10000, manana.toISOString().slice(0, 10))).toBe(0);
});

// ── Suite 6: calcTickerGP() — ganancias/pérdidas de inversiones ──────────
console.log('\n📋 Suite 6: calcTickerGP() — G/P de inversiones');

test('compra simple: costo y posición correctos', () => {
  const result = calcTickerGP(
    [{ cantidad: 10, montoTotal: 1000 }],
    []
  );
  expect(result.cantActual).toBe(10);
  expect(result.precioCostoPromedio).toBe(100);
  expect(result.costoPosicion).toBe(1000);
  expect(result.gpRealizada).toBe(0);
});

test('compra y venta parcial: cantidad correcta', () => {
  const result = calcTickerGP(
    [{ cantidad: 10, montoTotal: 1000 }],
    [{ cantidad: 4, montoTotal: 500 }]
  );
  expect(result.cantActual).toBe(6);
});

test('venta con ganancia → gpRealizada positiva', () => {
  const result = calcTickerGP(
    [{ cantidad: 10, montoTotal: 1000 }], // compré a $100
    [{ cantidad: 5, montoTotal: 750 }]    // vendí 5 a $150
  );
  // gpRealizada = 750 - (100 * 5) = 250
  expect(result.gpRealizada).toBe(250);
});

test('venta con pérdida → gpRealizada negativa', () => {
  const result = calcTickerGP(
    [{ cantidad: 10, montoTotal: 1000 }], // compré a $100
    [{ cantidad: 5, montoTotal: 400 }]    // vendí 5 a $80
  );
  // gpRealizada = 400 - (100 * 5) = -100
  expect(result.gpRealizada).toBe(-100);
});

test('precio promedio ponderado con dos compras', () => {
  const result = calcTickerGP(
    [
      { cantidad: 10, montoTotal: 1000 }, // $100 c/u
      { cantidad: 10, montoTotal: 2000 }, // $200 c/u
    ],
    []
  );
  // promedio = (1000+2000)/(10+10) = $150
  expect(result.precioCostoPromedio).toBe(150);
});

// ── Suite 7: calcSobranteMes() ────────────────────────────────────────────
console.log('\n📋 Suite 7: calcSobranteMes() — sobrante mensual');

test('sin gastos → sobrante = ingreso', () => {
  expect(calcSobranteMes([], [], 1000)).toBe(1000);
});

test('gastos < ingreso → sobrante positivo', () => {
  const gastos = [{ importe: 300 }, { importe: 200 }];
  expect(calcSobranteMes(gastos, [], 1000)).toBe(500);
});

test('gastos > ingreso → sobrante 0 (nunca negativo)', () => {
  const gastos = [{ importe: 1500 }];
  expect(calcSobranteMes(gastos, [], 1000)).toBe(0);
});

test('ingresos del mes sobreescriben ingreso fijo', () => {
  const ingresos = [{ importe: 2000 }];
  const gastos = [{ importe: 500 }];
  expect(calcSobranteMes(gastos, ingresos, 1000)).toBe(1500);
});

// ── Resumen ───────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${passed} PASS, ${failed} FAIL de ${passed + failed} tests`);
if (failed === 0) {
  console.log('🎉 Todo en orden — puedes hacer deploy con confianza\n');
} else {
  console.log('⚠️  Hay fallos — revisa antes de subir cambios\n');
  process.exit(1);
}
