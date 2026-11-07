'use client'

import { useMemo, useState } from 'react'
import {
  AlertCircle, BarChart3, Bell, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, CreditCard, Download, Edit3, FileSpreadsheet, LayoutDashboard, Menu,
  MessageCircle, MoreHorizontal, Pencil, Plus, Search, Send, Settings2, ShoppingBag,
  Store, Trash2, Upload, Users, Wallet, X, Zap
} from 'lucide-react'

const ordersSeed = [
  { id: 1, name: 'Malini Gopal', phone: '+91 9123401234', items: '3 festival sarees', amount: 11400, paid: 4000, status: 'Partial', due: '29 Oct 2026', overdue: true },
  { id: 2, name: 'Neha Chopra', phone: '+91 9876549090', items: 'Crepe saree (navy)', amount: 3900, paid: 3900, status: 'Paid', due: '20 Nov 2026', overdue: false },
  { id: 3, name: 'Parvati Sundaram', phone: '+91 9012876543', items: 'Heavy bridal set + saree', amount: 52000, paid: 25000, status: 'Partial', due: '13 Oct 2026', overdue: true },
  { id: 4, name: 'Jyoti Mishra', phone: '+91 99888123498', items: 'Chanderi silk saree', amount: 7600, paid: 3600, status: 'Partial', due: '16 Nov 2026', overdue: false },
  { id: 5, name: 'Tanvi Shah', phone: '+91 9123451234', items: 'Bandhani silk saree', amount: 8900, paid: 0, status: 'Pending', due: '31 Oct 2026', overdue: true },
  { id: 6, name: 'Sneha Agarwal', phone: '+91 9871234567', items: '2 chiffon sarees', amount: 5800, paid: 5800, status: 'Paid', due: '19 Nov 2026', overdue: false },
  { id: 7, name: 'Radha Krishnan', phone: '+91 9090901234', items: 'Temple border Kanchipuram', amount: 19800, paid: 9800, status: 'Partial', due: '17 Oct 2026', overdue: true },
  { id: 8, name: 'Chitra Nambiar', phone: '+91 9123459090', items: 'Kalamkari print saree', amount: 4800, paid: 2400, status: 'Partial', due: '09 Nov 2026', overdue: false },
  { id: 9, name: 'Bhavana Hegde', phone: '+91 9876098765', items: 'Mangalagiri cotton saree', amount: 3400, paid: 0, status: 'Pending', due: '01 Dec 2026', overdue: false },
]

