import { useEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Eye, Link as LinkIcon, MessageCircle, Wallet } from 'lucide-react'

const apiBase = window.location.port === '5173' ? 'http://127.0.0.1:8080' : ''

function formatMoney(minor, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 })
    .format((minor || 0) / 100)
}

function timeAgo(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)
  const targetRef = useRef(target)
  useEffect(() => {
    targetRef.current = target
    if (!target || target === 0) {
      setValue(0)
      return
    }
    let raf
    const start = performance.now()
    const initial = 0
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(initial + (targetRef.current - initial) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function StatCard({ label, value, currency, icon: Icon, accent }) {
  const animated = useCountUp(value || 0)
  return (
    <div className="ov-stat-card" style={{ '--stat-accent': accent }}>
      <span className="ov-stat-icon"><Icon size={20} /></span>
      <span className="ov-stat-label">{label}</span>
      <strong className="ov-stat-value">
        {currency ? formatMoney(animated, currency) : animated.toLocaleString('en-IN')}
      </strong>
    </div>
  )
}

function Skeleton({ width, height, className = '' }) {
  return <div className={`ov-skel ${className}`} style={{ width, height }} />
}

export default function Overview() {
  const [metrics, setMetrics] = useState({ messagesSent: 0, contacts: 0, automations: 0 })
  const [revenue, setRevenue] = useState({ totalMinor: 0, days: [] })
  const [messages, setMessages] = useState([])
  const [orders, setOrders] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState({ stats: true, feed: true, chart: true, orders: true })

  // Initial data
  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch(`${apiBase}/api/dashboard`).then((r) => r.json()),
      fetch(`${apiBase}/api/analytics/revenue?days=7`).then((r) => r.json()),
      fetch(`${apiBase}/api/orders`).then((r) => r.json()),
      fetch(`${apiBase}/api/profiles/me`).then((r) => r.json()).catch(() => ({})),
    ])
      .then(([dash, rev, ord, prof]) => {
        if (cancelled) return
        if (dash?.metrics) setMetrics(dash.metrics)
        if (rev?.days) {
          const totalMinor = rev.days.reduce((s, d) => s + (d.revenue || 0), 0)
          setRevenue({ totalMinor, days: rev.days })
        }
        if (Array.isArray(ord?.orders)) setOrders(ord.orders.slice(0, 5))
        if (prof?.profile) setProfile(prof.profile)
        setLoading((l) => ({ ...l, stats: false, chart: false, orders: false }))
      })
      .catch(() => setLoading((l) => ({ ...l, stats: false, chart: false, orders: false })))

    return () => { cancelled = true }
  }, [])

  // Polling messages every 15s
  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch(`${apiBase}/api/messages?limit=10`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          if (Array.isArray(data?.messages)) setMessages(data.messages)
          setLoading((l) => ({ ...l, feed: false }))
        })
        .catch(() => setLoading((l) => ({ ...l, feed: false })))
    }
    load()
    const id = window.setInterval(load, 15000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [])

  const chartData = revenue.days.map((d) => ({
    day: new Date(d.day).toLocaleDateString('en-IN', { weekday: 'short' }),
    revenue: (d.revenue || 0) / 100,
    orders: d.orders || 0,
  }))

  const clickTotal = profile?.view_count || 0

  return (
    <div className="ov-page">
      <header className="ov-head">
        <h2>Overview</h2>
        <p>Snapshot of your last 7 days.</p>
      </header>

      <section className="ov-stats">
        {loading.stats
          ? [1, 2, 3, 4].map((i) => <Skeleton key={i} height={108} className="ov-stat-skel" />)
          : (
            <>
              <StatCard
                label="DMs Received"
                value={metrics.messagesSent || metrics.contacts || 0}
                icon={MessageCircle}
                accent="var(--color-background-info, #2563eb)"
              />
              <StatCard
                label="Auto-Replied"
                value={metrics.messagesSent || 0}
                icon={MessageCircle}
                accent="var(--color-background-success, #16a34a)"
              />
              <StatCard
                label="Revenue (₹)"
                value={revenue.totalMinor || 0}
                currency="INR"
                icon={Wallet}
                accent="var(--color-background-warning, #f59e0b)"
              />
              <StatCard
                label="Link Clicks"
                value={clickTotal}
                icon={LinkIcon}
                accent="#ec4899"
              />
            </>
          )}
      </section>

      <div className="ov-grid">
        <section className="ov-card">
          <header>
            <h3><MessageCircle size={16} /> Live DM feed</h3>
            <span className="ov-pulse">LIVE</span>
          </header>
          {loading.feed
            ? [1, 2, 3, 4].map((i) => <Skeleton key={i} height={56} className="ov-msg-skel" />)
            : messages.length === 0
              ? <div className="ov-empty">No DMs yet. Real conversations will show up here.</div>
              : (
                <ul className="ov-msg-list">
                  {messages.map((m) => (
                    <li key={m.id} className="ov-msg-row">
                      <div className="ov-avatar">{(m.name || m.handle || m.instagram_user_id || 'IG').slice(0, 2).toUpperCase()}</div>
                      <div className="ov-msg-body">
                        <strong>{m.name || m.handle || `IG ${m.instagram_user_id?.slice(-6)}`}</strong>
                        <small>{m.body}</small>
                      </div>
                      <span className="ov-msg-time">{timeAgo(m.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
        </section>

        <section className="ov-card">
          <header>
            <h3><Wallet size={16} /> 7-day revenue</h3>
            <strong>{formatMoney(revenue.totalMinor, 'INR')}</strong>
          </header>
          {loading.chart
            ? <Skeleton height={220} className="ov-chart-skel" />
            : chartData.length === 0
              ? <div className="ov-empty">No paid orders yet. Your bars will appear once buyers pay.</div>
              : (
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15,23,42,0.06)" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 8px 24px rgba(15,23,42,0.1)' }}
                        formatter={(v) => [`₹${v}`, 'Revenue']}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="var(--color-background-info, #2563eb)"
                        radius={[8, 8, 0, 0]}
                        animationDuration={900}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
        </section>
      </div>

      <section className="ov-card">
        <header>
          <h3><Eye size={16} /> Recent orders</h3>
        </header>
        {loading.orders
          ? [1, 2, 3].map((i) => <Skeleton key={i} height={48} className="ov-msg-skel" />)
          : orders.length === 0
            ? <div className="ov-empty">No orders yet. Sell your first product to see them here.</div>
            : (
              <table className="ov-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.customer_email}</td>
                      <td>{formatMoney(o.amount, o.currency)}</td>
                      <td>
                        <span className={`ov-status ${o.status === 'paid' ? 'is-paid' : 'is-pending'}`}>
                          {o.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td>{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
      </section>
    </div>
  )
}
