import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Box, Save, Loader2, CheckCircle, MapPin } from 'lucide-react';

export default function Depots() {
  const [depots, setDepots] = useState([]);
  const [newDepot, setNewDepot] = useState({ name: '', location: '' });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchDepots();
  }, []);

  const fetchDepots = async () => {
    const { data } = await supabase.from('depots').select('*');
    if (data) setDepots(data);
  };

  const handleAddDepot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('depots').insert([newDepot]);
      if (error) throw error;
      setNewDepot({ name: '', location: '' });
      fetchDepots();
      setSuccessMessage('Dépôt ajouté !');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {successMessage && (
        <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle size={20} />
          <span className="font-bold text-sm">{successMessage}</span>
        </div>
      )}

      <div className="bg-white/60 backdrop-blur-md border border-emerald-50 rounded-[2.5rem] p-8 shadow-sm">
        <h2 className="text-xl font-black text-gray-800 mb-8">Gestion des Dépôts</h2>
        <div className="space-y-8">
          <form onSubmit={handleAddDepot} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom du dépôt</label>
              <input required type="text" className="w-full bg-white border border-emerald-100 rounded-2xl py-3 px-4 text-sm font-bold" value={newDepot.name} onChange={(e) => setNewDepot({...newDepot, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Localisation</label>
              <input type="text" className="w-full bg-white border border-emerald-100 rounded-2xl py-3 px-4 text-sm font-bold" value={newDepot.location} onChange={(e) => setNewDepot({...newDepot, location: e.target.value})} />
            </div>
            <button type="submit" disabled={loading} className="bg-emerald-600 text-white rounded-2xl py-3 px-6 font-bold hover:bg-emerald-700 transition-all">
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Ajouter'}
            </button>
          </form>
          <div className="border-t border-emerald-50 pt-8">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-gray-400 uppercase text-left">
                  <th className="pb-4">Nom</th>
                  <th className="pb-4">Localisation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {depots.map(d => (
                  <tr key={d.id}>
                    <td className="py-4 text-sm font-bold text-gray-700">{d.name}</td>
                    <td className="py-4 text-sm text-gray-600">{d.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
