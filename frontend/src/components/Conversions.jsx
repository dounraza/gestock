import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Box, Loader2, Save, Trash2, Edit2, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Conversions({ session }) {
  const [unites, setUnites] = useState([]);
  const [newUnite, setNewUnite] = useState({ nom: '', unite_mesure: '', facteur: '' });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchUnites();
  }, []);

  const fetchUnites = async () => {
    if (!session?.user) return;
    const { data, error } = await supabase.from('unites_standards').select('*').order('nom');
    if (error) {
      console.error("Error fetching units:", error);
    }
    if (data) setUnites(data);
  };

  // Filter and Paginate
  const filteredUnites = unites.filter(u => 
    u.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.unite_mesure.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const totalPages = Math.ceil(filteredUnites.length / itemsPerPage);
  const paginatedUnites = filteredUnites.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const addUnite = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
          const { error } = await supabase.from('unites_standards').update(newUnite).eq('id', editingId);
          if (error) alert(error.message);
          setEditingId(null);
      } else {
          const { error } = await supabase.from('unites_standards').insert([{ ...newUnite, user_id: session.user.id }]);
          if (error) alert(error.message);
      }
      setNewUnite({ nom: '', unite_mesure: '', facteur: '' });
      fetchUnites();
    } catch (err) {
      alert("Erreur: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setNewUnite({ nom: u.nom, unite_mesure: u.unite_mesure, facteur: u.facteur });
  };

  const deleteUnite = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette unité ? Cela pourrait affecter les produits qui l\'utilisent.')) return;
    
    try {
      const { error } = await supabase.from('unites_standards').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') {
          alert("Impossible de supprimer cette unité car elle est utilisée par un ou plusieurs produits.");
        } else {
          alert("Erreur lors de la suppression : " + error.message);
        }
      } else {
        fetchUnites();
      }
    } catch (err) {
      alert("Erreur inattendue : " + err.message);
    }
  };

  return (
    <div className="h-full overflow-y-auto pr-2">
      <div className="max-w-4xl mx-auto space-y-8 bg-white/60 backdrop-blur-md border border-emerald-50 rounded-[2.5rem] p-8 md:p-12 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Box className="text-emerald-600" size={28} />
          <h2 className="text-3xl font-black text-gray-800">Gestion des Unités Standards</h2>
        </div>
        
        <form onSubmit={addUnite} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-[16px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom (ex: Bidon)</label>
            <input required type="text" className="w-full bg-white border border-emerald-100 rounded-2xl py-3 px-4 text-lg font-bold shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none" value={newUnite.nom} onChange={(e) => setNewUnite({...newUnite, nom: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-[16px] font-black text-gray-400 uppercase tracking-widest ml-1">Unité (ex: Litre)</label>
            <input required type="text" className="w-full bg-white border border-emerald-100 rounded-2xl py-3 px-4 text-lg font-bold shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none" value={newUnite.unite_mesure} onChange={(e) => setNewUnite({...newUnite, unite_mesure: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-[16px] font-black text-gray-400 uppercase tracking-widest ml-1">Facteur</label>
            <input required type="number" className="w-full bg-white border border-emerald-100 rounded-2xl py-3 px-4 text-lg font-bold shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none" value={newUnite.facteur} onChange={(e) => setNewUnite({...newUnite, facteur: e.target.value})} />
          </div>
          <button type="submit" disabled={loading} className="bg-emerald-600 text-white rounded-2xl py-3 px-6 font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 disabled:bg-gray-400">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> {editingId ? 'Mettre à jour' : 'Ajouter'}</>}
          </button>
        </form>

        <div className="border-t border-emerald-50 pt-8 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
                type="text" 
                placeholder="Rechercher par nom ou unité..." 
                className="w-full bg-white border border-emerald-100 rounded-2xl py-3 px-12 text-lg font-bold shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                value={searchTerm} 
                onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} 
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[16px] text-gray-400 uppercase border-b border-emerald-50">
                  <th className="pb-4 font-black tracking-widest">Nom</th>
                  <th className="pb-4 font-black tracking-widest">Unité Mesure</th>
                  <th className="pb-4 font-black tracking-widest">Facteur</th>
                  <th className="pb-4 font-black tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {paginatedUnites.map(u => (
                  <tr key={u.id} className="group hover:bg-emerald-50/30 transition-colors">
                    <td className="py-4 text-lg font-bold text-gray-700">{u.nom}</td>
                    <td className="py-4 text-lg text-gray-600 font-medium">{u.unite_mesure}</td>
                    <td className="py-4 text-lg text-emerald-600 font-black">{u.facteur}</td>
                    <td className="py-4 text-lg text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(u)} className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all" title="Modifier"><Edit2 size={18} /></button>
                        <button onClick={() => deleteUnite(u.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-xl transition-all" title="Supprimer"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedUnites.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-10 text-center text-gray-400 font-bold uppercase text-[16px] tracking-widest">Aucune unité standard enregistrée</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-emerald-50 rounded-xl disabled:opacity-50"><ChevronLeft size={20} className="text-emerald-600" /></button>
                <span className="font-bold text-gray-600">Page {currentPage} sur {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-emerald-50 rounded-xl disabled:opacity-50"><ChevronRight size={20} className="text-emerald-600" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