const messages = [
  ['Malini Gopal', '+91 9123401234', 'Payment reminder', 'payment_due_v2', 'Today, 10:42 AM', 'Delivered'],
  ['Parvati Sundaram', '+91 9012876543', 'Payment reminder', 'payment_due_v2', 'Yesterday, 4:18 PM', 'Read'],
  ['Neha Chopra', '+91 9876549090', 'Payment received', 'payment_received', '08 Nov 2026, 2:11 PM', 'Sent'],
  ['Tanvi Shah', '+91 9123451234', 'Order confirmation', 'order_confirmation', '06 Nov 2026, 11:30 AM', 'Failed'],
]

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`

type Modal = 'new' | 'edit' | 'payment' | 'reminder' | 'bulk' | null

export default function Page() {
  const [active, setActive] = useState('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All orders')
  const [orders, setOrders] = useState(ordersSeed)
  const [modal, setModal] = useState<Modal>(null)
  const [selected, setSelected] = useState<typeof ordersSeed[0] | null>(null)
  const [toast, setToast] = useState('')
  const [dateRange, setDateRange] = useState('This month')

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const filteredOrders = useMemo(() => orders.filter(order => {
    const q = query.toLowerCase()
    const matchesQuery = !q || `${order.name} ${order.phone} ${order.items}`.toLowerCase().includes(q)
    const matchesStatus = status === 'All orders' || order.status === status || (status === 'Overdue' && order.overdue)
    return matchesQuery && matchesStatus
  }), [orders, query, status])

  const openOrder = (kind: Modal, order?: typeof ordersSeed[0]) => { setSelected(order || null); setModal(kind) }
  const navigate = (page: string) => { setActive(page); setMobileOpen(false) }

  return <div className="app-shell">
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Store size={20}/></div><span>Yuvraj Saree Center</span></div>
      <nav className="nav-group">
        <NavItem icon={<LayoutDashboard size={18}/>} label="Dashboard" active={active === 'dashboard'} collapsed={collapsed} onClick={() => navigate('dashboard')}/>
        <NavItem icon={<ShoppingBag size={18}/>} label="Orders" active={active === 'orders'} collapsed={collapsed} onClick={() => navigate('orders')}/>
        <NavItem icon={<MessageCircle size={18}/>} label="Message log" active={active === 'messages'} collapsed={collapsed} onClick={() => navigate('messages')}/>
        <div className="nav-separator" />
        <NavItem icon={<Download size={18}/>} label="Download Excel" collapsed={collapsed} onClick={() => showToast('Orders exported to Excel')}/>
        <NavItem icon={<Upload size={18}/>} label="Import Excel" collapsed={collapsed} onClick={() => showToast('Choose an .xlsx file to import')}/>
      </nav>
      <button className="logout" onClick={() => showToast('You are safely logged out')}><LogOutIcon/><span>Logout</span></button>
    </aside>
    {mobileOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>} 
    <main className={`workspace ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="topbar"><button className="icon-btn menu-toggle" onClick={() => window.innerWidth < 800 ? setMobileOpen(true) : setCollapsed(!collapsed)} aria-label="Toggle navigation"><Menu size={19}/></button><div><h1>{active === 'dashboard' ? 'Dashboard' : active === 'orders' ? 'Orders' : 'Message Log'}</h1><p>{active === 'dashboard' ? 'Overview' : active === 'orders' ? 'Manage credit sales' : 'WhatsApp communication history'}</p></div><div className="topbar-actions"><div className="avatar">YS</div></div></header>
      <div className="page-content">
        {active === 'dashboard' && <Dashboard dateRange={dateRange} setDateRange={setDateRange}/>} 
        {active === 'orders' && <OrdersPage orders={filteredOrders} query={query} setQuery={setQuery} status={status} setStatus={setStatus} openOrder={openOrder} onBulk={() => setModal('bulk')} onDelete={(id) => { setOrders(orders.filter(o => o.id !== id)); showToast('Order deleted') }}/>} 
        {active === 'messages' && <MessageLog/>}
      </div>
    </main>
    {modal && <ModalShell modal={modal} selected={selected} close={() => setModal(null)} save={(msg) => { setModal(null); showToast(msg) }}/>} 
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function NavItem({ icon, label, active, collapsed, onClick }: { icon: React.ReactNode; label: string; active?: boolean; collapsed: boolean; onClick: () => void }) { return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} title={collapsed ? label : undefined}>{icon}<span>{label}</span></button> }
function LogOutIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg> }

function Dashboard({ dateRange, setDateRange }: { dateRange: string; setDateRange: (v: string) => void }) { return <>
  <div className="page-heading-row"><div><h2>Good morning, Yuvraj</h2><p>Here&apos;s what&apos;s happening with your store today.</p></div><div className="date-filter"><span>Reporting period</span><select value={dateRange} onChange={e => setDateRange(e.target.value)}>{['Today','Yesterday','Last 7 days','This month','Last month','This year','Custom range'].map(x => <option key={x}>{x}</option>)}</select></div></div>
  <section className="kpi-grid">{[['Total outstanding','₹1,86,300','', Wallet],['Overdue amount','₹1,37,600','danger', AlertCircle],['Overdue customers','13','danger', Users],['Collected so far','₹2,11,900','', CreditCard],['Total orders','31','', ClipboardList]].map(([label, value, tone, Icon]) => <div className={`kpi-card ${tone}`} key={label as string}><div className="kpi-top"><span>{label as string}</span><span className="kpi-icon"><Icon size={16}/></span></div><strong>{value as string}</strong><small>{label === 'Total orders' ? '+4 this month' : label === 'Collected so far' ? '64% of total billed' : 'Across all orders'}</small></div>)}</section>
  <div className="section-title"><div><h3>Sales overview</h3><p>Track order volume and payment progress</p></div><button className="ghost-btn"><MoreHorizontal size={18}/></button></div>
  <section className="analytics-grid"><div className="panel chart-panel"><div className="panel-header"><div><h3>Orders by status</h3><p>31 total orders</p></div><span className="chart-kebab">•••</span></div><div className="donut-wrap"><div className="donut"><div className="donut-center"><strong>31</strong><span>orders</span></div></div></div><div className="legend"><span><i className="dot slate"/>Pending <b>6</b></span><span><i className="dot amber"/>Partial <b>17</b></span><span><i className="dot green"/>Paid <b>8</b></span></div></div>
  <div className="panel chart-panel"><div className="panel-header"><div><h3>Orders by month</h3><p>Order date · 2026</p></div><span className="chart-kebab">•••</span></div><div className="bar-chart"><div className="y-axis"><span>15</span><span>10</span><span>5</span><span>0</span></div><div className="bars">{[['Jul','3'],['Aug','4'],['Sep','8'],['Oct','14'],['Nov','2']].map(([month, val]) => <div className="bar-col" key={month}><div className="bar" style={{height: `${Number(val) / 15 * 150}px`}}><span>{val}</span></div><small>{month}</small></div>)}</div></div></div></section>
</> }

