import React, { useRef } from 'react'
import axios from 'axios'
import { API } from '../lib/api'

export default function ImportExport(){
  const fileRef = useRef()

  async function onExport(){
    const res = await axios.get(`${API}/api/export`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = 'mopay_export.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function onImport(){
    const f = fileRef.current.files[0]
    if(!f) return alert('Choose a file')
    const form = new FormData()
    form.append('file', f)
    await axios.post(`${API}/api/import`, form, { headers:{ 'Content-Type': 'multipart/form-data' } })
    alert('Import done. Refresh any open views to see changes.')
  }

  return (
    <div className="max-w-lg bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">Export / Import</h3>
      <div className="flex gap-2 mb-4">
        <button className="btn" onClick={onExport}>Export CSV</button>
      </div>
      <div>
        <input ref={fileRef} type="file" accept=".csv" />
        <div className="mt-2"><button className="btn" onClick={onImport}>Upload CSV</button></div>
      </div>
    </div>
  )
}
