import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Box, Loader2, Save, Trash2 } from 'lucide-react';

export default function Conversions({ session }) {
  const [unites, setUnites] = useState([]);
  const [newUnite, setNewUnite] = useState({ nom: '', unite_mesure: '', facteur: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUnites();
  }, []);

  const fetchUnites = async () => {
    if (!session?.user) return;
    const { data } = await supabase.from('unites_standards').select('*').order('nom');
    if (data) setUnites(data);
  };

  const addUnite = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('unites_standards').insert([{ ...newUnite, user_id: session.user.id }]);
    if (error) alert(error.message);
    else {
      setNewUnite({ nom: '', unite_mesure: '', facteur: '' });
      fetchUnites();
    }
    setLoading(false);
  };

  const deleteUnite = async (id) => {
    const { error } = await supabase.from('unites_standards').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchUnites();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 bg-white/60 backdrop-blur-md border border-emerald-50 rounded-[2.5rem] p-8 md:p-12 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <Box className="text-emerald-600" size={28} />
        <h2 className="text-2xl font-black text-gray-800">Gestion des Unités Standards</h2>
      </div>
      
      <form onSubmit={addUnite} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom (ex: Bidon)</label>
          <input required type="text" className="w-full bg-white border border-emerald-100 rounded-2xl py-3 px-4 text-sm font-bold" value={newUnite.nom} onChange={(e) => setNewUnite({...newUnite, nom: e.target.value})} />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Unité (ex: Litre)</label>
          <input required type="text" className="w-full bg-white border border-emerald-100 rounded-2xl py-3 px-4 text-sm font-bold" value={newUnite.unite_mesure} onChange={(e) => setNewUnite({...newUnite, unite_mesure: e.target.value})} />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Facteur</label>
          <input required type="number" className="w-full bg-white border border-emerald-100 rounded-2xl py-3 px-4 text-sm font-bold" value={newUnite.facteur} onChange={(e) => setNewUnite({...newUnite, facteur: e.target.value})} />
        </div>
        <button type="submit" disabled={loading} className="bg-emerald-600 text-white rounded-2xl py-3 px-6 font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
          {loading ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Ajouter</>}
        </button>
      </form>

      <div className="border-t border-emerald-50 pt-8">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] text-gray-400 uppercase">
              <th className="pb-4">Nom</th>
              <th className="pb-4">Unité Mesure</th>
              <th className="pb-4">Facteur</th>
              <th className="pb-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {unites.map(u => (
              <tr key={u.id}>
                <td className="py-4 text-sm font-bold text-gray-700">{u.nom}</td>
                <td className="py-4 text-sm text-gray-600">{u.unite_mesure}</td>
                <td className="py-4 text-sm text-gray-600">{u.facteur}</td>
                <td className="py-4 text-sm">
                  <button onClick={() => deleteUnite(u.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
