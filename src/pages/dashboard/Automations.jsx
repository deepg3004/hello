import { useCallback, useMemo, useState } from 'react'
import {
  Bot, Check, ChevronDown, MessageCircle, Plus, Sparkles,
  ToggleLeft, ToggleRight, Trash2, X,
} from 'lucide-react'
import { del, patch, post } from '../../lib/api.js'
import { clearCache, useApi } from '../../hooks/useApi.js'

const RULE_LIMIT = 10
const REPLY_MAX = 1000

const MATCH_TYPES = [
  { id: 'exact',       label: 'Exact match',       hint: 'Reply only when the message is exactly the keyword' },
  { id: 'contains',    label: 'Contains',          hint: 'Reply when the message contains the keyword anywhere' },
  { id: 'starts_with', label: 'Starts with',       hint: 'Reply when the message starts with the keyword' },
]

const emptyDraft = {
  trigger_keyword: '',
  reply_message: '',
  match_type: 'contains',
}

/**
 * Normalises a raw rule row from the API to the shape this page renders with.
 * The DB has both legacy columns (name/trigger/opening_message/status) and
 * the new ones (trigger_keyword/match_type) — this lets either source work.
 */
function normalise(rule) {
  return {
    ...rule,
    trigger_keyword: rule.trigger_keyword || rule.trigger || '',
    reply_message: rule.reply_message || rule.opening_message || '',
    match_type: rule.match_type || 'contains',
    is_active: rule.status === 'active',
  }
}

