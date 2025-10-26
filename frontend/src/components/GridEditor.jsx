import React, { useEffect, useState } from 'react'
import axios from 'axios'

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

export default function GridEditor({pin, type}){
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState(null)

  useEffect(()=>{ fetchData() }, [year, type])

  async function fetchData(){
    const res = await axios.get(`/api/data?year=${year}&type=${type}`, { headers: { 'X-MOPAY-PIN': pin } })
    setData(res.data)
  }

  async function onCellChange(category_id, item_id, month, value){
    await axios.post('/api/entry', { year, month, amount: value, comment:'', type, category_id, item_id }, { headers:{ 'X-MOPAY-PIN': pin } })
    fetchData()
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-2">
          <div className="flex gap-2">
            <button className="btn" onClick={()=>setYear(y=>y-1)}>◀</button>
            <div className="font-medium">{year}</div>
            <button className="btn" onClick={()=>setYear(y=>y+1)}>▶</button>
          </div>
        </div>
        {!data && <div>Loading...</div>}
        {data && (
          <table className="min-w-full bg-white border">
            <thead><tr><th className="text-left p-2">Category / Item</th>{MONTHS.map(m=><th key={m} className="p-2">{m}</th>)}<th className="p-2">Sum</th><th className="p-2">Avg</th></tr></thead>
            <tbody>
              {data.grid.map(cat=> (
                <React.Fragment key={cat.category_id}>
                  <tr className="bg-gray-100"><td colSpan={14} className="p-2 font-semibold">{cat.category}</td></tr>
                  {cat.items.map(it=>{
                    const sum = it.months.reduce((a,b)=>a+Number(b||0),0)
                    const avg = sum/12
                    return (
                      <tr key={it.item_id}>
                        <td className="p-2">{it.item_name}</td>
                        {it.months.map((v,idx)=>(
                          <td key={idx} className="p-1 text-right">
                            <input className="w-20 text-right px-1" defaultValue={v||''} onBlur={(e)=>onCellChange(cat.category_id, it.item_id, idx+1, Number(e.target.value||0))} />
                          </td>
                        ))}
                        <td className="p-2 text-right">{sum.toFixed(2)}</td>
                        <td className="p-2 text-right">{avg.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </React.Fragment>
              ))}

              <tr className="font-semibold bg-gray-50">
                <td className="p-2">Column sums</td>
                {data.column_sums.map((s,idx)=>(<td key={idx} className="p-2 text-right">{s.toFixed(2)}</td>))}
                <td className="p-2 text-right">{data.total.toFixed(2)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <aside className="w-80 bg-white p-3 rounded shadow">
        <h3 className="font-semibold mb-2">Actions</h3>
        <button className="btn w-full mb-2" onClick={async ()=>{ const name=prompt('Category name'); if(!name) return; const items=prompt('Comma separated items')||''; await axios.post('/api/category', { name, items: items.split(',').map(s=>s.trim()).filter(Boolean) }, { headers:{ 'X-MOPAY-PIN': pin } }); fetchData(); }}>Add category</button>
        <p className="text-sm mt-4">Currency: PLN</p>
      </aside>
    </div>
  )
}
