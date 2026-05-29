import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Camera, Check, Copy, Edit3, ExternalLink, Eye,
  EyeOff, Globe, MessageCircle, Plus, Save, Sparkles, Trash2, Video,
} from 'lucide-react'
import { del, patch, post, put } from '../../lib/api.js'
import { clearCache, useApi } from '../../hooks/useApi.js'

const SOCIAL_FIELDS = [
  { key: 'instagramUrl', label: 'Instagram', icon: Camera, placeholder: 'https://instagram.com/yourhandle' },
  { key: 'twitterUrl',   label: 'Twitter / X', icon: Globe,  placeholder: 'https://x.com/yourhandle' },
  { key: 'youtubeUrl',   label: 'YouTube',     icon: Video,  placeholder: 'https://youtube.com/@yourhandle' },
  { key: 'whatsappUrl',  label: 'WhatsApp',    icon: MessageCircle, placeholder: 'https://wa.me/91XXXXXXXXXX' },
]

const PRESET_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f97316', '#ec4899', '#1e3a8a', '#0f172a']

const emptyProfile = {
  handle: '',
  displayName: '',
  bio: '',
  avatarUrl: '',
  instagramUrl: '',
  twitterUrl: '',
  youtubeUrl: '',
  whatsappUrl: '',
  primaryColor: '#7c3aed',
  metaPixelId: '',
  gaTrackingId: '',
  isPublished: true,
}

const emptyLink = { title: '', subtitle: '', url: '', priceMinor: '', currency: 'INR' }

function dbToForm(row) {
  if (!row) return emptyProfile
  return {
    handle: row.handle || '',
    displayName: row.display_name || '',
    bio: row.bio || '',
    avatarUrl: row.avatar_url || '',
    instagramUrl: row.instagram_url || '',
    twitterUrl: row.twitter_url || '',
    youtubeUrl: row.youtube_url || '',
    whatsappUrl: row.whatsapp_url || '',
    primaryColor: row.primary_color || '#7c3aed',
    metaPixelId: row.meta_pixel_id || '',
    gaTrackingId: row.ga_tracking_id || '',
    isPublished: row.is_published !== false,
    viewCount: row.view_count || 0,
  }
}

