import React, { useState } from 'react'

export default function Login({onLogin}){
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  return (
    <div className="max-w-md mx-auto mt-20 bg-white p-6 rounded shadow">
      <h2 className="text-xl mb-4">Enter Mopay PIN</h2>
      <input value={pin} onChange={e=>setPin(e.target.value)} placeholder="PIN" className="w-full p-2 border rounded mb-2" />
      <div className="flex justify-end gap-2">
        <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={()=>{ if(pin.length<8){ setError('PIN must be at least 8 chars'); return } onLogin(pin) }}>Login</button>
      </div>
      {error && <p className="text-red-600 mt-2">{error}</p>}
    </div>
  )
}