function OrdersPage({ orders, query, setQuery, status, setStatus, openOrder, onBulk, onDelete }: any) { return <>
  <div className="page-heading-row orders-heading"><div><h2>Order register</h2><p>Stay on top of every sale and collection.</p></div><div className="heading-actions"><button className="btn btn-secondary" onClick={() => openOrder('new')}><Plus size={17}/> New order</button><button className="btn btn-success" onClick={onBulk}><Send size={16}/> Remind overdue</button></div></div>
  <div className="toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, phone or items"/></div><div className="filter-select"><select value={status} onChange={e => setStatus(e.target.value)}>{['All orders','Pending','Partial','Paid','Overdue'].map(x => <option key={x}>{x}</option>)}</select><ChevronDown size={16}/></div></div>
  <div className="table-meta"><span><strong>{orders.length}</strong> of 31 orders</span><button className="export-link"><Download size={15}/> Export view</button></div>
  <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Select all"/></th><th>Customer</th><th>Items</th><th className="num">Amount</th><th className="num">Paid</th><th className="num">Balance</th><th>Status</th><th>Due</th><th>Actions</th></tr></thead><tbody>{orders.map((order: any) => <tr key={order.id}><td><input type="checkbox" aria-label={`Select ${order.name}`}/></td><td><div className="customer"><strong>{order.name}</strong><span>{order.phone}</span></div></td><td className="items-cell">{order.items}</td><td className="num">{money(order.amount)}</td><td className="num">{money(order.paid)}</td><td className="num balance">{money(order.amount - order.paid)}</td><td><div className="status-stack"><Badge tone={order.status}>{order.status}</Badge>{order.overdue && <Badge tone="Overdue">Overdue</Badge>}</div></td><td className={order.overdue ? 'overdue-date' : ''}>{order.due}</td><td><div className="row-actions"><button title="Record payment" className="mini-btn blue" onClick={() => openOrder('payment', order)}><CreditCard size={15}/></button><button title="Send reminder" className="mini-btn green" onClick={() => openOrder('reminder', order)}><MessageCircle size={15}/></button><button title="Edit order" className="mini-btn" onClick={() => openOrder('edit', order)}><Edit3 size={15}/></button><button title="Delete order" className="mini-btn red" onClick={() => onDelete(order.id)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div><div className="pagination"><span>Showing 1–{orders.length} of 31</span><div><button className="mini-btn" aria-label="Previous"><ChevronLeft size={16}/></button><button className="page-number active">1</button><button className="page-number">2</button><button className="page-number">3</button><button className="mini-btn" aria-label="Next"><ChevronRight size={16}/></button></div></div></div>
</> }
function Badge({ tone }: { tone: string }) { return <span className={`badge ${tone.toLowerCase()}`}>{tone}</span> }

function MessageLog() { const [filter, setFilter] = useState('All messages'); const rows = filter === 'All messages' ? messages : messages.filter(m => filter === 'Failed messages' ? m[5] === 'Failed' : m[2] === filter.replace(' messages','')) ; return <><div className="page-heading-row"><div><h2>Message log</h2><p>WhatsApp communication history</p></div><button className="btn btn-outline"><Download size={16}/> Download log</button></div><div className="message-filters">{['All messages','Payment reminders','Order confirmations','Payment received','Failed messages'].map(x => <button className={filter === x ? 'selected' : ''} onClick={() => setFilter(x)} key={x}>{x}</button>)}</div><div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Customer</th><th>Message type</th><th>Template name</th><th>Sent date / time</th><th>Status</th><th>Details</th></tr></thead><tbody>{rows.map((m, i) => <tr key={i}><td><div className="customer"><strong>{m[0]}</strong><span>{m[1]}</span></div></td><td>{m[2]}</td><td><code>{m[3]}</code></td><td>{m[4]}</td><td><Badge tone={m[5]}/></td><td><button className="icon-btn"><MoreHorizontal size={16}/></button></td></tr>)}</tbody></table></div></div></> }

