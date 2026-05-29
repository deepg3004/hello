import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown, Copy, Mail, Sparkles } from 'lucide-react'
import {
  AboutMeSection,
  FaqSection,
  GallerySection,
  ShowcaseSection,
  TestimonialsSection,
} from './PublicSections.jsx'
import './App.css'

const apiBase = window.location.port === '5173' ? 'http://127.0.0.1:8080' : ''
const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
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
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format((minor || 0) / 100)
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function asObject(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

export default function PaymentPage() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [product, setProduct] = useState(null)
  const [status, setStatus] = useState('loading')
  const [config, setConfig] = useState({ configured: false, keyId: '' })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [policyOpen, setPolicyOpen] = useState({ refund: false, privacy: false })

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
      })
      .catch((error) => {
        if (cancelled) return
        setStatus(error.message === 'not_found' ? 'not_found' : 'error')
      })

    fetch(`${apiBase}/api/public/config`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setConfig(data.razorpay || { configured: false }) })
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
    if (!showcaseIds.length) {
      setShowcaseProducts([])
      return
    }
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

  const accent = product?.accent_color || '#F5C518'
  const theme = product?.theme || 'Dawn'

  const handlePay = async () => {
    if (!email.trim()) {
      showToast('Please enter your email.', 'error')
      return
    }
    if (product?.pricing_mode !== 'fixed' && chargeMinor < (product?.price || 0)) {
      showToast(`Minimum price is ${formatMoney(product.price, product.currency)}.`, 'error')
      return
    }
    for (const q of customQuestions) {
      if (q.required && !customAnswers[q.label]?.trim()) {
        showToast(`Please answer: ${q.label}`, 'error')
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${apiBase}/api/public/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          email: email.trim(),
          phone: phone.trim(),
          price: chargeMinor / 100,
          customAnswers,
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
          if (verifyData.ok) {
            setSearchParams({ paid: '1' })
          } else {
            showToast(verifyData.message || 'Payment verification failed.', 'error')
          }
          setSubmitting(false)
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
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
    script.innerHTML = `
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${id}'); fbq('track', 'PageView');
    `
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

  if (status === 'loading') {
    return <div className="public-empty"><Sparkles size={24} /><p>Loading…</p></div>
  }
  if (status === 'not_found') {
    return (
      <div className="public-empty">
        <h2>This page is not available.</h2>
        <p>The creator may have unpublished it or the link is incorrect.</p>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="public-empty">
        <h2>Something went wrong.</h2>
        <p>Try refreshing in a moment.</p>
      </div>
    )
  }

  if (paid) {
    return (
      <div className="public-thankyou" style={{ '--accent': accent }}>
        <div className="public-thankyou-card">
          <span className="check-badge"><Check size={32} /></span>
          <h2>Thank you for your purchase!</h2>
          <p>A receipt has been sent to <strong>{email || 'your email'}</strong>.</p>
          {product.resource_link && (
            <a className="primary" href={product.resource_link} target="_blank" rel="noopener noreferrer">
              Access your product <ArrowRight size={18} />
            </a>
          )}
          <button className="secondary" type="button" onClick={() => setSearchParams({})}>
            Back to page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`public-page theme-${theme.toLowerCase()}`} style={{ '--accent': accent }}>
      {toast && (
        <div className={`toast ${toast.kind === 'error' ? 'error' : ''}`} role="status">
          {toast.message}
        </div>
      )}
      <div className="public-grid">
        <div className="public-left">
          <div className="public-topline">
            <span className="seller-avatar">{(product.seller_name || product.name || 'P').slice(0, 2).toUpperCase()}</span>
            <strong>Built with <Sparkles size={13} /> on InvoxAI</strong>
          </div>
          <h1>{product.name}</h1>
          {product.cover_image && (
            <div className="public-cover">
              {product.cover_image.match(/\.(mp4|webm|ogg)$/i)
                ? <video src={product.cover_image} controls />
                : <img src={product.cover_image} alt={product.name} />}
            </div>
          )}

          {product.description && (
            <section className="public-section">
              <header><h3>Description</h3></header>
              <div
                className="public-description ProseMirror"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </section>
          )}

          {sections.gallery && <GallerySection items={gallery} />}
          {sections.testimonials && <TestimonialsSection items={testimonials} />}
          {sections.faq && <FaqSection items={faq} />}
          {sections.aboutMe && <AboutMeSection text={product.about_me} />}
          {sections.showcase && <ShowcaseSection items={showcaseProducts} accent={accent} />}

          {product.seller_name && (
            <section className="public-section public-contact">
              <Mail size={16} />
              <span>Contact {product.seller_name}</span>
            </section>
          )}

          {(product.terms_text || product.refund_text || product.privacy_text) && (
            <section className="public-section">
              {product.terms_text && (
                <details className="public-accordion" open={termsOpen} onToggle={(e) => setTermsOpen(e.target.open)}>
                  <summary>Terms and conditions <ChevronDown size={14} /></summary>
                  <p>{product.terms_text}</p>
                </details>
              )}
              {product.refund_text && (
                <details className="public-accordion" open={policyOpen.refund} onToggle={(e) => setPolicyOpen((s) => ({ ...s, refund: e.target.open }))}>
                  <summary>Refund policy <ChevronDown size={14} /></summary>
                  <p>{product.refund_text}</p>
                </details>
              )}
              {product.privacy_text && (
                <details className="public-accordion" open={policyOpen.privacy} onToggle={(e) => setPolicyOpen((s) => ({ ...s, privacy: e.target.open }))}>
                  <summary>Privacy policy <ChevronDown size={14} /></summary>
                  <p>{product.privacy_text}</p>
                </details>
              )}
            </section>
          )}

          <footer className="public-branding">
            <strong><Sparkles size={15} /> InvoxAI</strong>
            <span>Want to create your own payment page? <a href="/">Get started now!</a></span>
          </footer>
        </div>

        <aside className="public-right" aria-label="Decorative panel" />

        <div className="public-checkout">
          <div className="checkout-card">
            <label>
              <span>Access to this purchase will be sent to this email</span>
              Email Address
              <input
                type="email"
                placeholder="customer@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>

            {product.pricing_mode !== 'fixed' && (
              <div>
                <strong>Pay what you like *</strong>
                <div className="price-pills">
                  {suggestedPills.map((priceMinor, index) => {
                    const isPopular = index === 2
                    const isSelected = !otherActive && selectedPrice === priceMinor
                    return (
                      <button
                        key={`${priceMinor}-${index}`}
                        type="button"
                        className={`${isPopular ? 'popular' : ''} ${isSelected ? 'selected' : ''}`}
                        style={isSelected ? { background: accent, borderColor: accent } : undefined}
                        onClick={() => { setSelectedPrice(priceMinor); setOtherActive(false) }}
                      >
                        {isPopular && <span>Popular</span>}
                        {formatMoney(priceMinor, product.currency)}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    className={otherActive ? 'selected' : ''}
                    onClick={() => setOtherActive(true)}
                  >
                    Other
                  </button>
                </div>
                {otherActive && (
                  <span className="money-input">
                    <b>{product.currency || 'INR'}</b>
                    <input
                      type="number"
                      min={(product.price || 0) / 100}
                      step="0.01"
                      value={customPrice}
                      placeholder={`Min ${(product.price || 0) / 100}`}
                      onChange={(event) => setCustomPrice(event.target.value)}
                    />
                  </span>
                )}
              </div>
            )}

            <label>
              Add your phone number
              <span className="phone-field">
                <b>+91</b>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                />
              </span>
            </label>

            {customQuestions.map((q, index) => (
              <label key={`${q.label}-${index}`}>
                {q.label}{q.required && <span className="required-star">*</span>}
                <input
                  type="text"
                  value={customAnswers[q.label] || ''}
                  onChange={(event) => setCustomAnswers((current) => ({ ...current, [q.label]: event.target.value }))}
                />
              </label>
            ))}

            <div className="checkout-total">
              <div><span>Sub Total</span><strong>{formatMoney(chargeMinor, product.currency)}</strong></div>
              <div><b>Total</b><strong>{formatMoney(chargeMinor, product.currency)}</strong></div>
            </div>

            <button
              className="pay-button"
              style={{ background: accent }}
              type="button"
              onClick={handlePay}
              disabled={submitting}
            >
              {submitting ? 'Processing…' : (product.button_text || 'Make Payment')}
              {!submitting && <ArrowRight size={18} />}
            </button>

            {!config.configured && (
              <p className="public-note">
                <Sparkles size={13} /> Payments are not yet live on this page — the seller is setting it up.
              </p>
            )}

            <div className="invite-box">
              <strong>Invite your network</strong>
              <button className="secondary" type="button" onClick={copyShareLink}>
                <Copy size={15} /> Copy link
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
