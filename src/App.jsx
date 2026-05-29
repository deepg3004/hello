import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Bot,
  Camera,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Copy,
  CreditCard,
  Edit3,
  Eye,
  Gift,
  Home,
  Link,
  Mail,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import './App.css'

const navigation = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'admin', label: 'Admin Dashboard', icon: ShieldCheck },
  { id: 'learn', label: 'Learn', icon: BookOpen, badge: 'NEW' },
  { id: 'automations', label: 'Automations', icon: Bot },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'products', label: 'Products', icon: ShoppingBag },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
  { id: 'refer', label: 'Refer and Earn', icon: Gift },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const videos = [
  {
    title: 'How to generate leads in Instagram DMs',
    tag: 'Free',
    image:
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=640&q=80',
  },
  {
    title: 'How to grow followers with comment automation',
    tag: 'Free',
    image:
      'https://images.unsplash.com/photo-1542744095-fcf48d80b0fd?auto=format&fit=crop&w=640&q=80',
  },
  {
    title: 'CMS Masterclass for digital product sales',
    tag: 'Pro',
    image:
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=640&q=80',
  },
]

const planRows = [
  ['Automations', 'Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'],
  ['DM send limit', '1,000/mo', 'Unlimited', 'Unlimited', 'Unlimited'],
  ['Contacts', '1,000/mo', 'Unlimited', 'Unlimited', 'Unlimited'],
  ['Re-trigger', 'No', 'Yes', 'Yes', 'Yes'],
  ['Ask for follow', 'No', 'Yes', 'Yes', 'Yes'],
  ['Lead gen', 'No', 'Yes', 'Yes', 'Yes'],
  ['Multiple accounts', 'No', 'No', 'No', 'Yes'],
]

const defaultApiConfig = {
  appId: '',
  appSecret: '',
  accessToken: '',
  verifyToken: '',
  webhookUrl: 'https://your-domain.com/api/webhooks/instagram',
  redirectUri: 'https://your-domain.com/auth/meta/callback',
  graphVersion: 'v25.0',
  instagramAccountId: '',
  facebookPageId: '',
  businessId: '',
}

const adminSteps = [
  'Create Meta Developer App and add Instagram/Messenger products.',
  'Add live domain, privacy policy URL, and data deletion URL in Meta settings.',
  'Create backend routes for OAuth callback, webhook verification, webhook events, and message sending.',
  'Put App Secret and long-lived tokens in server environment variables, not frontend code.',
  'Set webhook callback URL in Meta dashboard and subscribe to messages, comments, postbacks, and seen events.',
  'Connect a test Instagram Professional account and verify incoming DM/comment events.',
  'Submit Meta App Review with a screen recording of connection, webhook receiving, and DM reply.',
  'After approval, switch Meta app to Live mode and monitor webhook errors on your server.',
]

