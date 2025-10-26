import React, { useState } from 'react'
import Login from './components/Login'
import GridEditor from './components/GridEditor'
import Dashboard from './components/Dashboard'
import ImportExport from './components/ImportExport'

export default function App(){
  const [pin, setPin] = useState(localStorage.getItem('mopay_pin') || '')
  const [tab, setTab] = useState('expenses')

  if(!pin) return <Login onLogin={(p)=>{ localStorage.setItem('mopay_pin', p); setPin(p) }} />

  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Mopay</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={()=>{ localStorage.removeItem('mopay_pin'); setPin('') }}>Logout</button>
        </div>
      </header>

      <nav className="flex gap-2 mb-4">
        <button className={`px-3 py-1 rounded ${tab==='expenses'?'bg-blue-600 text-white':''}`} onClick={()=>setTab('expenses')}>Expenses</button>
        <button className={`px-3 py-1 rounded ${tab==='incomes'?'bg-blue-600 text-white':''}`} onClick={()=>setTab('incomes')}>Incomes</button>
        <button className={`px-3 py-1 rounded ${tab==='dashboard'?'bg-blue-600 text-white':''}`} onClick={()=>setTab('dashboard')}>Dashboard</button>
        <button className={`px-3 py-1 rounded ${tab==='import'?'bg-blue-600 text-white':''}`} onClick={()=>setTab('import')}>Import/Export</button>
      </nav>

      {tab === 'dashboard' && <Dashboard pin={pin} />}
      {tab === 'expenses' && <GridEditor pin={pin} type={'expense'} />}
      {tab === 'incomes' && <GridEditor pin={pin} type={'income'} />}
      {tab === 'import' && <ImportExport pin={pin} />}
    </div>
  )
}
