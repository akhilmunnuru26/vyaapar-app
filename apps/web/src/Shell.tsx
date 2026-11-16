import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  IconAlertCircle,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconCreditCard,
  IconDownload,
  IconEdit,
  IconLayoutDashboard,
  IconMenu2,
  IconMessageCircle,
  IconDots,
  IconPlus,
  IconSearch,
  IconSend,
  IconShoppingBag,
  IconBuildingStore,
  IconTrash,
  IconUpload,
  IconUsers,
  IconWallet,
  IconX,
} from '@tabler/icons-react'
import { formatInr } from '@retail-management/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ReportingPeriod, type PeriodValue } from './ReportingPeriod'
import {
  deleteOrder,
  fetchOrders,
  logout,
  mapOrderRow,
  recordPayment,
  type MeResponse,
  type OrderView,
} from './api/client'

const messages = [
  ['Malini Gopal', '+91 9123401234', 'Payment reminder', 'payment_due_v2', 'Today, 10:42 AM', 'Delivered'],
  ['Parvati Sundaram', '+91 9012876543', 'Payment reminder', 'payment_due_v2', 'Yesterday, 4:18 PM', 'Read'],
  ['Neha Chopra', '+91 9876549090', 'Payment received', 'payment_received', '08 Nov 2026, 2:11 PM', 'Sent'],
  ['Tanvi Shah', '+91 9123451234', 'Order confirmation', 'order_confirmation', '06 Nov 2026, 11:30 AM', 'Failed'],
]

type Modal = 'new' | 'edit' | 'payment' | 'reminder' | 'bulk' | null

type AppPage = 'dashboard' | 'orders' | 'messages'