export default function Automations() {
  const { data, loading, refetch } = useApi('/api/automations', { ttl: 30000 })
  const [optimistic, setOptimistic] = useState([])
  const [draft, setDraft] = useState(emptyDraft)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg, kind = 'success') => {
    setToast({ msg, kind })
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const rules = useMemo(() => {
    const fromServer = (data?.automations || []).map(normalise)
    return [...optimistic, ...fromServer]
  }, [data, optimistic])

  const ruleCount = rules.length
  const atLimit = ruleCount >= RULE_LIMIT

  const resetForm = () => {
    setDraft(emptyDraft)
    setFormOpen(false)
  }

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const handleAdd = async () => {
    if (!draft.trigger_keyword.trim()) return showToast('Add a trigger keyword first.', 'error')
    if (!draft.reply_message.trim()) return showToast('Add a reply message first.', 'error')
    if (atLimit) return showToast(`You’ve hit the ${RULE_LIMIT}-rule limit. Delete one to add another.`, 'error')

    const tempId = `temp-${Date.now()}`
    const optimisticRule = {
      id: tempId,
      ...draft,
      is_active: true,
      _optimistic: true,
    }
    setOptimistic((prev) => [optimisticRule, ...prev])
    setSubmitting(true)

    try {
      await post('/api/automations', {
        name: draft.trigger_keyword.slice(0, 60),
        trigger: draft.trigger_keyword,
        openingMessage: draft.reply_message,
        status: 'active',
        triggerKeyword: draft.trigger_keyword,
        matchType: draft.match_type,
      })
      setOptimistic((prev) => prev.filter((r) => r.id !== tempId))
      clearCache('/api/automations')
      await refetch()
      resetForm()
      showToast('Rule created.')
    } catch (err) {
      setOptimistic((prev) => prev.filter((r) => r.id !== tempId))
      showToast(err.message || 'Could not save rule.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (rule) => {
    const nextActive = !rule.is_active
    try {
      await patch(`/api/automations/${rule.id}/status`, { status: nextActive ? 'active' : 'inactive' })
      clearCache('/api/automations')
      await refetch()
    } catch (err) {
      showToast(err.message || 'Could not toggle rule.', 'error')
    }
  }

  const handleDelete = async (rule) => {
    if (!window.confirm(`Delete rule for "${rule.trigger_keyword || 'this rule'}"?`)) return
    try {
      await del(`/api/automations/${rule.id}`)
      clearCache('/api/automations')
      await refetch()
      showToast('Rule deleted.')
    } catch (err) {
      showToast(err.message || 'Could not delete rule.', 'error')
    }
  }

  return (
    <div className="auto-page">
      {toast && (
        <div className={`auto-toast ${toast.kind === 'error' ? 'is-error' : ''}`} role="status">
          {toast.msg}
        </div>
      )}

      <header className="auto-head">
        <div>
          <h2><Bot size={20} /> Automation rules</h2>
          <p>Auto-reply when buyers DM you a keyword.</p>
        </div>
        <div className="auto-head-right">
          <span className={`auto-badge ${atLimit ? 'is-full' : ''}`}>
            <Sparkles size={12} /> {ruleCount} / {RULE_LIMIT} rules used
          </span>
          {!formOpen && (
            <button
              type="button"
              className="auto-primary"
              onClick={() => setFormOpen(true)}
              disabled={atLimit}
            >
              <Plus size={16} /> Add rule
            </button>
          )}
        </div>
      </header>

      {formOpen && (
        <section className="auto-form-card">
          <div className="auto-form-head">
            <strong>New rule</strong>
            <button type="button" className="auto-icon" aria-label="Cancel" onClick={resetForm}>
              <X size={16} />
            </button>
          </div>
          <div className="auto-form-grid">
            <div>
              <label className="auto-field">
                <span>Trigger keyword</span>
                <input
                  type="text"
                  placeholder="e.g. price"
                  value={draft.trigger_keyword}
                  onChange={(e) => updateDraft('trigger_keyword', e.target.value)}
                  autoFocus
                />
                <small>The word in the DM that should fire this rule.</small>
              </label>

              <label className="auto-field">
                <span>Match type</span>
                <div className="auto-select-wrap">
                  <select value={draft.match_type} onChange={(e) => updateDraft('match_type', e.target.value)}>
                    {MATCH_TYPES.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
                <small>{MATCH_TYPES.find((m) => m.id === draft.match_type)?.hint}</small>
              </label>

              <label className="auto-field">
                <span className="auto-field-row">
                  <span>Reply message</span>
                  <span className={`auto-counter ${draft.reply_message.length > REPLY_MAX ? 'is-over' : ''}`}>
                    {draft.reply_message.length}/{REPLY_MAX}
                  </span>
                </span>
                <textarea
                  rows={6}
                  maxLength={REPLY_MAX}
                  placeholder="Hey! Here&apos;s the link you asked for: https://hello.invoxai.io/p/..."
                  value={draft.reply_message}
                  onChange={(e) => updateDraft('reply_message', e.target.value)}
                />
              </label>
            </div>

            <aside className="auto-preview">
              <span className="auto-preview-label">Live preview</span>
              <div className="auto-chat-frame">
                <div className="auto-chat-head">
                  <span className="auto-chat-avatar">YOU</span>
                  <div>
                    <strong>Buyer · 2m</strong>
                    <small>Instagram DM</small>
                  </div>
                </div>
                <div className="auto-chat-body">
                  <div className="auto-bubble in">{draft.trigger_keyword.trim() || 'price'}</div>
                  <div className="auto-bubble out">{draft.reply_message.trim() || 'Your reply will appear here…'}</div>
                </div>
              </div>
            </aside>
          </div>

          <div className="auto-form-actions">
            <button type="button" className="auto-ghost" onClick={resetForm}>Cancel</button>
            <button type="button" className="auto-primary" onClick={handleAdd} disabled={submitting}>
              {submitting ? 'Saving…' : <><Check size={16} /> Save rule</>}
            </button>
          </div>
        </section>
      )}

      {loading && rules.length === 0 ? (
        <div className="auto-list">
          {[1, 2, 3].map((i) => <div key={i} className="auto-skel" />)}
        </div>
      ) : rules.length === 0 ? (
        <EmptyState onAdd={() => setFormOpen(true)} />
      ) : (
        <ul className="auto-list">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={() => handleToggle(rule)}
              onDelete={() => handleDelete(rule)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function RuleCard({ rule, onToggle, onDelete }) {
  const matchLabel = MATCH_TYPES.find((m) => m.id === rule.match_type)?.label || rule.match_type
  return (
    <li className={`auto-card ${rule.is_active ? 'is-active' : ''} ${rule._optimistic ? 'is-optimistic' : ''}`}>
      <div className="auto-card-left">
        <span className={`auto-dot ${rule.is_active ? 'is-on' : ''}`} />
        <div>
          <strong>{rule.trigger_keyword || rule.name || 'Untitled rule'}</strong>
          <small><span className="auto-pill">{matchLabel}</span> {rule.reply_message?.slice(0, 80) || ''}{rule.reply_message?.length > 80 ? '…' : ''}</small>
        </div>
      </div>
      <div className="auto-card-actions">
        <button type="button" className={`auto-toggle ${rule.is_active ? 'is-on' : ''}`} onClick={onToggle} aria-label={rule.is_active ? 'Disable rule' : 'Enable rule'}>
          {rule.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
        </button>
        <button type="button" className="auto-icon auto-icon-danger" onClick={onDelete} aria-label="Delete rule">
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="auto-empty">
      <div className="auto-empty-illus">
        <MessageCircle size={36} />
        <Bot size={36} />
      </div>
      <h3>No automation rules yet</h3>
      <p>When a buyer DMs your trigger keyword, LinkPlease replies for you. Try setting up a rule for "price" or "link".</p>
      <button type="button" className="auto-primary" onClick={onAdd}>
        <Plus size={16} /> Create your first rule
      </button>
    </div>
  )
}