function App() {
  const [activePage, setActivePage] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [automations, setAutomations] = useState([])
  const [realContacts, setRealContacts] = useState([])
  const [realProducts, setRealProducts] = useState([])
  const [realOrders, setRealOrders] = useState([])
  const [metrics, setMetrics] = useState({
    messagesSent: 0,
    messagesSeen: 0,
    totalClicks: 0,
    followersGained: 0,
  })
  const [builderOpen, setBuilderOpen] = useState(false)
  const [selectedTrigger, setSelectedTrigger] = useState('User comments on post or reel')
  const [openingEnabled, setOpeningEnabled] = useState(true)
  const [automationActive, setAutomationActive] = useState(true)
  const [settingsTab, setSettingsTab] = useState('general')
  const [adminKey, setAdminKey] = useState('')
  const [apiConfig, setApiConfig] = useState(() => {
    try {
      const saved = window.localStorage.getItem('linkplease_api_config')
      return saved ? { ...defaultApiConfig, ...JSON.parse(saved) } : defaultApiConfig
    } catch {
      return defaultApiConfig
    }
  })
  const [configSaved, setConfigSaved] = useState(false)
  const [connectedAccount, setConnectedAccount] = useState(null)
  const apiBase = window.location.port === '5173' ? 'http://127.0.0.1:8080' : ''

  const loadConnectedAccount = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/api/instagram/connection`)
      const data = await response.json()
      setConnectedAccount(data.connectedAccount || null)
    } catch {
      setConnectedAccount(null)
    }
  }, [apiBase])

  const loadRealData = useCallback(async () => {
    const [dashboardResponse, automationsResponse, contactsResponse, productsResponse, ordersResponse] =
      await Promise.all([
        fetch(`${apiBase}/api/dashboard`),
        fetch(`${apiBase}/api/automations`),
        fetch(`${apiBase}/api/contacts`),
        fetch(`${apiBase}/api/products`),
        fetch(`${apiBase}/api/orders`),
      ])
    const [dashboardData, automationsData, contactsData, productsData, ordersData] = await Promise.all([
      dashboardResponse.json(),
      automationsResponse.json(),
      contactsResponse.json(),
      productsResponse.json(),
      ordersResponse.json(),
    ])

    setMetrics(dashboardData.metrics || {
      messagesSent: 0,
      messagesSeen: 0,
      totalClicks: 0,
      followersGained: 0,
    })
    setAutomations(automationsData.automations || [])
    setRealContacts(contactsData.contacts || [])
    setRealProducts(productsData.products || [])
    setRealOrders(ordersData.orders || [])
  }, [apiBase])

  useEffect(() => {
    let ignore = false

    fetch(`${apiBase}/api/instagram/connection`)
      .then((response) => response.json())
      .then((data) => {
        if (!ignore) setConnectedAccount(data.connectedAccount || null)
      })
      .catch(() => {
        if (!ignore) setConnectedAccount(null)
      })

    return () => {
      ignore = true
    }
  }, [apiBase])

  useEffect(() => {
    let ignore = false

    Promise.all([
      fetch(`${apiBase}/api/dashboard`),
      fetch(`${apiBase}/api/automations`),
      fetch(`${apiBase}/api/contacts`),
      fetch(`${apiBase}/api/products`),
      fetch(`${apiBase}/api/orders`),
    ])
      .then((responses) => Promise.all(responses.map((response) => response.json())))
      .then(([dashboardData, automationsData, contactsData, productsData, ordersData]) => {
        if (ignore) return
        setMetrics(dashboardData.metrics || {
          messagesSent: 0,
          messagesSeen: 0,
          totalClicks: 0,
          followersGained: 0,
        })
        setAutomations(automationsData.automations || [])
        setRealContacts(contactsData.contacts || [])
        setRealProducts(productsData.products || [])
        setRealOrders(ordersData.orders || [])
      })
      .catch(() => {})

    return () => {
      ignore = true
    }
  }, [apiBase])

  const startInstagramConnect = () => {
    window.location.href = `${apiBase}/auth/meta`
  }

  const disconnectInstagram = async () => {
    await fetch(`${apiBase}/api/instagram/connection`, { method: 'DELETE' })
    setConnectedAccount(null)
  }

  const activeTitle = useMemo(
    () => navigation.find((item) => item.id === activePage)?.label ?? 'Home',
    [activePage],
  )

  const addAutomation = () => {
    fetch(`${apiBase}/api/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New comment to DM flow',
        trigger: selectedTrigger,
        openingMessage: 'Hey! Thanks for commenting. Tap below and I will send the resource instantly.',
        ctaLabel: 'Get the link',
        ctaUrl: 'https://hello.invoxai.io',
        status: automationActive ? 'active' : 'inactive',
      }),
    })
      .then(() => loadRealData())
      .finally(() => setBuilderOpen(false))
  }

  const toggleAutomation = (index) => {
    const automation = automations[index]
    if (!automation) return
    fetch(`${apiBase}/api/automations/${automation.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: automation.status === 'active' ? 'inactive' : 'active' }),
    }).then(() => loadRealData())
  }

  const renderPage = () => {
    if (activePage === 'home') {
      return (
        <HomePage
          setActivePage={setActivePage}
          connectedAccount={connectedAccount}
          startInstagramConnect={startInstagramConnect}
          metrics={metrics}
        />
      )
    }
    if (activePage === 'admin') {
      return (
        <AdminPage
          apiConfig={apiConfig}
          setApiConfig={setApiConfig}
          configSaved={configSaved}
          adminKey={adminKey}
          setAdminKey={setAdminKey}
          saveConfig={() => {
            window.localStorage.setItem('linkplease_api_config', JSON.stringify(apiConfig))
            setConfigSaved(true)
            window.setTimeout(() => setConfigSaved(false), 2200)
          }}
        />
      )
    }
    if (activePage === 'learn') return <LearnPage />
    if (activePage === 'automations') {
      return (
        <AutomationsPage
          automations={automations}
          builderOpen={builderOpen}
          setBuilderOpen={setBuilderOpen}
          selectedTrigger={selectedTrigger}
          setSelectedTrigger={setSelectedTrigger}
          openingEnabled={openingEnabled}
          setOpeningEnabled={setOpeningEnabled}
          automationActive={automationActive}
          setAutomationActive={setAutomationActive}
          addAutomation={addAutomation}
          toggleAutomation={toggleAutomation}
        />
      )
    }
    if (activePage === 'contacts') return <ContactsPage contacts={realContacts} />
    if (activePage === 'products') return <ProductsPage products={realProducts} />
    if (activePage === 'orders') return <OrdersPage orders={realOrders} />
    if (activePage === 'refer') return <ReferPage />
    if (activePage === 'settings') {
      return (
        <SettingsPage
          settingsTab={settingsTab}
          setSettingsTab={setSettingsTab}
          connectedAccount={connectedAccount}
          startInstagramConnect={startInstagramConnect}
          disconnectInstagram={disconnectInstagram}
          loadConnectedAccount={loadConnectedAccount}
        />
      )
    }
    return (
      <HomePage
        setActivePage={setActivePage}
        connectedAccount={connectedAccount}
        startInstagramConnect={startInstagramConnect}
        metrics={metrics}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">LP</div>
          <div>
            <strong>LinkPlease</strong>
            <span><BadgeCheck size={13} /> Meta verified</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Dashboard">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={activePage === item.id ? 'active' : ''}
                key={item.id}
                type="button"
                onClick={() => {
                  setActivePage(item.id)
                  setSidebarOpen(false)
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.badge && <small>{item.badge}</small>}
              </button>
            )
          })}
        </nav>
        <div className="usage-box">
          <span>Monthly usage</span>
          <Progress label="DMs" value={0} total={1000} />
          <Progress label="Contacts" value={0} total={1000} />
          <button type="button" onClick={() => setActivePage('pricing')}>
            <Sparkles size={16} />
            Upgrade to Pro
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-only" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={21} />
          </button>
          <div>
            <p>Go Viral On IG with DM Automation</p>
            <h1>{activePage === 'pricing' ? 'Pricing' : activeTitle}</h1>
          </div>
          <div className="top-actions">
            <div className="search">
              <Search size={17} />
              <input aria-label="Search" placeholder="Search" />
            </div>
            <button className="primary" type="button" onClick={() => setActivePage('automations')}>
              <Plus size={17} />
              Create
            </button>
          </div>
        </header>
        {activePage === 'pricing' ? <PricingPage /> : renderPage()}
      </main>

      {sidebarOpen && <button className="scrim" type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
    </div>
  )
}

function AdminPage({ apiConfig, setApiConfig, configSaved, adminKey, setAdminKey, saveConfig }) {
  const [syncStatus, setSyncStatus] = useState('')
  const [backendStatus, setBackendStatus] = useState(null)

  const updateField = (field, value) => {
    setApiConfig((config) => ({ ...config, [field]: value }))
  }

  const apiBase = window.location.port === '5173' ? 'http://127.0.0.1:8080' : ''

  const checkBackend = async () => {
    setSyncStatus('Checking backend...')
    try {
      const response = await fetch(`${apiBase}/api/health`)
      const data = await response.json()
      setBackendStatus(data.meta)
      setSyncStatus(response.ok ? 'Backend is reachable.' : 'Backend health check failed.')
    } catch {
      setSyncStatus('Backend is not reachable. Start the server first.')
    }
  }

  const syncToBackend = async () => {
    setSyncStatus('Saving to backend...')
    try {
      const response = await fetch(`${apiBase}/api/admin/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-setup-key': adminKey,
        },
        body: JSON.stringify(apiConfig),
      })
      const data = await response.json()
      setBackendStatus(data.meta || null)
      setSyncStatus(data.message || (response.ok ? 'Saved to backend.' : 'Backend save failed.'))
    } catch {
      setSyncStatus('Could not reach backend config route.')
    }
  }

  const fields = [
    ['appId', 'Meta App ID', '1234567890'],
    ['appSecret', 'Meta App Secret', 'Keep this only on server'],
    ['accessToken', 'Page / Instagram Access Token', 'Long-lived token from Meta'],
    ['verifyToken', 'Webhook Verify Token', 'Create any strong random text'],
    ['webhookUrl', 'Webhook Callback URL', 'https://your-domain.com/api/webhooks/instagram'],
    ['redirectUri', 'OAuth Redirect URI', 'https://your-domain.com/auth/meta/callback'],
    ['graphVersion', 'Graph API Version', 'v25.0'],
    ['instagramAccountId', 'Instagram Account ID', '1784...'],
    ['facebookPageId', 'Facebook Page ID', '1234...'],
    ['businessId', 'Meta Business ID', '9876...'],
  ]

  return (
    <div className="stack">
      <section className="panel admin-hero">
        <div>
          <span className="eyebrow"><ShieldCheck size={16} /> Admin control</span>
          <h2>Connect real Meta API details before hosting live.</h2>
          <p>This screen prepares your project for production. In the final backend, secrets must be saved on the server as environment variables.</p>
        </div>
        <div className="connection-status">
          <span className={apiConfig.appId && apiConfig.webhookUrl ? 'status-dot on' : 'status-dot'} />
          <strong>{apiConfig.appId && apiConfig.webhookUrl ? 'Config drafted' : 'Not connected'}</strong>
          <small>Local admin setup</small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">API setup</span>
            <h3>Meta credentials and URLs</h3>
            <p>Add your real IDs, tokens, callback URLs, and API version here for planning and handoff.</p>
          </div>
          <button className="primary" type="button" onClick={saveConfig}>
            <Check size={17} />
            {configSaved ? 'Saved' : 'Save Config'}
          </button>
        </div>
        <div className="admin-form">
          <label className="wide-field">
            Admin Setup Key
            <input
              type="password"
              value={adminKey}
              placeholder="Use ADMIN_SETUP_KEY from your server"
              onChange={(event) => setAdminKey(event.target.value)}
            />
          </label>
          {fields.map(([field, label, placeholder]) => (
            <label key={field}>
              {label}
              <input
                type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('token') ? 'password' : 'text'}
                value={apiConfig[field]}
                placeholder={placeholder}
                onChange={(event) => updateField(field, event.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="admin-actions">
          <button className="secondary" type="button" onClick={checkBackend}>
            <Server size={16} />
            Check Backend
          </button>
          <button className="primary" type="button" onClick={syncToBackend}>
            <ShieldCheck size={16} />
            Sync To Backend
          </button>
          {syncStatus && <span>{syncStatus}</span>}
        </div>
      </section>

      <div className="admin-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow"><Server size={16} /> Server env</span>
              <h3>Use this on live hosting</h3>
            </div>
          </div>
          <pre className="env-box">{`META_APP_ID=${apiConfig.appId || 'your_meta_app_id'}
META_APP_SECRET=your_meta_app_secret
META_ACCESS_TOKEN=your_long_lived_access_token
META_VERIFY_TOKEN=${apiConfig.verifyToken || 'your_webhook_verify_token'}
META_GRAPH_VERSION=${apiConfig.graphVersion || 'v25.0'}
META_REDIRECT_URI=${apiConfig.redirectUri || 'https://your-domain.com/auth/meta/callback'}
PUBLIC_WEBHOOK_URL=${apiConfig.webhookUrl || 'https://your-domain.com/api/webhooks/instagram'}
INSTAGRAM_ACCOUNT_ID=${apiConfig.instagramAccountId || 'your_instagram_account_id'}
FACEBOOK_PAGE_ID=${apiConfig.facebookPageId || 'your_facebook_page_id'}
META_BUSINESS_ID=${apiConfig.businessId || 'your_meta_business_id'}`}</pre>
          {backendStatus && (
            <div className="backend-status">
              <strong>{backendStatus.connected ? 'Backend connected' : 'Backend missing fields'}</strong>
              <span>Missing: {backendStatus.missing?.length ? backendStatus.missing.join(', ') : 'None'}</span>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Live process</span>
              <h3>Step-by-step guide</h3>
            </div>
          </div>
          <div className="guide-list">
            {adminSteps.map((step, index) => (
              <div className="guide-step" key={step}>
                <span>{index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel warning-panel">
        <strong>Production note</strong>
        <p>The current local prototype saves this admin form in browser storage only. For a real live server, I need to add a backend database, login-protected admin route, encrypted secret storage, Meta OAuth callback, webhook receiver, and message sender.</p>
      </section>
    </div>
  )
}

function Progress({ label, value, total }) {
  const percent = Math.round((value / total) * 100)
  return (
    <div className="progress-line">
      <div>
        <span>{label}</span>
        <span>{value}/{total}</span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function HomePage({ setActivePage, connectedAccount, startInstagramConnect, metrics }) {
  return (
    <div className="page-grid">
      <section className="panel hero-panel">
        <div>
          <span className="eyebrow"><Camera size={16} /> Creator dashboard</span>
          <h2>Turn comments, keywords, and story replies into DM flows.</h2>
          <p>Simulate onboarding, automate replies, capture leads, and sell digital products from one local dashboard.</p>
          <div className="hero-actions">
            <button className="primary" type="button" onClick={startInstagramConnect}>
              <Camera size={17} />
              {connectedAccount ? 'Reconnect Instagram' : 'Connect Instagram Account'}
            </button>
            <button className="secondary" type="button" onClick={() => setActivePage('settings')}>
              <Settings size={17} />
              View account
            </button>
          </div>
        </div>
        <img
          src="https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?auto=format&fit=crop&w=700&q=80"
          alt="Instagram content planning dashboard"
        />
      </section>

      <section className="panel checklist">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Onboarding</span>
            <h3>4 steps to launch</h3>
          </div>
          <strong>50%</strong>
        </div>
        <div className="big-progress"><span /></div>
        {['Connect Instagram', 'Verify WhatsApp', 'Create Automation', 'Send Auto DM'].map((step, index) => (
          <div className="check-row" key={step}>
            <span className={(index === 0 && connectedAccount) || index === 1 ? 'done' : ''}>
              {(index === 0 && connectedAccount) || index === 1 ? <Check size={15} /> : index + 1}
            </span>
            <p>{step}</p>
          </div>
        ))}
      </section>

      <div className="quick-actions">
        <ActionCard title="Auto DM from Comments" badge="Popular" icon={MessageCircle} onClick={() => setActivePage('automations')} />
        <ActionCard title="Grow Followers" badge="Trending, Pro" icon={UserPlus} onClick={() => setActivePage('automations')} />
        <ActionCard title="Generate Leads" badge="Pro" icon={Mail} onClick={() => setActivePage('contacts')} />
        <ActionCard title="Auto-reply DMs" badge="Live" icon={Bot} onClick={() => setActivePage('automations')} />
      </div>

      <section className="panel metrics-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Last 7 days</span>
            <h3>Performance metrics</h3>
          </div>
          <button className="secondary" type="button">Last 7 days <ChevronDown size={16} /></button>
        </div>
        <div className="metric-grid">
          <Metric label="Messages Sent" value={metrics.messagesSent} delta="Real DB" icon={MessageCircle} />
          <Metric label="Messages Seen" value={metrics.messagesSeen} delta="Real DB" icon={Eye} />
          <Metric label="Total Clicks" value={metrics.totalClicks} delta="Real DB" icon={Link} />
          <Metric label="Followers Gained" value={metrics.followersGained} delta="Real DB" icon={UserPlus} />
        </div>
      </section>

      <section className="panel upgrade-panel">
        <CircleDollarSign size={32} />
        <div>
          <h3>Pro unlocks unlimited DMs, unlimited contacts, re-trigger, lead gen, follow-up messages, and branding removal.</h3>
          <p>Monthly starts at ₹499. Annual locks the price at ₹399/mo.</p>
        </div>
        <button className="primary" type="button" onClick={() => setActivePage('pricing')}>View plans</button>
      </section>
    </div>
  )
}

function ActionCard({ title, badge, icon: Icon, onClick }) {
  return (
    <button className="action-card" type="button" onClick={onClick}>
      <Icon size={24} />
      <span>{badge}</span>
      <strong>{title}</strong>
    </button>
  )
}

function Metric({ label, value, delta, icon: Icon }) {
  return (
    <div className="metric">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{delta}</small>
    </div>
  )
}

function AutomationsPage(props) {
  const triggers = [
    'User comments on post or reel',
    'User DMs to you',
    'User comments on your LIVE',
    'User replies to your stories',
    'User mentions you in story',
  ]

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Core feature</span>
            <h3>Automation list</h3>
          </div>
          <button className="primary" type="button" onClick={() => props.setBuilderOpen(true)}>
            <Plus size={17} />
            Create
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last modified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.automations.map((item, index) => (
                <tr key={`${item.name}-${index}`}>
                  <td><div className="thumb placeholder-thumb"><Bot size={18} /></div></td>
                  <td>
                    <strong>{item.name}</strong>
                    <span>{item.trigger}</span>
                  </td>
                  <td>
                    <button className={`status-pill ${item.status === 'active' ? 'on' : ''}`} type="button" onClick={() => props.toggleAutomation(index)}>
                      {item.status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      {item.status === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>{formatDate(item.created_at)}</td>
                  <td>{formatDate(item.updated_at)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" type="button" aria-label="View user data"><Eye size={17} /></button>
                      <button className="icon-button" type="button" aria-label="Edit"><Edit3 size={17} /></button>
                      <button className="icon-button danger" type="button" aria-label="Delete"><Trash2 size={17} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!props.automations.length && <div className="empty-state">No real automations yet. Create your first automation to save it in the database.</div>}
        <div className="pagination">
          <span>Rows per page: 10</span>
          <span>{props.automations.length} records</span>
        </div>
      </section>

      {props.builderOpen && (
        <section className="panel builder">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Edit page</span>
              <h3>Automation builder</h3>
            </div>
            <button className="icon-button" type="button" aria-label="Close builder" onClick={() => props.setBuilderOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="builder-grid">
            <div>
              <h4>Step 1 - Select a Trigger</h4>
              <div className="trigger-list">
                {triggers.map((trigger) => (
                  <button
                    className={props.selectedTrigger === trigger ? 'selected' : ''}
                    key={trigger}
                    type="button"
                    disabled={trigger.includes('mentions')}
                    onClick={() => props.setSelectedTrigger(trigger)}
                  >
                    <Camera size={18} />
                    <span>{trigger}</span>
                    {trigger.includes('mentions') && <small>Coming soon</small>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4>Step 2 - Response Flow</h4>
              <div className="flow-card">
                <div className="panel-heading compact">
                  <strong>Opening Message</strong>
                  <button className="status-pill on" type="button" onClick={() => props.setOpeningEnabled(!props.openingEnabled)}>
                    {props.openingEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    {props.openingEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                <textarea defaultValue="Hey! Thanks for commenting. Tap below and I will send the resource instantly." />
                <button className="secondary" type="button"><Link size={16} /> CTA button: Get the link</button>
              </div>
              <button className="add-response" type="button"><Plus size={18} /> Add Response</button>
              <div className="flow-card locked">
                <div>
                  <strong>Follow-up Message</strong>
                  <span>Pro only · delay from 1 min to 23 hr 30 min</span>
                </div>
                <button className="secondary" type="button">Unlock</button>
              </div>
              <div className="builder-footer">
                <button className={`status-pill ${props.automationActive ? 'on' : ''}`} type="button" onClick={() => props.setAutomationActive(!props.automationActive)}>
                  {props.automationActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  {props.automationActive ? 'Active' : 'Inactive'}
                </button>
                <button className="primary" type="button" onClick={props.addAutomation}>Save Changes</button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function ContactsPage({ contacts }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">CRM</span>
          <h3>Instagram contacts</h3>
          <p>Contact list stores all Instagram accounts that have interacted with you.</p>
        </div>
        <button className="secondary" type="button"><Users size={16} /> 1,000 contacts/month</button>
      </div>
      <div className="cards-list">
        {contacts.map((contact) => (
          <div className="contact-row" key={contact.handle}>
            <div className="avatar">{getInitials(contact.name || contact.handle || 'IG')}</div>
            <div>
              <strong>{contact.name || contact.handle || 'Instagram user'}</strong>
              <span>{contact.instagram_user_id || contact.handle || 'No handle yet'}</span>
            </div>
            <p>{contact.source}</p>
            <p>{formatDate(contact.last_seen_at)}</p>
            <small>{contact.status}</small>
          </div>
        ))}
      </div>
      {!contacts.length && <div className="empty-state">No real contacts yet. Contacts will appear after Instagram users trigger webhooks.</div>}
    </section>
  )
}

function ProductsPage({ products }) {
  return (
    <div className="stack">
      <div className="metric-grid two">
        <Metric label="Total Purchases" value="0" delta="Real DB" icon={Package} />
        <Metric label="Total Revenue" value="INR 0" delta="Real DB" icon={Wallet} />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Creator commerce</span>
            <h3>Digital products</h3>
          </div>
          <button className="primary" type="button"><Plus size={17} /> Create</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Sales</th>
                <th>Revenue</th>
                <th>Payments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.name}</strong><span>Real product</span></td>
                  <td>{formatMoney(product.price, product.currency)}</td>
                  <td>0</td>
                  <td>INR 0</td>
                  <td><span className={`status-pill ${product.payments_enabled ? 'on' : ''}`}>{product.payments_enabled ? 'Enabled' : 'KYC needed'}</span></td>
                  <td><div className="row-actions"><button className="icon-button" type="button" aria-label="Copy link"><Copy size={17} /></button><button className="icon-button" type="button" aria-label="More"><MoreHorizontal size={17} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!products.length && <div className="empty-state">No real products yet. Product creation can be connected to this database next.</div>}
      </section>
    </div>
  )
}

function OrdersPage({ orders }) {
  return (
    <div className="stack">
      <div className="metric-grid two">
        <Metric label="Net Revenue" value="INR 0" delta="After 10% commission" icon={BarChart3} />
        <Metric label="Balance" value="INR 0" delta="Available for payout" icon={Wallet} />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Sales</span>
            <h3>Orders</h3>
          </div>
          <button className="primary" type="button"><Wallet size={17} /> Request Payout</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Customer Email</th><th>Product</th><th>Amount</th><th>Payout Amount</th></tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{formatDate(order.created_at)}</td><td>{order.customer_email}</td><td>{order.product_name}</td><td>{formatMoney(order.amount, order.currency)}</td><td>{formatMoney(order.payout_amount, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!orders.length && <div className="empty-state">No real orders yet. Orders will appear after payment integration is connected.</div>}
      </section>
    </div>
  )
}

function ReferPage() {
  return (
    <section className="panel refer-panel">
      <Gift size={38} />
      <div>
        <span className="eyebrow">Affiliate program</span>
        <h2>Earn 25% commission for every paid user referred for the first 11 months.</h2>
        <p>Your referral link is ready for tracking clicks, signups, and paid conversions.</p>
      </div>
      <div className="copy-box">
        <code>https://linkplease.co?af=LPLOCAL</code>
        <button className="primary" type="button"><Copy size={17} /> Copy Link</button>
      </div>
      <div className="empty-state">0 referrals yet. Referred customers will appear here with commission status.</div>
    </section>
  )
}

function SettingsPage({
  settingsTab,
  setSettingsTab,
  connectedAccount,
  startInstagramConnect,
  disconnectInstagram,
  loadConnectedAccount,
}) {
  return (
    <section className="panel">
      <div className="tabs">
        {['general', 'instagram', 'billing'].map((tab) => (
          <button className={settingsTab === tab ? 'active' : ''} key={tab} type="button" onClick={() => setSettingsTab(tab)}>
            {tab}
          </button>
        ))}
      </div>
      {settingsTab === 'general' && (
        <div className="form-grid">
          {['First Name', 'Last Name', 'Email', 'Phone Number'].map((field) => (
            <label key={field}>{field}<input defaultValue={field === 'Email' ? 'creator@example.com' : ''} placeholder={field} /></label>
          ))}
        </div>
      )}
      {settingsTab === 'instagram' && (
        <div className="instagram-settings">
          {connectedAccount ? (
            <div className="account-card">
              <img
                src={connectedAccount.profilePictureUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=180&q=80'}
                alt="Connected creator account"
              />
              <div>
                <strong>{connectedAccount.username ? `@${connectedAccount.username}` : 'Instagram connected'}</strong>
                <span>Page: {connectedAccount.facebookPageName || connectedAccount.facebookPageId || 'Waiting for Page data'}</span>
                <span>ID: {connectedAccount.instagramAccountId || 'Not returned yet'}</span>
              </div>
              <button className="secondary success" type="button" onClick={loadConnectedAccount}><RefreshCw size={16} /> Refresh</button>
              <button className="secondary danger-text" type="button" onClick={disconnectInstagram}>Disconnect</button>
            </div>
          ) : (
            <div className="connect-card">
              <Camera size={36} />
              <div>
                <h3>Connect your Instagram account</h3>
                <p>Users click this button, log in with Meta/Instagram, approve permissions, and the connected account appears here.</p>
              </div>
              <button className="primary" type="button" onClick={startInstagramConnect}>
                <Camera size={17} />
                Connect Instagram Account
              </button>
            </div>
          )}
          <div className="empty-state">
            Admin must first add Meta App ID, App Secret, Redirect URI, and webhook details in Admin Dashboard.
          </div>
        </div>
      )}
      {settingsTab === 'billing' && (
        <div className="billing-state">
          <CreditCard size={34} />
          <h3>No Active Subscription</h3>
          <p>Activate Pro to remove limits and unlock lead gen, re-trigger, follow-up messages, and branding removal.</p>
          <button className="primary" type="button">Activate Subscription</button>
          <div className="empty-state">Invoice history will appear after your first payment.</div>
        </div>
      )}
    </section>
  )
}

function LearnPage() {
  return (
    <div className="stack">
      <section className="panel academy-hero">
        <div>
          <span className="eyebrow">Essentials - Start Here</span>
          <h2>Creator Academy for Instagram growth and DM sales.</h2>
          <p>Pro users get masterclasses for follower growth, 200-300 automated DMs/day, high-comment reels, and product sales.</p>
        </div>
        <button className="primary" type="button"><Sparkles size={17} /> Unlock Pro</button>
      </section>
      <div className="video-grid">
        {videos.map((video) => (
          <article className="video-card" key={video.title}>
            <img src={video.image} alt="" />
            <div>
              <span>{video.tag}</span>
              <h3>{video.title}</h3>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function PricingPage() {
  return (
    <section className="panel pricing">
      <div className="plans">
        {[
          ['Free', '₹0', 'Email support'],
          ['Pro Monthly', '₹499/mo', 'Priority support'],
          ['Pro Annual', '₹399/mo', 'Save ₹1,200/yr'],
          ['Enterprise', 'Contact', 'Dedicated support'],
        ].map((plan, index) => (
          <div className={`plan ${index === 2 ? 'featured' : ''}`} key={plan[0]}>
            <span>{plan[0]}</span>
            <strong>{plan[1]}</strong>
            <p>{plan[2]}</p>
            <button className={index === 2 ? 'primary' : 'secondary'} type="button">{index === 3 ? 'Contact sales' : 'Choose plan'}</button>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Feature</th><th>Free</th><th>Pro Monthly</th><th>Pro Annual</th><th>Enterprise</th></tr></thead>
          <tbody>
            {planRows.map((row) => (
              <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default App

function formatDate(value) {
  if (!value) return 'Not yet'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value))
}

function formatMoney(value = 0, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(value / 100)
}

function getInitials(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'IG'
}