export default function Profile() {
  const profileQuery = useApi('/api/profiles/me', { ttl: 30000 })
  const linksQuery = useApi('/api/profiles/me/links', { ttl: 30000 })

  const [form, setForm] = useState(emptyProfile)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const colorInputRef = useRef(null)

  useEffect(() => {
    if (profileQuery.data?.profile) {
      setForm(dbToForm(profileQuery.data.profile))
    }
  }, [profileQuery.data])

  const showToast = (msg, kind = 'success') => {
    setToast({ msg, kind })
    window.setTimeout(() => setToast(null), 2800)
  }

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const saveProfile = async () => {
    if (!form.handle.trim()) return showToast('Pick a handle first.', 'error')
    setSaving(true)
    try {
      await put('/api/profiles/me', form)
      clearCache('/api/profiles/me')
      await profileQuery.refetch()
      showToast('Profile saved.')
    } catch (err) {
      showToast(err.message || 'Could not save profile.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const links = linksQuery.data?.links || []

  const copyPublicUrl = async () => {
    const url = `${window.location.origin}/u/${form.handle}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('Public link copied.')
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  const publicUrl = form.handle ? `${window.location.origin}/u/${form.handle}` : ''

  return (
    <div className="prof-page">
      {toast && (
        <div className={`prof-toast ${toast.kind === 'error' ? 'is-error' : ''}`}>{toast.msg}</div>
      )}

      <header className="prof-head">
        <div>
          <h2><Sparkles size={20} /> My page</h2>
          <p>Your public LinkPlease profile at <code>/u/&lt;handle&gt;</code>.</p>
        </div>
        {form.handle && (
          <div className="prof-public-row">
            <code className="prof-public-link">{publicUrl}</code>
            <button type="button" className="prof-ghost" onClick={copyPublicUrl}><Copy size={14} /> Copy</button>
            <a className="prof-ghost" href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> Open
            </a>
          </div>
        )}
      </header>

      <div className="prof-grid">
        <section className="prof-card">
          <h3>Profile</h3>
          <div className="prof-fields">
            <label className="prof-field">
              <span>Handle <em>*</em></span>
              <small>Lowercase letters, numbers, _ and - only. Used in your public URL.</small>
              <div className="prof-handle-row">
                <span>{window.location.host}/u/</span>
                <input
                  value={form.handle}
                  onChange={(e) => update('handle', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="yourhandle"
                  maxLength={32}
                />
              </div>
            </label>

            <label className="prof-field">
              <span>Display name</span>
              <input
                value={form.displayName}
                onChange={(e) => update('displayName', e.target.value)}
                placeholder="e.g. Deep Ghosh"
              />
            </label>

            <label className="prof-field">
              <span>Bio</span>
              <small>One or two short lines under your name.</small>
              <textarea
                rows={3}
                maxLength={240}
                value={form.bio}
                onChange={(e) => update('bio', e.target.value)}
                placeholder="Helping creators grow with smart DM automation."
              />
              <span className="prof-counter">{form.bio.length}/240</span>
            </label>

            <label className="prof-field">
              <span>Avatar URL</span>
              <small>Paste any square image URL (file upload coming soon).</small>
              <input
                value={form.avatarUrl}
                onChange={(e) => update('avatarUrl', e.target.value)}
                placeholder="https://images.example.com/me.jpg"
              />
            </label>

            <label className="prof-field prof-toggle-field">
              <span>Visibility</span>
              <button
                type="button"
                className={`prof-toggle ${form.isPublished ? 'is-on' : ''}`}
                onClick={() => update('isPublished', !form.isPublished)}
              >
                {form.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                {form.isPublished ? 'Public' : 'Hidden'}
              </button>
            </label>
          </div>
        </section>

        <section className="prof-card">
          <h3>Social links</h3>
          <div className="prof-fields">
            {SOCIAL_FIELDS.map((field) => {
              const Icon = field.icon
              return (
                <label className="prof-field prof-social-field" key={field.key}>
                  <span><Icon size={14} /> {field.label}</span>
                  <input
                    value={form[field.key] || ''}
                    onChange={(e) => update(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                </label>
              )
            })}
          </div>

          <h3 style={{ marginTop: 20 }}>Branding</h3>
          <div className="prof-fields">
            <label className="prof-field">
              <span>Primary color</span>
              <small>Used for the accent on your /u/ page.</small>
              <div className="prof-swatch-row">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`prof-swatch ${form.primaryColor === color ? 'is-active' : ''}`}
                    style={{ background: color }}
                    onClick={() => update('primaryColor', color)}
                    aria-label={`Pick ${color}`}
                  />
                ))}
                <button
                  type="button"
                  className="prof-swatch prof-swatch-custom"
                  onClick={() => colorInputRef.current?.click()}
                >
                  <Edit3 size={12} />
                </button>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => update('primaryColor', e.target.value)}
                  style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
                />
              </div>
            </label>
          </div>

          <h3 style={{ marginTop: 20 }}>Tracking</h3>
          <div className="prof-fields">
            <label className="prof-field">
              <span>Meta Pixel ID</span>
              <input
                value={form.metaPixelId || ''}
                onChange={(e) => update('metaPixelId', e.target.value)}
                placeholder="123456789012345"
              />
            </label>
            <label className="prof-field">
              <span>Google Analytics ID</span>
              <input
                value={form.gaTrackingId || ''}
                onChange={(e) => update('gaTrackingId', e.target.value)}
                placeholder="G-XXXXXXXXXX"
              />
            </label>
          </div>
        </section>
      </div>

      <div className="prof-save-row">
        <button type="button" className="prof-primary" onClick={saveProfile} disabled={saving}>
          {saving ? 'Saving…' : <><Save size={14} /> Save profile</>}
        </button>
        {form.viewCount > 0 && (
          <span className="prof-views"><Eye size={13} /> {form.viewCount.toLocaleString('en-IN')} page views</span>
        )}
      </div>

      <LinksManager
        profileHandle={form.handle}
        links={links}
        loading={linksQuery.loading}
        refetch={linksQuery.refetch}
        showToast={showToast}
        canAdd={Boolean(form.handle)}
      />
    </div>
  )
}

function LinksManager({ profileHandle, links, loading, refetch, showToast, canAdd }) {
  const [addOpen, setAddOpen] = useState(false)
  const [draft, setDraft] = useState(emptyLink)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const resetDraft = () => {
    setDraft(emptyLink)
    setAddOpen(false)
    setEditingId(null)
  }

  const openEdit = (link) => {
    setDraft({
      title: link.title,
      subtitle: link.subtitle || '',
      url: link.url,
      priceMinor: link.price_minor ? String(link.price_minor / 100) : '',
      currency: link.currency || 'INR',
    })
    setEditingId(link.id)
    setAddOpen(true)
  }

  const submitDraft = async () => {
    if (!draft.title.trim() || !draft.url.trim()) return showToast('Title and URL are required.', 'error')
    setSubmitting(true)
    try {
      const payload = {
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        url: draft.url.trim(),
        priceMinor: draft.priceMinor ? Math.round(Number(draft.priceMinor) * 100) : null,
        currency: draft.currency || 'INR',
      }
      if (editingId) {
        await patch(`/api/profiles/me/links/${editingId}`, payload)
        showToast('Link updated.')
      } else {
        await post('/api/profiles/me/links', payload)
        showToast('Link added.')
      }
      clearCache('/api/profiles/me/links')
      await refetch()
      resetDraft()
    } catch (err) {
      showToast(err.message || 'Could not save link.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleVisible = async (link) => {
    try {
      await patch(`/api/profiles/me/links/${link.id}`, { isVisible: !link.is_visible })
      clearCache('/api/profiles/me/links')
      await refetch()
    } catch (err) {
      showToast(err.message || 'Toggle failed.', 'error')
    }
  }

  const move = async (link, direction) => {
    const sorted = [...links].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex((l) => l.id === link.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    try {
      await Promise.all([
        patch(`/api/profiles/me/links/${link.id}`,  { position: other.position }),
        patch(`/api/profiles/me/links/${other.id}`, { position: link.position }),
      ])
      clearCache('/api/profiles/me/links')
      await refetch()
    } catch (err) {
      showToast(err.message || 'Reorder failed.', 'error')
    }
  }

  const removeLink = async (link) => {
    if (!window.confirm(`Delete "${link.title}"?`)) return
    try {
      await del(`/api/profiles/me/links/${link.id}`)
      clearCache('/api/profiles/me/links')
      await refetch()
      showToast('Link deleted.')
    } catch (err) {
      showToast(err.message || 'Delete failed.', 'error')
    }
  }

  const sortedLinks = [...links].sort((a, b) => a.position - b.position)

  return (
    <section className="prof-card prof-links-card">
      <div className="prof-links-head">
        <h3>Links on your page</h3>
        {!addOpen && (
          <button
            type="button"
            className="prof-primary"
            onClick={() => { setAddOpen(true); setDraft(emptyLink); setEditingId(null) }}
            disabled={!canAdd}
            title={canAdd ? '' : 'Save your handle first'}
          >
            <Plus size={14} /> Add link
          </button>
        )}
      </div>

      {addOpen && (
        <div className="prof-link-form">
          <div className="prof-fields prof-fields-inline">
            <label className="prof-field">
              <span>Title <em>*</em></span>
              <input
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="e.g. Instagram Growth Playbook"
              />
            </label>
            <label className="prof-field">
              <span>Subtitle</span>
              <input
                value={draft.subtitle}
                onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))}
                placeholder="One-line description (optional)"
              />
            </label>
            <label className="prof-field">
              <span>URL <em>*</em></span>
              <input
                value={draft.url}
                onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                placeholder="https://hello.invoxai.io/p/your-product"
              />
            </label>
            <label className="prof-field">
              <span>Price (optional)</span>
              <div className="prof-price-row">
                <select
                  value={draft.currency}
                  onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.priceMinor}
                  onChange={(e) => setDraft((d) => ({ ...d, priceMinor: e.target.value }))}
                  placeholder="0 for free"
                />
              </div>
            </label>
          </div>
          <div className="prof-form-actions">
            <button type="button" className="prof-ghost" onClick={resetDraft}>Cancel</button>
            <button type="button" className="prof-primary" onClick={submitDraft} disabled={submitting}>
              {submitting ? 'Saving…' : <><Check size={14} /> {editingId ? 'Save changes' : 'Add link'}</>}
            </button>
          </div>
        </div>
      )}

      {loading && sortedLinks.length === 0 ? (
        <div className="prof-empty">Loading…</div>
      ) : sortedLinks.length === 0 ? (
        <div className="prof-empty">
          <Sparkles size={28} />
          <strong>No links yet</strong>
          <p>Add a link to your product, a YouTube video, or anywhere you want buyers to go.</p>
        </div>
      ) : (
        <ul className="prof-link-list">
          {sortedLinks.map((link, index) => (
            <li key={link.id} className={`prof-link-row ${!link.is_visible ? 'is-hidden' : ''}`}>
              <div className="prof-link-meta">
                <strong>{link.title}</strong>
                {link.subtitle && <small>{link.subtitle}</small>}
                <span className="prof-link-url">{link.url}</span>
                {link.price_minor ? (
                  <span className="prof-price-badge">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: link.currency || 'INR', maximumFractionDigits: 0 }).format(link.price_minor / 100)}
                  </span>
                ) : null}
              </div>
              <div className="prof-link-actions">
                <button type="button" className="prof-icon" onClick={() => move(link, 'up')} disabled={index === 0} aria-label="Move up"><ArrowUp size={14} /></button>
                <button type="button" className="prof-icon" onClick={() => move(link, 'down')} disabled={index === sortedLinks.length - 1} aria-label="Move down"><ArrowDown size={14} /></button>
                <button type="button" className="prof-icon" onClick={() => toggleVisible(link)} aria-label="Toggle visibility">
                  {link.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button type="button" className="prof-icon" onClick={() => openEdit(link)} aria-label="Edit"><Edit3 size={14} /></button>
                <button type="button" className="prof-icon prof-icon-danger" onClick={() => removeLink(link)} aria-label="Delete"><Trash2 size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
