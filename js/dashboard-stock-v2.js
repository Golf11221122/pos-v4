import { supabase } from './supabase.js'
import { requireBackoffice, setupShell, money, number } from './auth.js'

const $ = id => document.getElementById(id)

function setText(id, value) {
  const el = $(id)
  if (el) el.textContent = value
}

function clampPct(value) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

function attentionState({ critical = 0, warning = 0 }) {
  if (Number(critical) > 0) return 'is-danger'
  if (Number(warning) > 0) return 'is-warning'
  return 'is-ok'
}

function renderAttention(r) {
  const alertTotal = Number(r?.low_stock_count || 0) + Number(r?.out_stock_count || 0)
  const alertCard = $('jkAlertSummary')?.closest('.jk-attention-card')
  const poCard = $('jkPoSummary')?.closest('.jk-attention-card')
  const countCard = $('jkCountSummary')?.closest('.jk-attention-card')

  if ($('jkAlertSummary')) {
    $('jkAlertSummary').textContent = alertTotal > 0
      ? `${number(alertTotal, 0)} รายการต้องตรวจสอบ`
      : 'Stock อยู่ในเกณฑ์ปกติ'
  }
  if ($('jkPoSummary')) {
    $('jkPoSummary').textContent = Number(r?.open_po_count || 0) > 0
      ? `${number(r?.open_po_count, 0)} PO ยังเปิดอยู่`
      : 'ไม่มี PO ค้าง'
  }
  if ($('jkCountSummary')) {
    $('jkCountSummary').textContent = Number(r?.pending_count_count || 0) > 0
      ? `${number(r?.pending_count_count, 0)} งานรอตรวจนับ`
      : 'ไม่มีงานตรวจนับค้าง'
  }

  alertCard?.classList.remove('is-ok', 'is-warning', 'is-danger')
  poCard?.classList.remove('is-ok', 'is-warning', 'is-danger')
  countCard?.classList.remove('is-ok', 'is-warning', 'is-danger')

  alertCard?.classList.add(attentionState({ critical: r?.out_stock_count, warning: r?.low_stock_count }))
  poCard?.classList.add(attentionState({ critical: Number(r?.open_po_count || 0) >= 5 ? 1 : 0, warning: Number(r?.open_po_count || 0) > 0 ? 1 : 0 }))
  countCard?.classList.add(attentionState({ critical: Number(r?.pending_count_count || 0) >= 3 ? 1 : 0, warning: Number(r?.pending_count_count || 0) > 0 ? 1 : 0 }))
}

function renderStockHealth(r) {
  const host = $('stockHealthBars')
  if (!host) return

  const ingredientCount = Number(r?.ingredient_count || 0)
  const outCount = Number(r?.out_stock_count || 0)
  const lowCount = Number(r?.low_stock_count || 0)
  const healthyCount = Math.max(ingredientCount - outCount - lowCount, 0)

  const items = [
    { key: 'good', label: 'พร้อมใช้', value: healthyCount, pct: ingredientCount ? (healthyCount / ingredientCount) * 100 : 0, tone: 'good', footer: ingredientCount ? `${healthyCount}/${ingredientCount} รายการ` : 'ยังไม่มีข้อมูล' },
    { key: 'warn', label: 'ใกล้หมด', value: lowCount, pct: ingredientCount ? (lowCount / ingredientCount) * 100 : 0, tone: 'warn', footer: lowCount > 0 ? 'ควรวางแผนสั่งซื้อ' : 'ไม่มีรายการเตือน' },
    { key: 'bad', label: 'หมดสต็อก', value: outCount, pct: ingredientCount ? (outCount / ingredientCount) * 100 : 0, tone: 'bad', footer: outCount > 0 ? 'ต้องแก้ไขเร่งด่วน' : 'ไม่มีวัตถุดิบขาด' }
  ]

  host.innerHTML = items.map(item => {
    const pct = clampPct(item.pct)
    return `
      <article class="chart-bar-card">
        <header>
          <span>${item.label}</span>
          <strong>${number(item.value, 0)}</strong>
        </header>
        <div class="chart-bar-wrap">
          <div class="chart-bar-meter">
            <div class="chart-bar-fill ${item.tone}" style="height:${Math.max(pct, item.value > 0 ? 6 : 0)}%"></div>
          </div>
        </div>
        <div class="chart-bar-footer">
          <span>${number(pct, 0)}%</span>
          <b>${item.footer}</b>
        </div>
      </article>
    `
  }).join('')
}

