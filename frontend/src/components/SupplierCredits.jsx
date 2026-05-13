import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Truck, Search, Loader2, Banknote, ChevronDown, ChevronUp } from 'lucide-react';

export default function SupplierCredits() {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    setLoading(true);
    const { data: notes, error: notesError } = await supabase
      .from('delivery_notes')
      .select('*, fournisseurs!delivery_notes_supplier_id_fkey(name)')
      .eq('payment_type', 'credit')
      .order('due_date', { ascending: true });
    
    if (notes) {
        // Débogage : on ajoute l'erreur dans la console
        const { data: items, error: itemsError } = await supabase.from('delivery_note_items').select('*, produits(name)');
        
        console.log("Notes récupérées:", notes);
        console.log("Items récupérés:", items);
        console.log("Erreur Items:", itemsError);
        
        const enrichedCredits = notes.map(n => ({
            ...n,
            delivery_note_items: items?.filter(i => i.delivery_note_id === n.id) || []
        }));
        setCredits(enrichedCredits);
    }
    
    if (notesError) console.error("Erreur récupération crédits:", notesError);
    setLoading(false);
  };

  const handlePay = async (blId) => {
    if(!confirm("Confirmer le paiement de ce crédit ?")) return;
    const { error } = await supabase
        .from('delivery_notes')
        .update({ payment_type: 'paid' })
        .eq('id', blId);
    if (!error) fetchCredits();
    else alert("Erreur lors du paiement");
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredCredits = credits.filter(c => 
    (c.bl_number || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.fournisseurs?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-emerald-50">
        <h2 className="text-xl font-black text-emerald-800 flex items-center gap-2">
            <Truck className="text-emerald-600" /> Suivi des Crédits Fournisseurs
        </h2>
        <input 
          type="text" 
          placeholder="Rechercher..." 
          className="p-2 border rounded-xl w-64 text-sm"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-emerald-50 overflow-hidden">
        {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" /></div>
        ) : (
            <table className="w-full text-sm text-left">
                <thead className="bg-emerald-50 text-emerald-800 uppercase text-[10px] font-black">
                    <tr>
                        <th className="p-4">BL</th>
                        <th className="p-4">Fournisseur</th>
                        <th className="p-4">Échéance</th>
                        <th className="p-4 text-right">Montant</th>
                        <th className="p-4 text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                    {filteredCredits.map(c => {
                        const isOverdue = new Date(c.due_date) < new Date();
                        return (
                        <>
                            <tr key={c.id} className={`hover:bg-emerald-50/30 cursor-pointer ${isOverdue ? 'bg-red-50/20' : ''}`} onClick={() => toggleRow(c.id)}>
                                <td className="p-4 font-bold flex items-center gap-2">
                                    {expandedRows[c.id] ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                    {c.bl_number || 'N/A'}
                                </td>
                                <td className="p-4 font-bold">{c.fournisseurs?.name || 'Inconnu'}</td>
                                <td className={`p-4 font-bold ${isOverdue ? 'text-red-600' : ''}`}>
                                    {new Date(c.due_date).toLocaleDateString()}
                                </td>
                                <td className="p-4 font-black text-right">{c.total_amount.toLocaleString()} Ar</td>
                                <td className="p-4 text-center">
                                    <button onClick={(e) => { e.stopPropagation(); handlePay(c.id); }} className="bg-emerald-600 text-white px-3 py-1 rounded-lg font-bold text-xs uppercase flex items-center gap-1 mx-auto">
                                        <Banknote size={14} /> Payer
                                    </button>
                                </td>
                            </tr>
                            {expandedRows[c.id] && (
                                <tr className="bg-gray-50">
                                    <td colSpan="5" className="p-4">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-gray-400"><th className="p-2">Produit</th><th className="p-2 text-right">Quantité</th></tr>
                                            </thead>
                                            <tbody>
                                                {(c.delivery_note_items || []).map((item, idx) => (
                                                    <tr key={idx} className="border-t">
                                                        <td className="p-2 font-medium">{item.produits?.name || 'Inconnu'}</td>
                                                        <td className="p-2 text-right font-bold">{item.quantity}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            )}
                        </>
                    )})}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
}
