import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle, Camera, Check, RefreshCw, ShieldCheck, Webhook, X,
} from 'lucide-react'

const InstagramIcon = Camera

const apiBase = window.location.port === '5173' ? 'http://127.0.0.1:8080' : ''

const META_PERMISSIONS = [
  { id: 'instagram_basic', label: 'instagram_basic', description: 'Read your IG profile + media' },
  { id: 'instagram_manage_messages', label: 'instagram_manage_messages', description: 'Send & receive DMs' },
  { id: 'instagram_manage_comments', label: 'instagram_manage_comments', description: 'Read & reply to comments' },
  { id: 'pages_show_list', label: 'pages_show_list', description: 'List the FB Pages you manage' },
  { id: 'pages_manage_metadata', label: 'pages_manage_metadata', description: 'Subscribe Page to webhooks' },
  { id: 'pages_messaging', label: 'pages_messaging', description: 'Messenger Platform messaging' },
]

export default function Instagram() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [connectedAccount, setConnectedAccount] = useState(null)
  const [metaConfig, setMetaConfig] = useState(null)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reSyncing, setReSyncing] = useState(false)

  const showToast = useCallback((message, kind = 'success') => {
    setToast({ message, kind })
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  const load = useCallback(async () => {
    try {
      const [conn, health] = await Promise.all([
        fetch(`${apiBase}/api/instagram/connection`).then((r) => r.json()),
        fetch(`${apiBase}/api/health`).then((r) => r.json()),
      ])
      setConnectedAccount(conn?.connectedAccount || null)
      setMetaConfig(health?.meta || null)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (searchParams.get('instagram') === 'connected') {
      showToast('Instagram account connected.')
      const next = new URLSearchParams(searchParams)
      next.delete('instagram')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, showToast])

  const connect = () => {
    window.location.href = `${apiBase}/auth/meta`
  }

  const disconnect = async () => {
    if (!window.confirm('Disconnect your Instagram account?')) return
    await fetch(`${apiBase}/api/instagram/connection`, { method: 'DELETE' })
    setConnectedAccount(null)
    showToast('Disconnected.')
  }

  const reSync = async () => {
    setReSyncing(true)
    try {
      const res = await fetch(`${apiBase}/api/instagram/connection?refresh=1`)
      const data = await res.json()
      setConnectedAccount(data?.connectedAccount || null)
      showToast('Connection re-synced.')
    } catch {
      showToast('Could not re-sync. Try again.', 'error')
    } finally {
      setReSyncing(false)
    }
  }

  const webhookConfigured = Boolean(metaConfig?.webhookUrl && metaConfig?.connected)

  if (loading) {
    return (
      <div className="ig-page">
        <div className="ig-skel" style={{ height: 200 }} />
        <div className="ig-skel" style={{ height: 240, marginTop: 16 }} />
      </div>
    )
  }

  return (
    <div className="ig-page">
      {toast && (
        <div className={`ig-toast ${toast.kind === 'error' ? 'is-error' : ''}`} role="status">
          {toast.message}
        </div>
      )}

      <header className="ig-head">
        <h2><InstagramIcon size={20} /> Instagram connection</h2>
        <p>Manage how your Instagram account talks to LinkPlease.</p>
      </header>

      {connectedAccount ? (
        <section className="ig-card ig-connected">
          <div className="ig-connected-row">
            {connectedAccount.profilePictureUrl
              ? <img className="ig-avatar" src={connectedAccount.profilePictureUrl} alt="" />
              : <div className="ig-avatar ig-avatar-fallback">IG</div>}
            <div className="ig-connected-meta">
              <strong>@{connectedAccount.username || 'connected'}</strong>
              <span>Page: {connectedAccount.facebookPageName || connectedAccount.facebookPageId || '—'}</span>
              <span>ID: {connectedAccount.instagramAccountId || '—'}</span>
            </div>
            <span className="ig-status-pill is-active"><Check size={12} /> Active</span>
          </div>
          <div className="ig-actions">
            <button className="ig-ghost" type="button" onClick={reSync} disabled={reSyncing}>
              <RefreshCw size={14} className={reSyncing ? 'ig-spin' : ''} /> Re-sync
            </button>
            <button className="ig-danger" type="button" onClick={disconnect}>
              <X size={14} /> Disconnect
            </button>
          </div>
        </section>
      ) : (
        <section className="ig-card ig-disconnected">
          <Camera size={40} />
          <h3>Connect your Instagram</h3>
          <p>You&apos;ll be redirected to Meta to grant permissions, then back here.</p>
          {!metaConfig?.connected && (
            <div className="ig-warn">
              <AlertCircle size={14} />
              <span>
                Missing Meta credentials: <code>{(metaConfig?.missing || []).join(', ') || 'check Admin'}</code>. Fill them
                in Admin Dashboard before connecting.
              </span>
            </div>
          )}
          <button className="ig-primary" type="button" onClick={connect} disabled={!metaConfig?.connected}>
            <InstagramIcon size={16} /> Connect Instagram
          </button>
        </section>
      )}

      <section className="ig-card">
        <header className="ig-card-head">
          <h3><ShieldCheck size={16} /> Meta app permissions</h3>
          <small>The scopes LinkPlease will request when you connect.</small>
        </header>
        <ul className="ig-perms">
          {META_PERMISSIONS.map((perm) => (
            <li key={perm.id}>
              <span className="ig-perm-badge"><Check size={11} /></span>
              <div>
                <strong>{perm.label}</strong>
                <small>{perm.description}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="ig-card">
        <header className="ig-card-head">
          <h3><Webhook size={16} /> Webhook status</h3>
          <span className={`ig-webhook-pill ${webhookConfigured ? 'is-active' : 'is-inactive'}`}>
            {webhookConfigured ? <><Check size={12} /> Active</> : <><X size={12} /> Not configured</>}
          </span>
        </header>
        <div className="ig-webhook-grid">
          <div>
            <small>Callback URL</small>
            <code>{metaConfig?.webhookUrl || '—'}</code>
          </div>
          <div>
            <small>OAuth redirect</small>
            <code>{metaConfig?.redirectUri || '—'}</code>
          </div>
          <div>
            <small>Graph API</small>
            <code>{metaConfig?.graphVersion || 'v25.0'}</code>
          </div>
        </div>
        {!webhookConfigured && (
          <div className="ig-warn">
            <AlertCircle size={14} />
            <span>Add <code>META_VERIFY_TOKEN</code> + a webhook subscription in Meta Dashboard.</span>
          </div>
        )}
      </section>
    </div>
  )
}
