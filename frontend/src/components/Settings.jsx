import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserPlus, Building2, Save, Loader2, CheckCircle, Mail, Lock, User, MapPin, Phone, Hash, Box } from 'lucide-react';

export default function Settings({ session }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Profile State
  const [profile, setProfile] = useState({
    company_name: '',
    address: '',
    phone: '',
    nif: '',
    stat: ''
  });

  // New User State
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (data) {
      setProfile({
        company_name: data.company_name || '',
        address: data.address || '',
        phone: data.phone || '',
        nif: data.nif || '',
        stat: data.stat || ''
      });
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(profile)
        .eq('id', session.user.id);

      if (error) throw error;
      setSuccessMessage('Profil mis à jour !');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            full_name: newUser.fullName
          }
        }
      });

      if (authError) throw authError;

      setSuccessMessage('Utilisateur créé avec succès !');
      setNewUser({ email: '', password: '', fullName: '' });
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Tabs */}
      <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-[2rem] border border-emerald-50 shadow-sm">
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-xs font-black transition-all ${activeTab === 'profile' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'text-gray-500 hover:bg-emerald-50'}`}
        >
          <Building2 size={18} /> INFOS ENTREPRISE
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-xs font-black transition-all ${activeTab === 'users' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'text-gray-500 hover:bg-emerald-50'}`}
        >
          <UserPlus size={18} /> GÉRER UTILISATEURS
        </button>
      </div>

      {successMessage && (
        <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle size={20} />
          <span className="font-bold text-sm">{successMessage}</span>
        </div>
      )}

      <div className="bg-white/60 backdrop-blur-md border border-emerald-50 rounded-[2.5rem] p-8 md:p-12 shadow-sm">
        {activeTab === 'profile' ? (
          <form onSubmit={handleUpdateProfile} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom de l'entreprise</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                  <input 
                    type="text" required
                    className="w-full bg-white border border-emerald-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                    value={profile.company_name}
                    onChange={(e) => setProfile({...profile, company_name: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Adresse</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                  <input 
                    type="text"
                    className="w-full bg-white border border-emerald-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                    value={profile.address}
                    onChange={(e) => setProfile({...profile, address: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                  <input 
                    type="text"
                    className="w-full bg-white border border-emerald-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                    value={profile.phone}
                    onChange={(e) => setProfile({...profile, phone: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">NIF</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                  <input 
                    type="text"
                    className="w-full bg-white border border-emerald-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                    value={profile.nif}
                    onChange={(e) => setProfile({...profile, nif: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">STAT</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                  <input 
                    type="text"
                    className="w-full bg-white border border-emerald-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                    value={profile.stat}
                    onChange={(e) => setProfile({...profile, stat: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <button 
              type="submit" disabled={loading}
              className="w-full md:w-auto px-12 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Enregistrer les infos</>}
            </button>
          </form>
        ) : activeTab === 'conversion' ? (
          <div className="space-y-8">
            <form onSubmit={addConversion} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-1 space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Produit</label>
                <select required className="w-full bg-white border border-emerald-100 rounded-2xl py-3 px-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 outline-none" value={newConversion.product_id} onChange={(e) => setNewConversion({...newConversion, product_id: e.target.value})}>
                  <option value="">Sélectionner...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Unité Secondaire</label>
                <input required type="text" placeholder="ex: Carton" className="w-full bg-white border border-emerald-100 rounded-2xl py-3 px-4 text-sm font-bold" value={newConversion.unite_secondaire} onChange={(e) => setNewConversion({...newConversion, unite_secondaire: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Facteur</label>
                <input required type="number" placeholder="ex: 20" className="w-full bg-white border border-emerald-100 rounded-2xl py-3 px-4 text-sm font-bold" value={newConversion.facteur} onChange={(e) => setNewConversion({...newConversion, facteur: e.target.value})} />
              </div>
              <button type="submit" className="bg-emerald-600 text-white rounded-2xl py-3 px-6 font-bold hover:bg-emerald-700 transition-all">Ajouter</button>
            </form>
            <div className="border-t border-emerald-50 pt-8">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-gray-400 uppercase text-left">
                    <th className="pb-4">Produit</th>
                    <th className="pb-4">Unité</th>
                    <th className="pb-4">Facteur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {conversions.map(c => (
                    <tr key={c.id}>
                      <td className="py-4 text-sm font-bold text-gray-700">{products.find(p => p.id === c.product_id)?.name || 'Produit inconnu'}</td>
                      <td className="py-4 text-sm text-gray-600">{c.unite_secondaire}</td>
                      <td className="py-4 text-sm text-gray-600">{c.facteur}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateUser} className="space-y-8">
            <div className="space-y-6 max-w-lg mx-auto">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                  <input 
                    type="text" required
                    className="w-full bg-white border border-emerald-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                  <input 
                    type="email" required
                    className="w-full bg-white border border-emerald-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mot de passe provisoire</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                  <input 
                    type="password" required minLength={6}
                    className="w-full bg-white border border-emerald-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
              </div>
              <button 
                type="submit" disabled={loading}
                className="w-full px-12 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <><UserPlus size={20} /> Créer l'utilisateur</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
