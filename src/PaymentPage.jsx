import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, Check, ChevronDown, Copy, Eye, Lock, Mail, RefreshCw,
  ShieldCheck, Sparkles, Star, Zap,
} from 'lucide-react'
import {
  AboutMeSection, FaqSection, GallerySection, ShowcaseSection, TestimonialsSection,
} from './PublicSections.jsx'
import './App.css'

const apiBase = window.location.port === '5173' ? 'http://127.0.0.1:8080' : ''
const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'

const THEME_PRESETS = {
  aurora: { name: 'Aurora', accent: '#7c3aed', accent2: '#06b6d4' },
  sunset: { name: 'Sunset', accent: '#f97316', accent2: '#ec4899' },
  mint: { name: 'Mint', accent: '#10b981', accent2: '#14b8a6' },
  royal: { name: 'Royal', accent: '#1e3a8a', accent2: '#f59e0b' },
  mono: { name: 'Mono', accent: '#0f172a', accent2: '#64748b' },
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const script = document.createElement('script')
    script.src = RAZORPAY_SCRIPT
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

function formatMoney(minor, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format((minor || 0) / 100)
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
  }
  return []
}

function asObject(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback } catch { return fallback }
  }
  return fallback
}

export default function PaymentPage() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [product, setProduct] = useState(null)
  const [status, setStatus] = useState('loading')
  const [config, setConfig] = useState({ razorpay: { configured: false } })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedPrice, setSelectedPrice] = useState(null)
  const [customPrice, setCustomPrice] = useState('')
  const [otherActive, setOtherActive] = useState(false)
  const [customAnswers, setCustomAnswers] = useState({})

  const paid = searchParams.get('paid') === '1'

  const showToast = useCallback((message, kind = 'info') => {
    setToast({ message, kind })
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`${apiBase}/api/public/products/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (res.status === 404) throw new Error('not_found')
        const data = await res.json()
        if (!data.ok) throw new Error(data.message || 'load_failed')
        return data.product
      })
      .then((p) => {
        if (cancelled) return
        setProduct(p)
        setStatus('ready')
        setSelectedPrice(p.pricing_mode === 'fixed' ? p.price : (p.suggested_price || p.price))
        fetch(`${apiBase}/api/public/products/${encodeURIComponent(slug)}/view`, { method: 'POST' }).catch(() => {})
      })
      .catch((error) => {
        if (cancelled) return
        setStatus(error.message === 'not_found' ? 'not_found' : 'error')
      })

    fetch(`${apiBase}/api/public/config`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setConfig(data) })
      .catch(() => {})

    return () => { cancelled = true }
  }, [slug])

  const sections = useMemo(() => asObject(product?.sections, {}), [product])
  const gallery = useMemo(() => asArray(product?.gallery), [product])
  const testimonials = useMemo(() => asArray(product?.testimonials), [product])
  const faq = useMemo(() => asArray(product?.faq), [product])
  const showcaseIds = useMemo(() => asArray(product?.showcase_product_ids), [product])
  const customQuestions = useMemo(() => asArray(product?.custom_questions), [product])
  const [showcaseProducts, setShowcaseProducts] = useState([])

  useEffect(() => {
    if (!showcaseIds.length) { setShowcaseProducts([]); return }
    fetch(`${apiBase}/api/products`)
      .then((res) => res.json())
      .then((data) => {
        const all = data.products || []
        setShowcaseProducts(all.filter((p) => showcaseIds.includes(p.id)))
      })
      .catch(() => setShowcaseProducts([]))
  }, [showcaseIds])

  const suggestedPills = useMemo(() => {
    if (!product || product.pricing_mode === 'fixed') return []
    const base = product.price || 0
    const suggested = product.suggested_price || base * 2
    return [base, Math.round(base * 1.75), suggested, Math.round(suggested * 1.7)]
  }, [product])

  const chargeMinor = product?.pricing_mode === 'fixed'
    ? (product?.price || 0)
    : (otherActive ? Math.round(Number(customPrice) * 100) || 0 : selectedPrice || 0)

  const themePreset = product?.theme_preset || 'aurora'
  const preset = THEME_PRESETS[themePreset] || THEME_PRESETS.aurora
  const accent = product?.accent_color && product.accent_color !== '#F5C518' ? product.accent_color : preset.accent
  const accent2 = preset.accent2

  const handlePay = async () => {
    if (!email.trim()) return showToast('Please enter your email.', 'error')
    if (product?.pricing_mode !== 'fixed' && chargeMinor < (product?.price || 0)) {
      return showToast(`Minimum price is ${formatMoney(product.price, product.currency)}.`, 'error')
    }
    for (const q of customQuestions) {
      if (q.required && !customAnswers[q.label]?.trim()) {
        return showToast(`Please answer: ${q.label}`, 'error')
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${apiBase}/api/public/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, email: email.trim(), phone: phone.trim(),
          price: chargeMinor / 100, customAnswers,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        showToast(data.message || 'Payments coming soon.', 'error')
        setSubmitting(false)
        return
      }

      const loaded = await loadRazorpayScript()
      if (!loaded || !window.Razorpay) {
        showToast('Razorpay failed to load. Check your network.', 'error')
        setSubmitting(false)
        return
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.razorpayOrderId,
        name: data.productName,
        description: product.name,
        prefill: { email: email.trim(), contact: phone.trim() },
        theme: { color: accent },
        handler: async (response) => {
          const verify = await fetch(`${apiBase}/api/public/orders/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          })
          const verifyData = await verify.json()
          if (verifyData.ok) setSearchParams({ paid: '1' })
          else showToast(verifyData.message || 'Payment verification failed.', 'error')
          setSubmitting(false)
        },
        modal: { ondismiss: () => setSubmitting(false) },
      })
      rzp.open()
    } catch (error) {
      showToast(error.message || 'Something went wrong.', 'error')
      setSubmitting(false)
    }
  }

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href.split('?')[0])
      showToast('Link copied to clipboard.')
    } catch {
      window.prompt('Copy this link:', window.location.href.split('?')[0])
    }
  }

  useEffect(() => {
    if (!product?.meta_pixel_id) return
    const id = product.meta_pixel_id.trim()
    if (!id || window.fbq) return
    const script = document.createElement('script')
    script.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${id}'); fbq('track', 'PageView');`
    document.head.appendChild(script)
  }, [product?.meta_pixel_id])

  useEffect(() => {
    if (!product?.ga_tracking_id) return
    const id = product.ga_tracking_id.trim()
    if (!id) return
    const tag = document.createElement('script')
    tag.async = true
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
    document.head.appendChild(tag)
    const inline = document.createElement('script')
    inline.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js', new Date());gtag('config', '${id}');`
    document.head.appendChild(inline)
  }, [product?.ga_tracking_id])

  if (status === 'loading') return <PaymentPageSkeleton />
  if (status === 'not_found') {
    return (
      <div className="px-page px-empty">
        <h2>This page is not available.</h2>
        <p>The creator may have unpublished it or the link is incorrect.</p>
        <a className="px-link" href="/">Back to home →</a>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="px-page px-empty">
        <h2>Something went wrong.</h2>
        <p>Try refreshing in a moment.</p>
      </div>
    )
  }

  if (paid) {
    return (
      <div className={`px-page px-thanks theme-${themePreset}`} style={{ '--accent': accent, '--accent2': accent2 }}>
        <div className="px-bg-orb px-bg-orb-1" />
        <div className="px-bg-orb px-bg-orb-2" />
        <div className="px-thanks-card">
          <div className="px-thanks-badge"><Check size={36} /></div>
          <h1>Payment confirmed</h1>
          <p>A receipt has been sent to <strong>{email || 'your email'}</strong>.</p>
          {product.resource_link && (
            <a className="px-cta" href={product.resource_link} target="_blank" rel="noopener noreferrer" style={{ background: accent }}>
              Access your product <ArrowRight size={18} />
            </a>
          )}
          <button className="px-ghost" type="button" onClick={() => setSearchParams({})}>
            Back to page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`px-page theme-${themePreset}`}
      style={{ '--accent': accent, '--accent2': accent2 }}
    >
      <div className="px-bg-orb px-bg-orb-1" />
      <div className="px-bg-orb px-bg-orb-2" />
      <div className="px-bg-orb px-bg-orb-3" />

      {toast && (
        <div className={`px-toast ${toast.kind === 'error' ? 'is-error' : ''}`} role="status">
          {toast.message}
        </div>
      )}

      <div className="px-shell">
        <div className="px-main">
          <div className="px-creator">
            <span className="px-avatar">{(product.seller_name || product.name).slice(0, 2).toUpperCase()}</span>
            <div>
              <small>Made by</small>
              <strong>{product.seller_name || 'InvoxAI Creator'}</strong>
            </div>
            <div className="px-creator-stats">
              <span title="Page views"><Eye size={13} /> {product.view_count || 0}</span>
            </div>
          </div>

          <h1 className="px-title">{product.name}</h1>

          <div className="px-trust">
            <span><ShieldCheck size={14} /> Secure checkout</span>
            <span><Zap size={14} /> Instant delivery</span>
            <span><Lock size={14} /> 256-bit SSL</span>
          </div>

          {product.cover_image && (
            <div className="px-cover">
              {product.cover_image.match(/\.(mp4|webm|ogg)$/i)
                ? <video src={product.cover_image} controls />
                : <img src={product.cover_image} alt={product.name} />}
            </div>
          )}

          {product.description && (
            <section className="px-block px-reveal">
              <h3 className="px-h3">About this product</h3>
              <div className="px-prose" style={{ whiteSpace: 'pre-wrap' }}>{product.description}</div>
            </section>
          )}

          {sections.gallery && <div className="px-reveal"><GallerySection items={gallery} /></div>}
          {sections.testimonials && <div className="px-reveal"><TestimonialsSection items={testimonials} /></div>}
          {sections.faq && <div className="px-reveal"><FaqSection items={faq} /></div>}
          {sections.aboutMe && <div className="px-reveal"><AboutMeSection text={product.about_me} /></div>}
          {sections.showcase && <div className="px-reveal"><ShowcaseSection items={showcaseProducts} accent={accent} /></div>}

          {(product.terms_text || product.refund_text || product.privacy_text) && (
            <section className="px-block">
              {product.terms_text && (
                <details className="px-policy"><summary>Terms and conditions <ChevronDown size={14} /></summary><p>{product.terms_text}</p></details>
              )}
              {product.refund_text && (
                <details className="px-policy"><summary>Refund policy <ChevronDown size={14} /></summary><p>{product.refund_text}</p></details>
              )}
              {product.privacy_text && (
                <details className="px-policy"><summary>Privacy policy <ChevronDown size={14} /></summary><p>{product.privacy_text}</p></details>
              )}
            </section>
          )}

          <footer className="px-foot">
            <strong><Sparkles size={14} /> Built on InvoxAI</strong>
            <span>Want a page like this? <a href="/">Get started →</a></span>
          </footer>
        </div>

        <aside className="px-checkout" aria-label="Checkout">
          <div className="px-card">
            <div className="px-card-head">
              <span><Star size={14} fill="currentColor" /> Premium product</span>
              <strong className="px-price-big">{formatMoney(chargeMinor, product.currency)}</strong>
            </div>

            <label className="px-field">
              <span>Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
              <small>Your receipt + product link goes here</small>
            </label>

            {product.pricing_mode !== 'fixed' && (
              <div className="px-field">
                <span>Choose your price</span>
                <div className="px-pills">
                  {suggestedPills.map((priceMinor, index) => {
                    const isPopular = index === 2
                    const isSelected = !otherActive && selectedPrice === priceMinor
                    return (
                      <button
                        key={`${priceMinor}-${index}`}
                        type="button"
                        className={`px-pill ${isPopular ? 'is-popular' : ''} ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => { setSelectedPrice(priceMinor); setOtherActive(false) }}
                      >
                        {isPopular && <em>Popular</em>}
                        {formatMoney(priceMinor, product.currency)}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    className={`px-pill ${otherActive ? 'is-selected' : ''}`}
                    onClick={() => setOtherActive(true)}
                  >
                    Other
                  </button>
                </div>
                {otherActive && (
                  <div className="px-money-row">
                    <b>{product.currency || 'INR'}</b>
                    <input
                      type="number"
                      min={(product.price || 0) / 100}
                      step="0.01"
                      value={customPrice}
                      placeholder={`Min ${(product.price || 0) / 100}`}
                      onChange={(event) => setCustomPrice(event.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            <label className="px-field">
              <span>Phone</span>
              <div className="px-money-row">
                <b>+91</b>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                />
              </div>
            </label>

            {customQuestions.map((q, index) => (
              <label className="px-field" key={`${q.label}-${index}`}>
                <span>{q.label}{q.required && <em className="px-required"> *</em>}</span>
                <input
                  type="text"
                  value={customAnswers[q.label] || ''}
                  onChange={(event) => setCustomAnswers((current) => ({ ...current, [q.label]: event.target.value }))}
                />
              </label>
            ))}

            <div className="px-divider" />
            <div className="px-total">
              <div><span>Subtotal</span><strong>{formatMoney(chargeMinor, product.currency)}</strong></div>
              <div className="px-total-big"><b>You pay</b><strong>{formatMoney(chargeMinor, product.currency)}</strong></div>
            </div>

            <button
              className="px-cta"
              style={{ background: accent }}
              type="button"
              onClick={handlePay}
              disabled={submitting}
            >
              {submitting ? <><RefreshCw size={18} className="px-spin" /> Processing…</>
                          : <>{product.button_text || 'Make Payment'} <ArrowRight size={18} /></>}
            </button>

            {!config.razorpay?.configured && (
              <p className="px-note"><Sparkles size={13} /> Payments will go live shortly — the seller is finalizing setup.</p>
            )}

            <div className="px-share">
              <button className="px-ghost-small" type="button" onClick={copyShareLink}>
                <Copy size={14} /> Share
              </button>
              <span className="px-share-trust"><ShieldCheck size={13} /> Powered by Razorpay</span>
            </div>
          </div>
        </aside>

        <button
          className="px-mobile-cta"
          type="button"
          style={{ background: accent }}
          onClick={() => setCheckoutOpen(true)}
        >
          <strong>{formatMoney(chargeMinor, product.currency)}</strong>
          <span>{product.button_text || 'Make Payment'} <ArrowRight size={16} /></span>
        </button>

        {checkoutOpen && (
          <div className="px-sheet-backdrop" onClick={() => setCheckoutOpen(false)}>
            <div className="px-sheet" onClick={(event) => event.stopPropagation()}>
              <button className="px-sheet-close" type="button" onClick={() => setCheckoutOpen(false)} aria-label="Close">×</button>
              <h3>Checkout</h3>
              <p className="px-sheet-hint">Same checkout as on desktop. Fill in your details above.</p>
              <button
                className="px-cta"
                style={{ background: accent }}
                type="button"
                onClick={() => { setCheckoutOpen(false); handlePay() }}
                disabled={submitting}
              >
                {product.button_text || 'Make Payment'} <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PaymentPageSkeleton() {
  return (
    <div className="px-page theme-aurora">
      <div className="px-bg-orb px-bg-orb-1" />
      <div className="px-bg-orb px-bg-orb-2" />
      <div className="px-shell">
        <div className="px-main">
          <div className="px-skel" style={{ height: 24, width: 180 }} />
          <div className="px-skel" style={{ height: 40, width: '70%', marginTop: 12 }} />
          <div className="px-skel" style={{ height: 280, marginTop: 24, borderRadius: 16 }} />
          <div className="px-skel" style={{ height: 18, width: '100%', marginTop: 24 }} />
          <div className="px-skel" style={{ height: 18, width: '85%', marginTop: 8 }} />
          <div className="px-skel" style={{ height: 18, width: '60%', marginTop: 8 }} />
        </div>
        <aside className="px-checkout">
          <div className="px-card">
            <div className="px-skel" style={{ height: 32, width: 120 }} />
            <div className="px-skel" style={{ height: 44, marginTop: 16 }} />
            <div className="px-skel" style={{ height: 44, marginTop: 12 }} />
            <div className="px-skel" style={{ height: 52, marginTop: 24, borderRadius: 12 }} />
          </div>
        </aside>
      </div>
    </div>
  )
}