function ModalShell({ modal, selected, close, save }: { modal: Modal; selected: any; close: () => void; save: (msg: string) => void }) { const title = modal === 'new' ? 'New order' : modal === 'edit' ? 'Edit order' : modal === 'payment' ? 'Record payment' : modal === 'reminder' ? `Payment reminder to ${selected?.name}` : 'Remind overdue customers'; const [amount, setAmount] = useState(''); const outstanding = selected ? selected.amount - selected.paid : 7400; return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}><div className={`modal ${modal === 'bulk' || modal === 'reminder' ? 'compact-modal' : ''}`} role="dialog" aria-modal="true"><div className="modal-header"><h3>{title}</h3><button className="icon-btn" onClick={close} aria-label="Close"><X size={18}/></button></div>{(modal === 'new' || modal === 'edit') && <div className="modal-body form-grid"><label>Customer name <em>*</em><input defaultValue={selected?.name}/></label><label>Phone number (WhatsApp) <em>*</em><input defaultValue={selected?.phone}/></label><label className="full">Items <em>*</em><textarea defaultValue={selected?.items}/></label><label>Total amount (₹) <em>*</em><input type="number" defaultValue={selected?.amount}/></label><label>Paid so far (₹)<input type="number" defaultValue={selected?.paid || 0}/></label><label>Order date<input type="date" defaultValue="2026-11-04"/></label><label>Payment due date<input type="date"/></label><label className="full">Notes<textarea /></label></div>}{modal === 'payment' && <div className="modal-body form-grid"><div className="payment-summary full"><span>Current outstanding</span><strong>{money(outstanding)}</strong></div><label>New payment amount (₹) <em>*</em><input type="number" value={amount} onChange={e => setAmount(e.target.value)} max={outstanding}/></label><label>Payment date<input type="date" defaultValue="2026-11-07"/></label><label>Payment method<select><option>UPI</option><option>Cash</option><option>Bank transfer</option><option>Other</option></select></label><label>Notes<input /></label><details className="full"><summary>Payment history</summary><p>₹{selected?.paid?.toLocaleString('en-IN') || '0'} received previously · 04 Nov 2026</p></details></div>}{modal === 'reminder' && <div className="modal-body"><p className="modal-intro">Review the message before sending it to <strong>{selected?.name}</strong>.</p><div className="message-preview">Dear {selected?.name},<br/><br/>This is a courtesy reminder from Yuvraj Saree Center.<br/><br/>An outstanding balance of <strong>{money(outstanding)}</strong> is pending for your purchase of {selected?.items}.<br/><br/>Payment due date: {selected?.due}.<br/><br/>If you have already paid, please ignore this message.<br/><br/>Thank you for your business.</div></div>}{modal === 'bulk' && <div className="modal-body"><div className="bulk-stat"><div className="bulk-icon"><Users size={21}/></div><div><strong>13 overdue customers</strong><span>Total outstanding · ₹1,37,600</span></div></div><div className="warning-box"><AlertCircle size={17}/><span>2 customers have not given WhatsApp consent and will be skipped.</span></div><div className="message-preview">Hello, this is a friendly payment reminder from Yuvraj Saree Center. Please review your outstanding balance and contact us if you have already paid.</div></div>}<div className="modal-footer"><button className="btn btn-ghost" onClick={close}>Cancel</button><button className={`btn ${modal === 'reminder' || modal === 'bulk' ? 'btn-success' : 'btn-secondary'}`} onClick={() => save(modal === 'payment' ? 'Payment recorded successfully' : modal === 'bulk' ? 'Reminders queued for sending' : 'Order saved successfully')}>{modal === 'reminder' || modal === 'bulk' ? <><Send size={15}/> {modal === 'bulk' ? 'Confirm & send' : 'Send now'}</> : <><Check size={15}/> {modal === 'edit' ? 'Save changes' : modal === 'payment' ? 'Record payment' : 'Save order'}</>}</button></div></div></div> }
