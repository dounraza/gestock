import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar as CalendarIcon, Clock, User, AlertCircle, CheckCircle, Search, FileText, List, LayoutGrid, Table, DollarSign, Loader2, X } from 'lucide-react';

export default function Deadlines({ initialSearchTerm, onSearchReset }) {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [viewMode, setViewMode] = useState('cards'); // 'cards', 'table', 'calendar'
  const [currentDate, setCurrentDate] = useState(new Date());

  const [paymentModal, setPaymentModal] = useState(null); // { echeance: ... }
  const [paymentInfo, setPaymentInfo] = useState({
    method: 'espece',
    reference: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  const fetchDeadlines = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('echeances_details')
        .select(`
          *,
          factures (
            number,
            guest_name,
            clients (name, phone)
          )
        `)
        .eq('statut', 'non_paye')
        .order('date_echeance', { ascending: true });
      
      if (error) {
        console.error(error);
        if (error.code === '42P01') alert("Table manquante");
      }
      if (data) setDeadlines(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const handleMarkAsPaid = async () => {
    if (!paymentModal || !paymentModal.echeance) return;
    const { echeance } = paymentModal;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('echeances_details')
        .update({ 
          statut: 'paye'
        })
        .eq('id', echeance.id);
      
      if (error) throw error;

      // Vérifier si toutes les échéances de cette facture sont payées
      const { data: remaining } = await supabase
        .from('echeances_details')
        .select('id')
        .eq('facture_id', echeance.facture_id)
        .eq('statut', 'non_paye');

      if (remaining && remaining.length === 0) {
        await supabase.from('factures').update({ status: 'paid' }).eq('id', echeance.facture_id);
      }
      
      setPaymentModal(null);
      setPaymentInfo({ method: 'espece', reference: '' });
      fetchDeadlines();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = deadlines.filter(d => 
    d.factures?.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.factures?.clients?.name || d.factures?.guest_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Groupement par facture pour la vue "Cards"
  const groupedInvoices = filtered.reduce((acc, current) => {
    const factId = current.facture_id;
    if (!acc[factId]) {
      acc[factId] = {
        facture_id: factId,
        number: current.factures?.number,
        client_name: current.factures?.clients?.name || current.factures?.guest_name || 'Client Direct',
        total_remaining: 0,
        installments: [],
        next_due_date: current.date_echeance
      };
    }
    acc[factId].total_remaining += current.montant;
    acc[factId].installments.push(current);
    return acc;
  }, {});

  const groupedList = Object.values(groupedInvoices);

  // Calendrier Logic
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return { firstDay: (firstDay === 0 ? 6 : firstDay - 1), days };
  };
  const { firstDay, days } = getDaysInMonth(currentDate);

  return (
    <div className="space-y-6">
      {/* Header avec les 3 Boutons de Vue */}
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-emerald-50 gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <CalendarIcon className="text-emerald-600" size={24} /> Échéancier
          </h3>
          <div className="flex bg-emerald-100/50 p-1 rounded-xl border border-emerald-100/50">
            <button 
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${viewMode === 'cards' ? 'bg-white text-emerald-700 shadow-sm' : 'text-emerald-600 hover:bg-white/50'}`}
            >
              <LayoutGrid size={14} /> CARTES
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${viewMode === 'table' ? 'bg-white text-emerald-700 shadow-sm' : 'text-emerald-600 hover:bg-white/50'}`}
            >
              <Table size={14} /> TABLEAU
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${viewMode === 'calendar' ? 'bg-white text-emerald-700 shadow-sm' : 'text-emerald-600 hover:bg-white/50'}`}
            >
              <CalendarIcon size={14} /> CALENDRIER
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          {viewMode === 'calendar' && (
            <div className="flex items-center bg-white border border-emerald-100 rounded-xl px-2 py-1 gap-4 shadow-sm">
              <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-600">←</button>
              <span className="text-xs font-black uppercase text-emerald-800 min-w-[120px] text-center">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
              <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-600">→</button>
            </div>
          )}
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un client ou FAC..." 
              className="w-full bg-white border border-emerald-100 rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                onSearchReset?.();
              }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center"><p className="text-gray-400 font-bold animate-pulse">Chargement des données...</p></div>
      ) : (
        <>
          {/* VUE CARTES (Groupées par facture) */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-300">
              {groupedList.length > 0 ? groupedList.map((inv) => {
                const nextInst = inv.installments[0];
                const daysLeft = Math.ceil((new Date(inv.next_due_date) - new Date()) / (1000 * 60 * 60 * 24));
                const isOverdue = daysLeft < 0;
                return (
                  <div key={inv.facture_id} className={`bg-white border ${isOverdue ? 'border-red-200 shadow-red-50' : 'border-emerald-100/50'} rounded-3xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`w-10 h-10 ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'} rounded-xl flex items-center justify-center shadow-sm`}>
                        <Clock size={20} />
                      </div>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${isOverdue ? 'bg-red-500 text-white' : 'bg-orange-100 text-orange-700'}`}>
                        {isOverdue ? "Retard" : "En cours"}
                      </span>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-black text-gray-800 text-sm">{inv.number}</h4>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate">{inv.client_name}</p>
                      {inv.installments[0].factures?.clients?.phone && (
                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-1">📞 {inv.installments[0].factures.clients.phone}</p>
                      )}
                    </div>
                    
                    <div className="bg-emerald-50/30 p-3 rounded-xl mb-4 flex justify-between items-center border border-emerald-50/50">
                      <div>
                        <p className="text-[7px] font-black text-emerald-600 uppercase leading-none">Reste</p>
                        <p className="text-sm font-black text-emerald-900">{inv.total_remaining.toLocaleString()} Ar</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[7px] font-black text-emerald-600 uppercase leading-none">Mens.</p>
                        <p className="text-[10px] font-black text-emerald-700">{inv.installments.length}</p>
                      </div>
                    </div>

                    <div className="mt-auto space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <p className="text-[8px] font-black text-gray-400 uppercase">Prochaine</p>
                        <p className={`text-[9px] font-black ${isOverdue ? 'text-red-500' : 'text-emerald-600'}`}>
                          {new Date(inv.next_due_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setSearchTerm(inv.client_name);
                            setViewMode('calendar');
                          }}
                          className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center justify-center shrink-0 border border-blue-100/50"
                          title="Voir le calendrier"
                        >
                          <CalendarIcon size={14} />
                        </button>
                        <button 
                          onClick={() => setPaymentModal({ echeance: nextInst })}
                          className={`flex-1 h-10 ${isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2`}
                        >
                          <CheckCircle size={14} /> {nextInst.montant.toLocaleString()} Ar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }) : <EmptyState />}
            </div>
          )}

          {/* VUE TABLEAU (Liste détaillée) */}
          {viewMode === 'table' && (
            <div className="bg-white/80 backdrop-blur-md border border-emerald-50 rounded-[2.5rem] overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-300">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-emerald-50/50 border-b border-emerald-100">
                    <th className="p-4 text-[10px] font-black text-emerald-700 uppercase">Date</th>
                    <th className="p-4 text-[10px] font-black text-emerald-700 uppercase">Facture</th>
                    <th className="p-4 text-[10px] font-black text-emerald-700 uppercase">Client</th>
                    <th className="p-4 text-[10px] font-black text-emerald-700 uppercase">Montant</th>
                    <th className="p-4 text-[10px] font-black text-emerald-700 uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {filtered.length > 0 ? filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="p-4 text-xs font-bold text-gray-600">{new Date(d.date_echeance).toLocaleDateString()}</td>
                      <td className="p-4 text-xs font-black text-gray-800">{d.factures?.number}</td>
                      <td className="p-4 text-xs font-bold text-gray-500">{d.factures?.clients?.name || d.factures?.guest_name || 'Direct'}</td>
                      <td className="p-4 text-xs font-black text-emerald-700">{d.montant.toLocaleString()} Ar</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setSearchTerm(d.factures?.clients?.name || d.factures?.guest_name || '');
                              setViewMode('calendar');
                            }}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            title="Voir le calendrier de ce client"
                          >
                            <CalendarIcon size={14} />
                          </button>
                          <button 
                            onClick={() => setPaymentModal({ echeance: d })}
                            className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                            title="Encaisser"
                          >
                            <CheckCircle size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan="5" className="p-10 text-center text-gray-400">Aucune donnée</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* VUE CALENDRIER */}
          {viewMode === 'calendar' && (
            <div className="bg-white/80 backdrop-blur-md border border-emerald-100 rounded-[2.5rem] p-8 shadow-xl animate-in zoom-in duration-300">
              <div className="grid grid-cols-7 mb-4">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(day => (
                  <div key={day} className="text-center text-[10px] font-black text-emerald-800 uppercase tracking-widest py-2">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-emerald-50 border border-emerald-50 rounded-2xl overflow-hidden">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-emerald-50/30 h-32"></div>
                ))}
                {Array.from({ length: days }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayDeadlines = filtered.filter(d => d.date_echeance === dateStr);
                  const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

                  return (
                    <div key={day} className="bg-white h-32 p-2 border border-emerald-50/50 hover:bg-emerald-50/20 group relative overflow-y-auto transition-all">
                      <span className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg ${isToday ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400'}`}>{day}</span>
                      <div className="mt-1 space-y-1">
                        {dayDeadlines.map(d => (
                          <div key={d.id} onClick={() => setPaymentModal({ echeance: d })} className="bg-emerald-50 border border-emerald-100 p-1.5 rounded-xl cursor-pointer hover:border-emerald-500 transition-all shadow-sm">
                            <p className="text-[8px] font-black text-emerald-700 truncate">{d.factures?.clients?.name || d.factures?.guest_name || 'Client'}</p>
                            <p className="text-[9px] font-black text-gray-800">{d.montant.toLocaleString()} Ar</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Encaissement</h3>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{paymentModal.echeance.factures?.number}</p>
              </div>
              <button onClick={() => setPaymentModal(null)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="bg-emerald-50 p-6 rounded-3xl text-center border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Montant à encaisser</p>
                <p className="text-3xl font-black text-emerald-900">{paymentModal.echeance.montant.toLocaleString()} Ar</p>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Moyen de paiement</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'espece', label: 'Espèces' },
                    { id: 'mvola', label: 'M-Vola' },
                    { id: 'airtel', label: 'Airtel Money' },
                    { id: 'orange', label: 'Orange Money' },
                    { id: 'bank', label: 'Banque / Virement' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPaymentInfo({ ...paymentInfo, method: m.id })}
                      className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase border transition-all ${
                        paymentInfo.method === m.id 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.02]' 
                          : 'bg-white text-gray-500 border-gray-100 hover:bg-emerald-50 hover:border-emerald-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentInfo.method !== 'espece' && (
                <div className="space-y-1 animate-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Référence de transaction</label>
                  <input 
                    type="text"
                    placeholder="Ex: Ref 123456..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                    value={paymentInfo.reference}
                    onChange={(e) => setPaymentInfo({ ...paymentInfo, reference: e.target.value })}
                  />
                </div>
              )}

              <button 
                onClick={handleMarkAsPaid}
                disabled={isProcessing}
                className="w-full bg-emerald-600 text-white font-black text-[10px] uppercase tracking-[0.2em] py-4 rounded-2xl shadow-lg shadow-emerald-100 mt-2 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle size={18} /> Confirmer l'encaissement</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full text-center py-20 bg-white/40 border-2 border-dashed border-emerald-100 rounded-3xl">
      <CalendarIcon className="mx-auto text-emerald-200 mb-4" size={48} />
      <p className="text-gray-500 font-medium uppercase text-xs font-black tracking-widest">Aucune échéance trouvée</p>
    </div>
  );
}
