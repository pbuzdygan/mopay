import React, { useState } from 'react'
import GridEditor from './components/GridEditor'
import Dashboard from './components/Dashboard'
import ImportExport from './components/ImportExport'

export default function App(){
  const [tab, setTab] = useState('expenses')
  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Mopay</h1>
      </header>

      <nav className="flex gap-2 mb-4">
        <button className={`px-3 py-1 rounded ${tab==='expenses'?'bg-blue-600 text-white':''}`} onClick={()=>setTab('expenses')}>Expenses</button>
        <button className={`px-3 py-1 rounded ${tab==='incomes'?'bg-blue-600 text-white':''}`} onClick={()=>setTab('incomes')}>Incomes</button>
        <button className={`px-3 py-1 rounded ${tab==='dashboard'?'bg-blue-600 text-white':''}`} onClick={()=>setTab('dashboard')}>Dashboard</button>
        <button className={`px-3 py-1 rounded ${tab==='import'?'bg-blue-600 text-white':''}`} onClick={()=>setTab('import')}>Import/Export</button>
      </nav>

      {tab === 'dashboard' && <Dashboard />}
      {tab === 'expenses' && <GridEditor type={'expense'} />}
      {tab === 'incomes' && <GridEditor type={'income'} />}
      {tab === 'import' && <ImportExport />}
    </div>
  )
}
