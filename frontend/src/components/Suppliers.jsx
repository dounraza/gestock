import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Trash2, Truck, Search, Mail, Phone, MapPin, Loader2 } from 'lucide-react';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data } = await supabase.from('fournisseurs').select('*').order('name');
    if (data) {
      setSuppliers(data);
      setFilteredSuppliers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (editingSupplier) {
      const { error } = await supabase
        .from('fournisseurs')
        .update(formData)
        .eq('id', editingSupplier.id);
      
      if (error) alert(error.message);
      else {
        resetForm();
        fetchSuppliers();
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('fournisseurs').insert([{ ...formData, user_id: user.id }]);
      if (error) alert(error.message);
      else {
        resetForm();
        fetchSuppliers();
      }
    }
    setIsSubmitting(false);
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', address: '' });
    setEditingSupplier(null);
    setShowModal(false);
  };

  const deleteSupplier = async (id) => {
    if (confirm('Supprimer ce fournisseur ?')) {
      await supabase.from('fournisseurs').delete().eq('id', id);
      fetchSuppliers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-emerald-50">
        <div className="flex gap-4 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un fournisseur..." 
              className="w-full bg-white border border-emerald-100 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500/10 transition-all outline-none" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-emerald-100">
          <Plus size={18} /> <span>Nouveau Fournisseur</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="col-span-full text-center py-20 text-gray-400">Chargement des fournisseurs...</p>
        ) : filteredSuppliers.length > 0 ? (
          filteredSuppliers.map((s) => (
            <div key={s.id} className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group relative">
              <div className="absolute top-4 right-4 flex gap-2">
                <button onClick={() => handleEdit(s)} className="p-2 text-gray-300 hover:text-emerald-600 transition-colors">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => deleteSupplier(s.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <Truck size={28} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-800">{s.name}</h4>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Partenaire Pharma</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail size={16} className="text-emerald-400" />
                  <span className="text-sm truncate">{s.email || 'Pas d\'email'}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <Phone size={16} className="text-emerald-400" />
                  <span className="text-sm">{s.phone || 'Pas de téléphone'}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <MapPin size={16} className="text-emerald-400" />
                  <span className="text-sm truncate">{s.address || 'Pas d\'adresse'}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-emerald-50">
                <button className="w-full py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors">
                  Voir les commandes
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-20 bg-white/40 border-2 border-dashed border-emerald-100 rounded-3xl">
            <Truck className="mx-auto text-emerald-200 mb-4" size={48} />
            <p className="text-gray-500 font-medium">Aucun fournisseur trouvé.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">
                {editingSupplier ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-4">
              <input required placeholder="Nom du Laboratoire / Fournisseur" className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input type="email" placeholder="Email contact" className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              <input placeholder="Téléphone" className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              <textarea placeholder="Adresse du siège..." className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}></textarea>
              <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-100 mt-4 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingSupplier ? "Mettre à jour" : "Enregistrer le fournisseur")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

