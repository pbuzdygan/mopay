import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Chart, BarController, BarElement, CategoryScale, LinearScale } from 'chart.js'
Chart.register(BarController, BarElement, CategoryScale, LinearScale)

export default function Dashboard({pin}){
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState(null)

  useEffect(()=>{ fetchData() }, [year])
  async function fetchData(){
    const res = await axios.get(`/api/dashboard?year=${year}`, { headers:{ 'X-MOPAY-PIN': pin } })
    setData(res.data)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button className="btn" onClick={()=>setYear(y=>y-1)}>◀</button>
        <div className="font-medium">{year}</div>
        <button className="btn" onClick={()=>setYear(y=>y+1)}>▶</button>
      </div>
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded shadow">
            <h4 className="font-medium">Income</h4>
            <div className="text-xl">PLN {data.income_total.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <h4 className="font-medium">Expenses</h4>
            <div className="text-xl">PLN {data.expense_total.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <h4 className="font-medium">Balance</h4>
            <div className="text-xl">PLN {data.balance.toFixed(2)}</div>
            <div className="text-sm">Spent: {data.percent_spent.toFixed(1)}% of income</div>
          </div>
        </div>
      )}
    </div>
  )
}