function renderInsights(r) {
  const host = $('opsInsights')
  if (!host) return

  const alertTotal = Number(r?.low_stock_count || 0) + Number(r?.out_stock_count || 0)
  const openPo = Number(r?.open_po_count || 0)
  const pendingCount = Number(r?.pending_count_count || 0)
  const wasteValue = Number(r?.month_waste_value || 0)
  const stockValue = Number(r?.stock_value || 0)
  const wastePct = stockValue > 0 ? (wasteValue / stockValue) * 100 : 0
  const purchaseValue = Number(r?.month_purchase_value || 0)
  const purchaseRatio = stockValue > 0 ? (purchaseValue / stockValue) * 100 : 0

  const insights = [
    { icon: '🚨', title: 'Stock Alerts', copy: alertTotal > 0 ? 'มีวัตถุดิบที่ต้องเช็กทันที' : 'ไม่มี Alert สำคัญในรอบนี้', value: alertTotal > 0 ? `${number(alertTotal, 0)} รายการ` : 'พร้อมขาย', tone: alertTotal > 0 ? (Number(r?.out_stock_count || 0) > 0 ? 'bad' : 'warn') : 'good' },
    { icon: '🛒', title: 'Open Purchase Orders', copy: 'ติดตามการสั่งซื้อและรับของเข้า', value: `${number(openPo, 0)} PO`, tone: openPo >= 5 ? 'bad' : openPo > 0 ? 'warn' : 'good' },
    { icon: '🧮', title: 'Pending Count Tasks', copy: 'งานตรวจนับที่ยังรอปิดรอบ', value: `${number(pendingCount, 0)} งาน`, tone: pendingCount >= 3 ? 'bad' : pendingCount > 0 ? 'warn' : 'good' },
    { icon: '♻️', title: 'Waste vs Stock Value', copy: `ของเสียเดือนนี้ ${money(wasteValue)}`, value: `${number(wastePct, 1)}%`, tone: wastePct >= 5 ? 'bad' : wastePct >= 2 ? 'warn' : 'good' },
    { icon: '💸', title: 'Monthly Purchase Load', copy: `ยอดซื้อเดือนนี้ ${money(purchaseValue)}`, value: `${number(purchaseRatio, 1)}%`, tone: purchaseRatio >= 90 ? 'warn' : 'good' }
  ]

  host.innerHTML = insights.map(item => `
    <article class="insight-card">
      <div class="insight-icon">${item.icon}</div>
      <div class="insight-copy">
        <strong>${item.title}</strong>
        <small>${item.copy}</small>
        <div class="mini-chart-track"><div class="mini-chart-fill" style="width:${Math.min(Math.max(item.tone === 'bad' ? 95 : item.tone === 'warn' ? 62 : 28, 16), 100)}%"></div></div>
      </div>
      <div class="insight-value ${item.tone}">${item.value}</div>
    </article>
  `).join('')
}

async function load() {
  const message = $('message')
  if (message) message.textContent = ''

  try {
    const { data, error } = await supabase.rpc('backoffice_stock_dashboard_v2')
    if (error) throw error
    const r = Array.isArray(data) ? data[0] : (data || {})

    setText('stockValue', money(r?.stock_value))
    setText('ingredientText', `${number(r?.ingredient_count, 0)} วัตถุดิบ`)
    setText('alerts', number(Number(r?.low_stock_count || 0) + Number(r?.out_stock_count || 0), 0))
    setText('openPo', number(r?.open_po_count, 0))
    setText('purchaseMonth', `ซื้อเดือนนี้ ${money(r?.month_purchase_value)}`)
    setText('waste', money(r?.month_waste_value))
    setText('pendingCount', `Stock Count ค้าง ${number(r?.pending_count_count, 0)}`)

    renderAttention(r)
    renderStockHealth(r)
    renderInsights(r)
  } catch (error) {
    console.error('dashboard load failed', error)
    if (message) message.textContent = error?.message || 'โหลด Dashboard ไม่สำเร็จ'

    const bars = $('stockHealthBars')
    const insights = $('opsInsights')
    if (bars) bars.innerHTML = '<div class="empty">โหลดกราฟไม่สำเร็จ</div>'
    if (insights) insights.innerHTML = '<div class="empty">โหลดข้อมูลไม่สำเร็จ</div>'
  }
}

async function init() {
  try {
    const ctx = await requireBackoffice()
    if (!ctx) return
    setupShell(ctx, 'dashboard')
    await load()
  } catch (error) {
    console.error('dashboard init failed', error)
    const message = $('message')
    if (message) message.textContent = error?.message || 'เปิดหน้า Dashboard ไม่สำเร็จ'
  }
}

document.getElementById('refreshBtn')?.addEventListener('click', load)
init()
