import { Image as ImageIcon, MessageSquare, HelpCircle, User, Package } from 'lucide-react'

export function GallerySection({ items }) {
  if (!items?.length) return null
  return (
    <section className="public-section">
      <header><ImageIcon size={18} /><h3>Gallery</h3></header>
      <div className="public-gallery-grid">
        {items.map((url, index) => (
          <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer">
            <img src={url} alt={`Gallery item ${index + 1}`} loading="lazy" />
          </a>
        ))}
      </div>
    </section>
  )
}

export function TestimonialsSection({ items }) {
  if (!items?.length) return null
  return (
    <section className="public-section">
      <header><MessageSquare size={18} /><h3>What buyers say</h3></header>
      <div className="public-testimonials">
        {items.map((item, index) => (
          <blockquote key={`${item.name || 'q'}-${index}`} className="public-testimonial">
            <p>"{item.text}"</p>
            <footer>— {item.name || 'Anonymous'}{item.rating ? ` · ${item.rating}/5` : ''}</footer>
          </blockquote>
        ))}
      </div>
    </section>
  )
}

export function FaqSection({ items }) {
  if (!items?.length) return null
  return (
    <section className="public-section">
      <header><HelpCircle size={18} /><h3>Frequently asked questions</h3></header>
      <div className="public-faq">
        {items.map((item, index) => (
          <details key={`${item.q || 'q'}-${index}`} className="public-faq-item">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function AboutMeSection({ text }) {
  if (!text?.trim()) return null
  return (
    <section className="public-section">
      <header><User size={18} /><h3>About me</h3></header>
      <p className="public-about-me">{text}</p>
    </section>
  )
}

export function ShowcaseSection({ items, accent }) {
  if (!items?.length) return null
  return (
    <section className="public-section">
      <header><Package size={18} /><h3>More from this creator</h3></header>
      <div className="public-showcase">
        {items.map((product) => (
          <a key={product.id} href={`/p/${product.slug}`} className="public-showcase-card">
            {product.cover_image && <img src={product.cover_image} alt={product.name} loading="lazy" />}
            <div>
              <strong>{product.name}</strong>
              <span style={{ color: accent }}>View →</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
