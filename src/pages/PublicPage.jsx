import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowRight, Camera, ExternalLink, Globe, MessageCircle, Video } from 'lucide-react'

const apiBase = window.location.port === '5173' ? 'http://127.0.0.1:8080' : ''
const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const s = document.createElement('script')
    s.src = RAZORPAY_SCRIPT
    s.async = true
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

function formatMoney(minor, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 })
    .format((minor || 0) / 100)
}

export default function PublicPage() {
  const { handle } = useParams()
  const [profile, setProfile] = useState(null)
  const [links, setLinks] = useState([])
  const [status, setStatus] = useState('loading')
  const [config, setConfig] = useState({ razorpay: { configured: false } })
  const [toast, setToast] = useState(null)
  const [customAmount, setCustomAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [razorpayLoaded, setRazorpayLoaded] = useState(false)
  const quickPayRef = useRef(null)

  const showToast = useCallback((msg, kind = 'info') => {
    setToast({ msg, kind })
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`${apiBase}/api/public/profiles/${encodeURIComponent(handle)}`)
      .then(async (res) => {
        if (res.status === 404) throw new Error('not_found')
        const data = await res.json()
        if (!data.ok) throw new Error(data.message || 'load_failed')
        return data
      })
      .then(({ profile: p, links: ls }) => {
        if (cancelled) return
        setProfile(p)
        setLinks(ls || [])
        setStatus('ready')
        document.title = p.display_name ? `${p.display_name} (@${p.handle})` : `@${p.handle}`
        let meta = document.querySelector('meta[name="description"]')
        if (!meta) {
          meta = document.createElement('meta')
          meta.setAttribute('name', 'description')
          document.head.appendChild(meta)
        }
        meta.setAttribute('content', p.bio?.slice(0, 160) || `Links and offers from @${p.handle}`)
      })
      .catch((err) => {
        if (cancelled) return
        setStatus(err.message === 'not_found' ? 'not_found' : 'error')
      })

    fetch(`${apiBase}/api/public/config`).then((r) => r.json()).then((d) => {
      if (!cancelled) setConfig(d)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [handle])

  // Lazy-load Razorpay script only when Quick Pay enters viewport
  useEffect(() => {
    if (status !== 'ready' || !quickPayRef.current || razorpayLoaded) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        loadRazorpay().then((ok) => setRazorpayLoaded(ok))
        observer.disconnect()
      }
    }, { rootMargin: '120px' })
    observer.observe(quickPayRef.current)
    return () => observer.disconnect()
  }, [status, razorpayLoaded])

  const handleLinkClick = (link) => {
    fetch(`${apiBase}/api/analytics/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkId: link.id }),
    }).catch(() => {})
    window.open(link.url, '_blank', 'noopener')
  }

  const handleQuickPay = async () => {
    const amount = Number(customAmount)
    if (!amount || amount <= 0) return showToast('Enter an amount above 0', 'error')
    if (!config.razorpay?.configured) return showToast('Payments coming soon — seller is finalizing setup.', 'error')

    setSubmitting(true)
    try {
      const res = await fetch(`${apiBase}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency: profile.currency || 'INR', notes: { handle, source: 'quick_pay' } }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        showToast(data.message || 'Could not start payment.', 'error')
        setSubmitting(false)
        return
      }

      const loaded = razorpayLoaded || await loadRazorpay()
      if (!loaded || !window.Razorpay) {
        showToast('Razorpay failed to load — try again.', 'error')
        setSubmitting(false)
        return
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.razorpayOrderId,
        name: profile.display_name || `@${profile.handle}`,
        description: `Tip / quick pay`,
        theme: { color: accent },
        handler: () => {
          showToast('Thanks for your support! 🙏')
          setCustomAmount('')
          setSubmitting(false)
        },
        modal: { ondismiss: () => setSubmitting(false) },
      })
      rzp.open()
    } catch (err) {
      showToast(err.message || 'Something went wrong.', 'error')
      setSubmitting(false)
    }
  }

  const accent = profile?.primary_color || '#7c3aed'

  // Meta Pixel + GA from profile
  useEffect(() => {
    if (!profile?.meta_pixel_id || window.fbq) return
    const id = profile.meta_pixel_id.trim()
    if (!id) return
    const s = document.createElement('script')
    s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${id}'); fbq('track', 'PageView');`
    document.head.appendChild(s)
  }, [profile?.meta_pixel_id])

  useEffect(() => {
    if (!profile?.ga_tracking_id) return
    const id = profile.ga_tracking_id.trim()
    if (!id) return
    const tag = document.createElement('script')
    tag.async = true
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
    document.head.appendChild(tag)
    const inline = document.createElement('script')
    inline.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js', new Date());gtag('config', '${id}');`
    document.head.appendChild(inline)
  }, [profile?.ga_tracking_id])

  if (status === 'loading') return <PublicSkeleton />
  if (status === 'not_found') return <PublicNotFound handle={handle} />
  if (status === 'error') {
    return (
      <div className="up-page">
        <div className="up-shell">
          <h2>Something went wrong</h2>
          <p>Try refreshing in a moment.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="up-page" style={{ '--up-accent': accent }}>
      <div className="up-bg" />
      {toast && (
        <div className={`up-toast ${toast.kind === 'error' ? 'is-error' : ''}`}>{toast.msg}</div>
      )}

      <div className="up-shell">
        <header className="up-head">
          <div className="up-avatar-wrap">
            {profile.avatar_url
              ? <img className="up-avatar" src={profile.avatar_url} alt={profile.display_name || profile.handle} />
              : <div className="up-avatar up-avatar-fallback">{(profile.display_name || profile.handle).slice(0, 2).toUpperCase()}</div>}
            <span className="up-avatar-ring" />
          </div>
          <h1 className="up-name">{profile.display_name || `@${profile.handle}`}</h1>
          <p className="up-handle">@{profile.handle}</p>
          {profile.bio && <p className="up-bio">{profile.bio}</p>}

          <div className="up-socials">
            {profile.instagram_url && (
              <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <Camera size={18} />
              </a>
            )}
            {profile.twitter_url && (
              <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" aria-label="Twitter / X">
                <Globe size={18} />
              </a>
            )}
            {profile.youtube_url && (
              <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <Video size={18} />
              </a>
            )}
            {profile.whatsapp_url && (
              <a href={profile.whatsapp_url} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                <MessageCircle size={18} />
              </a>
            )}
          </div>
        </header>

        <main className="up-links">
          {links.length === 0 && (
            <div className="up-empty">This creator hasn&apos;t added any links yet.</div>
          )}
          {links.map((link) => (
            <button
              key={link.id}
              type="button"
              className="up-link-card"
              onClick={() => handleLinkClick(link)}
            >
              <span className="up-link-body">
                <strong>{link.title}</strong>
                {link.subtitle && <small>{link.subtitle}</small>}
              </span>
              {link.price_minor ? (
                <span className="up-price-badge">{formatMoney(link.price_minor, link.currency)}</span>
              ) : (
                <ExternalLink size={16} className="up-link-icon" />
              )}
            </button>
          ))}
        </main>

        <section className="up-quickpay" ref={quickPayRef}>
          <h3>Send a quick tip</h3>
          <p>Support {profile.display_name || `@${profile.handle}`} with any amount.</p>
          <div className="up-amount-row">
            <span>₹</span>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Enter amount"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="up-cta"
            disabled={submitting}
            onClick={handleQuickPay}
          >
            {submitting ? 'Opening Razorpay…' : <>Pay with Razorpay <ArrowRight size={16} /></>}
          </button>
          {!config.razorpay?.configured && (
            <p className="up-note">Payments coming soon — the seller is finalizing setup.</p>
          )}
        </section>

        <footer className="up-foot">
          <span>Built on InvoxAI</span>
          <a href="/">Create yours →</a>
        </footer>
      </div>

      {profile.instagram_url && (
        <a
          className="up-mobile-cta"
          href={profile.instagram_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Camera size={18} />
          DM me on Instagram
        </a>
      )}
    </div>
  )
}

function PublicSkeleton() {
  return (
    <div className="up-page">
      <div className="up-shell">
        <div className="up-head">
          <div className="up-skel" style={{ width: 96, height: 96, borderRadius: '50%' }} />
          <div className="up-skel" style={{ width: 200, height: 24, marginTop: 16 }} />
          <div className="up-skel" style={{ width: 120, height: 16, marginTop: 8 }} />
          <div className="up-skel" style={{ width: 260, height: 14, marginTop: 12 }} />
        </div>
        <div className="up-links">
          {[1, 2, 3].map((i) => (
            <div key={i} className="up-skel" style={{ height: 62, borderRadius: 14 }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PublicNotFound({ handle }) {
  return (
    <div className="up-page">
      <div className="up-shell" style={{ textAlign: 'center', paddingTop: 80 }}>
        <h2 style={{ fontSize: 28, margin: 0 }}>@{handle} isn&apos;t here</h2>
        <p style={{ color: '#94a3b8', marginTop: 8 }}>
          This creator hasn&apos;t set up their LinkPlease page yet.
        </p>
        <a href="/" className="up-link-back">Create your own →</a>
      </div>
    </div>
  )
}
