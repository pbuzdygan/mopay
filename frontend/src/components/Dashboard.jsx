import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { API } from '../lib/api'
import { Chart, BarController, BarElement, CategoryScale, LinearScale } from 'chart.js'
Chart.register(BarController, BarElement, CategoryScale, LinearScale)

export default function Dashboard(){
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState(null)

  useEffect(()=>{ fetchData() }, [year])
  async function fetchData(){
    const res = await axios.get(`${API}/api/dashboard?year=${year}`)
    setData(res.data)
  }

  useEffect(()=>{
    if(!data) return
    const ctx = document.getElementById('barChart')
    if(!ctx) return
    new Chart(ctx, { type: 'bar', data: { labels: ['Income','Expense'], datasets: [{ label: 'PLN', data: [data.income_total, data.expense_total] }] } })
  }, [data])

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
            <canvas id="barChart"></canvas>
          </div>
        </div>
      )}
    </div>
  )
}