export function Shell({
  initialPage,
  me,
  onLogout,
}: {
  initialPage: AppPage
  me: MeResponse
  onLogout: () => void
}) {
  const navigateTo = useNavigate()
  const queryClient = useQueryClient()
  const [active, setActive] = useState<AppPage>(initialPage)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All orders')
  const [modal, setModal] = useState<Modal>(null)
  const [selected, setSelected] = useState<OrderView | null>(null)
  const [toast, setToast] = useState('')
  const [dateRange, setDateRange] = useState<PeriodValue>({ label: 'This month' })

  const ordersQuery = useQuery({
    queryKey: ['orders', query, status],
    queryFn: () => fetchOrders({ q: query, status }),
    enabled: active === 'orders' || active === 'dashboard',
  })

  useEffect(() => {
    setActive(initialPage)
  }, [initialPage])

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }

  const filteredOrders = useMemo(() => {
    const rows = (ordersQuery.data?.data ?? []).map(mapOrderRow)
    const q = query.toLowerCase()
    return rows.filter((order) => {
      const matchesQuery = !q || `${order.name} ${order.phone} ${order.items}`.toLowerCase().includes(q)
      const matchesStatus =
        status === 'All orders' || order.status === status || (status === 'Overdue' && order.overdue)
      return matchesQuery && matchesStatus
    })
  }, [ordersQuery.data, query, status])

  const openOrder = (kind: Modal, order?: OrderView) => { setSelected(order || null); setModal(kind) }

  const handleLogout = async () => {
    await logout()
    onLogout()
    showToast('You are safely logged out')
  }

  const handleDeleteOrder = async (id: string) => {
    try {
      await deleteOrder(id)
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
      showToast('Order deleted')
    } catch {
      showToast('Could not delete order')
    }
  }

  const handleRecordPayment = async (orderId: string, amountRupees: number) => {
    await recordPayment(orderId, amountRupees)
    await queryClient.invalidateQueries({ queryKey: ['orders'] })
    showToast('Payment recorded successfully')
  }
  const navigate = (page: AppPage) => { setActive(page); setMobileOpen(false); navigateTo(page === 'dashboard' ? '/' : `/${page}`) }

  return <div className="app-shell">
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><IconBuildingStore size={20}/></div><span>Yuvraj Saree Center</span></div>
      <nav className="nav-group">
        <NavItem icon={<IconLayoutDashboard size={18}/>} label="Dashboard" active={active === 'dashboard'} collapsed={collapsed} onClick={() => navigate('dashboard')}/>
        <NavItem icon={<IconShoppingBag size={18}/>} label="Orders" active={active === 'orders'} collapsed={collapsed} onClick={() => navigate('orders')}/>
        <NavItem icon={<IconMessageCircle size={18}/>} label="Message log" active={active === 'messages'} collapsed={collapsed} onClick={() => navigate('messages')}/>
        <div className="nav-separator" />
        <NavItem icon={<IconDownload size={18}/>} label="Download Excel" collapsed={collapsed} onClick={() => showToast('Orders exported to Excel')}/>
        <NavItem icon={<IconUpload size={18}/>} label="Import Excel" collapsed={collapsed} onClick={() => showToast('Choose an .xlsx file to import')}/>
      </nav>
      <button className="logout" type="button" onClick={() => void handleLogout()}><LogOutIcon/><span>Logout</span></button>
    </aside>
    {mobileOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>} 
    <main className={`workspace ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="topbar"><button className="icon-btn menu-toggle" onClick={() => window.innerWidth < 800 ? setMobileOpen(true) : setCollapsed(!collapsed)} aria-label="Toggle navigation"><IconMenu2 size={19}/></button><div><h1>{active === 'dashboard' ? 'Dashboard' : active === 'orders' ? 'Orders' : 'Message Log'}</h1><p>{active === 'dashboard' ? 'Overview' : active === 'orders' ? 'Manage credit sales' : 'WhatsApp communication history'}</p></div><div className="topbar-actions" title={me.user.email}><div className="avatar">{me.user.name.slice(0, 2).toUpperCase()}</div></div></header>
      <div className="page-content">
        {active === 'dashboard' && <Dashboard dateRange={dateRange} setDateRange={setDateRange}/>}
        {active === 'orders' && <OrdersPage orders={filteredOrders} loading={ordersQuery.isLoading} query={query} setQuery={setQuery} status={status} setStatus={setStatus} openOrder={openOrder} onBulk={() => setModal('bulk')} onDelete={(id: string) => void handleDeleteOrder(id)}/>} 
        {active === 'messages' && <MessageLog/>}
      </div>
    </main>
    {modal && (
      <ModalShell
        modal={modal}
        selected={selected}
        close={() => setModal(null)}
        save={(msg) => {
          setModal(null)
          showToast(msg)
        }}
        onRecordPayment={async (amountRupees) => {
          if (!selected) return
          await handleRecordPayment(selected.id, amountRupees)
          setModal(null)
        }}
      />
    )}
    {toast && <div className="toast"><IconCheck size={16}/>{toast}</div>}
  </div>
}

function NavItem({ icon, label, active, collapsed, onClick }: { icon: React.ReactNode; label: string; active?: boolean; collapsed: boolean; onClick: () => void }) { return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} title={collapsed ? label : undefined}>{icon}<span>{label}</span></button> }
function LogOutIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg> }

function Dashboard({ dateRange, setDateRange }: { dateRange: PeriodValue; setDateRange: (v: PeriodValue) => void }) { return <>
  <div className="page-heading-row"><div><h2>Good morning, Yuvraj</h2><p>Here&apos;s what&apos;s happening with your store today.</p></div><div className="date-filter"><ReportingPeriod value={dateRange} onChange={setDateRange}/></div></div>
  <section className="kpi-grid">{[['Total outstanding','₹1,86,300','', IconWallet],['Overdue amount','₹1,37,600','danger', IconAlertCircle],['Overdue customers','13','danger', IconUsers],['Collected so far','₹2,11,900','', IconCreditCard],['Total orders','31','', IconClipboardList]].map(([label, value, tone, Icon]) => <div className={`kpi-card ${tone}`} key={label as string}><div className="kpi-top"><span>{label as string}</span><span className="kpi-icon"><Icon size={16}/></span></div><strong>{value as string}</strong><small>{label === 'Total orders' ? '+4 this month' : label === 'Collected so far' ? '64% of total billed' : 'Across all orders'}</small></div>)}</section>
  <div className="section-title"><div><h3>Sales overview</h3><p>Track order volume and payment progress</p></div><button className="ghost-btn"><IconDots size={18}/></button></div>
  <section className="analytics-grid"><div className="panel chart-panel"><div className="panel-header"><div><h3>Orders by status</h3><p>31 total orders</p></div><span className="chart-kebab">•••</span></div><div className="donut-wrap"><div className="donut"><div className="donut-center"><strong>31</strong><span>orders</span></div></div></div><div className="legend"><span><i className="dot slate"/>Pending <b>6</b></span><span><i className="dot amber"/>Partial <b>17</b></span><span><i className="dot green"/>Paid <b>8</b></span></div></div>
  <div className="panel chart-panel"><div className="panel-header"><div><h3>Orders by month</h3><p>Order date · 2026</p></div><span className="chart-kebab">•••</span></div><div className="bar-chart"><div className="y-axis"><span>15</span><span>10</span><span>5</span><span>0</span></div><div className="bars">{[['Jul','3'],['Aug','4'],['Sep','8'],['Oct','14'],['Nov','2']].map(([month, val]) => <div className="bar-col" key={month}><div className="bar" style={{height: `${Number(val) * 11}px`}}><span>{val}</span></div><small>{month}</small></div>)}</div></div></div></section>
</> }

function OrdersPage({ orders, loading, query, setQuery, status, setStatus, openOrder, onBulk, onDelete }: any) { return <>
  <div className="page-heading-row orders-heading"><div><h2>Order register</h2><p>Stay on top of every sale and collection.</p></div><div className="heading-actions"><button className="btn btn-secondary" onClick={() => openOrder('new')}><IconPlus size={17}/> New order</button><button className="btn btn-success" onClick={onBulk}><IconSend size={16}/> Remind overdue</button></div></div>
  <div className="toolbar"><div className="search-box"><IconSearch size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, phone or items"/></div><div className="filter-select"><select value={status} onChange={e => setStatus(e.target.value)}>{['All orders','Pending','Partial','Paid','Overdue'].map(x => <option key={x}>{x}</option>)}</select><IconChevronDown size={16}/></div></div>
  <div className="table-meta"><span><strong>{orders.length}</strong> orders{loading ? ' · loading…' : ''}</span><button className="export-link"><IconDownload size={15}/> Export view</button></div>
  <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Select all"/></th><th>Customer</th><th>Items</th><th className="num">Amount</th><th className="num">Paid</th><th className="num">Balance</th><th>Status</th><th>Due</th><th>Actions</th></tr></thead><tbody>{orders.length === 0 && !loading ? <tr><td colSpan={9}>No orders yet. Create one or run seed data.</td></tr> : null}{orders.map((order: any) => <tr key={order.id}><td><input type="checkbox" aria-label={`Select ${order.name}`}/></td><td><div className="customer"><strong>{order.name}</strong><span>{order.phone}</span></div></td><td className="items-cell">{order.items}</td><td className="num">{formatInr(order.amount)}</td><td className="num">{formatInr(order.paid)}</td><td className="num balance">{formatInr(order.amount - order.paid)}</td><td><div className="status-stack"><Badge tone={order.status}>{order.status}</Badge>{order.overdue && <Badge tone="Overdue">Overdue</Badge>}</div></td><td className={order.overdue ? 'overdue-date' : ''}>{order.due}</td><td><div className="row-actions"><button title="Record payment" className="mini-btn blue" onClick={() => openOrder('payment', order)}><IconCreditCard size={15}/></button><button title="Send reminder" className="mini-btn green" onClick={() => openOrder('reminder', order)}><IconMessageCircle size={15}/></button><button title="Edit order" className="mini-btn" onClick={() => openOrder('edit', order)}><IconEdit size={15}/></button><button title="Delete order" className="mini-btn red" onClick={() => onDelete(order.id)}><IconTrash size={15}/></button></div></td></tr>)}</tbody></table></div><div className="pagination"><span>Showing 1–{orders.length} of 31</span><div><button className="mini-btn" aria-label="Previous"><IconChevronLeft size={16}/></button><button className="page-number active">1</button><button className="page-number">2</button><button className="page-number">3</button><button className="mini-btn" aria-label="Next"><IconChevronRight size={16}/></button></div></div></div>
</> }
function Badge({ tone, children }: { tone: string; children?: ReactNode }) {
  return <span className={`badge ${tone.toLowerCase()}`}>{children ?? tone}</span>
}

function MessageLog() { const [filter, setFilter] = useState('All messages'); const rows = filter === 'All messages' ? messages : messages.filter(m => filter === 'Failed messages' ? m[5] === 'Failed' : m[2] === filter.replace(' messages','')) ; return <><div className="page-heading-row"><div><h2>Message log</h2><p>WhatsApp communication history</p></div><button className="btn btn-outline"><IconDownload size={16}/> Download log</button></div><div className="message-filters">{['All messages','Payment reminders','Order confirmations','Payment received','Failed messages'].map(x => <button className={filter === x ? 'selected' : ''} onClick={() => setFilter(x)} key={x}>{x}</button>)}</div><div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Customer</th><th>Message type</th><th>Template name</th><th>Sent date / time</th><th>Status</th><th>Details</th></tr></thead><tbody>{rows.map((m, i) => <tr key={i}><td><div className="customer"><strong>{m[0]}</strong><span>{m[1]}</span></div></td><td>{m[2]}</td><td><code>{m[3]}</code></td><td>{m[4]}</td><td><Badge tone={m[5]}/></td><td><button className="icon-btn"><IconDots size={16}/></button></td></tr>)}</tbody></table></div></div></> }

function ModalShell({
  modal,
  selected,
  close,
  save,
  onRecordPayment,
}: {
  modal: Modal
  selected: OrderView | null
  close: () => void
  save: (msg: string) => void
  onRecordPayment?: (amountRupees: number) => Promise<void>
}) {
  const title = modal === 'new' ? 'New order' : modal === 'edit' ? 'Edit order' : modal === 'payment' ? 'Record payment' : modal === 'reminder' ? `Payment reminder to ${selected?.name}` : 'Remind overdue customers'
  const [amount, setAmount] = useState('')
  const [payError, setPayError] = useState('')
  const outstanding = selected ? selected.amount - selected.paid : 0
  const submitPayment = async () => {
    const rupees = Number(amount)
    if (!rupees || rupees <= 0) {
      setPayError('Enter a valid amount')
      return
    }
    if (rupees > outstanding) {
      setPayError('Amount exceeds outstanding balance')
      return
    }
    try {
      await onRecordPayment?.(rupees)
    } catch {
      setPayError('Could not record payment')
    }
  }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}><div className={`modal ${modal === 'bulk' || modal === 'reminder' ? 'compact-modal' : ''}`} role="dialog" aria-modal="true"><div className="modal-header"><h3>{title}</h3><button className="icon-btn" onClick={close} aria-label="Close"><IconX size={18}/></button></div>{(modal === 'new' || modal === 'edit') && <div className="modal-body form-grid"><label>Customer name <em>*</em><input defaultValue={selected?.name}/></label><label>Phone number (WhatsApp) <em>*</em><input defaultValue={selected?.phone}/></label><label className="full">Items <em>*</em><textarea defaultValue={selected?.items}/></label><label>Total amount (₹) <em>*</em><input type="number" defaultValue={selected?.amount}/></label><label>Paid so far (₹)<input type="number" defaultValue={selected?.paid || 0}/></label><label>Order date<input type="date" defaultValue="2026-11-04"/></label><label>Payment due date<input type="date"/></label><label className="full">Notes<textarea /></label></div>}{modal === 'payment' && <div className="modal-body form-grid"><div className="payment-summary full"><span>Current outstanding</span><strong>{formatInr(outstanding)}</strong></div><label>New payment amount (₹) <em>*</em><input type="number" value={amount} onChange={e => setAmount(e.target.value)} max={outstanding}/></label><label>Payment date<input type="date" defaultValue="2026-11-07"/></label><label>Payment method<select><option>UPI</option><option>Cash</option><option>Bank transfer</option><option>Other</option></select></label><label>Notes<input /></label>{payError && <p className="login-error full">{payError}</p>}<details className="full"><summary>Payment history</summary><p>₹{selected?.paid?.toLocaleString('en-IN') || '0'} received previously</p></details></div>}{modal === 'reminder' && <div className="modal-body"><p className="modal-intro">Review the message before sending it to <strong>{selected?.name}</strong>.</p><div className="message-preview">Dear {selected?.name},<br/><br/>This is a courtesy reminder from Yuvraj Saree Center.<br/><br/>An outstanding balance of <strong>{formatInr(outstanding)}</strong> is pending for your purchase of {selected?.items}.<br/><br/>Payment due date: {selected?.due}.<br/><br/>If you have already paid, please ignore this message.<br/><br/>Thank you for your business.</div></div>}{modal === 'bulk' && <div className="modal-body"><div className="bulk-stat"><div className="bulk-icon"><IconUsers size={21}/></div><div><strong>13 overdue customers</strong><span>Total outstanding · ₹1,37,600</span></div></div><div className="warning-box"><IconAlertCircle size={17}/><span>2 customers have not given WhatsApp consent and will be skipped.</span></div><div className="message-preview">Hello, this is a friendly payment reminder from Yuvraj Saree Center. Please review your outstanding balance and contact us if you have already paid.</div></div>}<div className="modal-footer"><button className="btn btn-ghost" onClick={close}>Cancel</button><button type="button" className={`btn ${modal === 'reminder' || modal === 'bulk' ? 'btn-success' : 'btn-secondary'}`} onClick={() => (modal === 'payment' ? void submitPayment() : save(modal === 'bulk' ? 'Reminders queued for sending' : 'Order saved successfully'))}>{modal === 'reminder' || modal === 'bulk' ? <><IconSend size={15}/> {modal === 'bulk' ? 'Confirm & send' : 'Send now'}</> : <><IconCheck size={15}/> {modal === 'edit' ? 'Save changes' : modal === 'payment' ? 'Record payment' : 'Save order'}</>}</button></div></div></div> }
