import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, ShoppingCart, Trash2, Package, CheckCircle, Loader2, FileText, Plus, Minus, Clock, User, Tag, List, Send, Phone } from 'lucide-react';

export default function POS({ session }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [discountModal, setDiscountModal] = useState(null);

  const [paymentMode, setPaymentMode] = useState('cash'); 
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentMonths, setInstallmentMonths] = useState(1);

  useEffect(() => {
    fetchProducts();
    fetchClients();
    fetchOrCreateDraftInvoice();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('produits').select('*').order('name');
      if (error) throw error;
      if (data) { setProducts(data); setFilteredProducts(data); }
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('AbortError')) {
        console.warn("Requête annulée (AbortError):", err.message);
        return;
      }
      console.error("Erreur chargement produits POS:", err);
      alert("Erreur Caisse (Produits): " + err.message);
    }
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('name');
    if (data) setClients(data);
  };

  const fetchOrCreateDraftInvoice = async () => {
    if (!session?.user) return;
    const { user } = session;
    const { data: draft } = await supabase.from('factures').select('*').eq('status', 'draft').order('created_at', { ascending: false }).limit(1);
    if (draft && draft.length > 0) {
      setActiveInvoice(draft[0]);
      fetchInvoiceItems(draft[0].id);
    } else {
      const invoiceNumber = `FAC-${Date.now().toString().slice(-6)}`;
      const { data: newInv } = await supabase.from('factures').insert([{ number: invoiceNumber, status: 'draft', total_amount: 0, user_id: user.id }]).select().single();
      if (newInv) setActiveInvoice(newInv);
    }
  };

  const fetchInvoiceItems = async (invoiceId) => {
    const { data } = await supabase.from('facture_items').select('*, produits(*)').eq('facture_id', invoiceId);
    if (data) {
      setInvoiceItems(data.map(item => ({ ...item.produits, quantity: item.quantity, price_at_sale: item.price_at_sale, item_id: item.id, discount: item.discount })));
    }
  };

  const handleClientSelect = async (clientId) => {
    if (!activeInvoice) return;
    
    if (!clientId) {
      // Reset to anonymous
      const updates = { client_id: null, guest_name: 'Anonyme', guest_contact: '', guest_nif: '', guest_stat: '' };
      setActiveInvoice({ ...activeInvoice, ...updates });
      await supabase.from('factures').update(updates).eq('id', activeInvoice.id);
      return;
    }
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const updates = { client_id: client.id, guest_name: client.name, guest_contact: client.phone || '', guest_nif: client.nif || '', guest_stat: client.stat || '' };
      setActiveInvoice({ ...activeInvoice, ...updates });
      await supabase.from('factures').update(updates).eq('id', activeInvoice.id);
    }
  };

  useEffect(() => {
    setFilteredProducts(products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())));
  }, [searchTerm, products]);

  const addToInvoice = async (product, type) => {
    if (!activeInvoice) {
      alert("La commande n'est pas encore prête. Veuillez patienter...");
      return;
    }
    
    const qtyToAdd = type === 'carton' ? (product.quantite_par_unite || 1) : 1;
    if (product.stock_quantity < qtyToAdd) return alert("Stock insuffisant !");
    const existingItem = invoiceItems.find(item => item.id === product.id);
    if (existingItem) {
      const newQty = existingItem.quantity + qtyToAdd;
      await supabase.from('facture_items').update({ quantity: newQty }).eq('id', existingItem.item_id);
      setInvoiceItems(invoiceItems.map(item => item.id === product.id ? { ...item, quantity: newQty } : item));
    } else {
      const { data } = await supabase.from('facture_items').insert([{ facture_id: activeInvoice.id, produit_id: product.id, quantity: qtyToAdd, price_at_sale: product.price }]).select().single();
      if (data) setInvoiceItems([...invoiceItems, { ...product, quantity: qtyToAdd, price_at_sale: product.price, item_id: data.id }]);
    }
  };

  const removeItem = async (itemId, productId) => {
    await supabase.from('facture_items').delete().eq('id', itemId);
    setInvoiceItems(invoiceItems.filter(i => i.id !== productId));
  };

  const updateInvoiceGuestInfo = async (field, value) => {
    setActiveInvoice({ ...activeInvoice, [field]: value });
    await supabase.from('factures').update({ [field]: value }).eq('id', activeInvoice.id);
  };

  const handleFinalize = async () => {
    if (!activeInvoice || invoiceItems.length === 0) return;
    setIsProcessing(true);
    try {
      const currentTotal = invoiceItems.reduce((acc, item) => acc + calculateItemTotal(item), 0);
      const finalPaidAmount = paymentMode === 'cash' ? currentTotal : (parseFloat(advanceAmount) || 0);
      const amountToSchedule = currentTotal - finalPaidAmount;
      
      const guestName = activeInvoice.guest_name || 'Anonyme';
      
      const { data: invData, error: invError } = await supabase.from('factures').update({ 
        status: paymentMode === 'cash' ? 'paid' : 'sent', 
        due_date: dueDate, 
        paid_amount: finalPaidAmount, 
        total_amount: currentTotal,
        guest_name: guestName
      }).eq('id', activeInvoice.id).select().single();
      
      if (invError) throw invError;

      // Update stock levels with safety check
      for (const item of invoiceItems) {
        const newStock = item.stock_quantity - item.quantity;
        if (newStock < 0) {
          throw new Error(`Stock insuffisant pour ${item.name} (${item.stock_quantity} disponibles)`);
        }
        await supabase.from('produits').update({ stock_quantity: newStock }).eq('id', item.id);
      }

      if (paymentMode === 'credit') {
        const echeances = [];
        if (isInstallment && installmentMonths > 1) {
          const monthlyAmount = Math.floor(amountToSchedule / installmentMonths);
          for (let i = 0; i < installmentMonths; i++) {
            const date = new Date(dueDate); 
            date.setMonth(date.getMonth() + i);
            echeances.push({ 
              facture_id: invData.id, 
              montant: i === installmentMonths - 1 ? (amountToSchedule - (monthlyAmount * (installmentMonths - 1))) : monthlyAmount, 
              date_echeance: date.toISOString().split('T')[0], 
              statut: 'non_paye' 
            });
          }
        } else {
          echeances.push({ 
            facture_id: invData.id, 
            montant: amountToSchedule, 
            date_echeance: dueDate, 
            statut: 'non_paye' 
          });
        }
        await supabase.from('echeances_details').insert(echeances);
      }
      
      setShowSuccess(true);
      fetchProducts();
      setInvoiceItems([]);
      setPaymentMode('cash');
      setAdvanceAmount(0);
      setIsInstallment(false);
      setTimeout(() => { setShowSuccess(false); fetchOrCreateDraftInvoice(); }, 2000);
    } catch (e) { alert(e.message); }
    finally { setIsProcessing(false); }
  };

  const calculateItemTotal = (item) => {
    const baseTotal = item.quantity * item.price_at_sale;
    if (!item.discount) return baseTotal;
    return item.discount.type === '%' ? baseTotal - (baseTotal * (parseFloat(item.discount.value) / 100)) : baseTotal - parseFloat(item.discount.value);
  };

  const applyDiscount = (itemId, type, value) => {
    setInvoiceItems(invoiceItems.map(item => item.item_id === itemId ? { ...item, discount: { type, value } } : item));
    setDiscountModal(null);
  };

  const handleReset = async () => {
    if (!activeInvoice || invoiceItems.length === 0) return;
    if (!window.confirm("Êtes-vous sûr de vouloir réinitialiser cette commande ?")) return;
    
    setIsProcessing(true);
    try {
      // Delete all items for this invoice
      await supabase.from('facture_items').delete().eq('facture_id', activeInvoice.id);
      
      // Reset invoice to anonymous
      const updates = { 
        client_id: null, 
        guest_name: 'Anonyme', 
        guest_contact: '', 
        guest_nif: '', 
        guest_stat: '',
        total_amount: 0,
        paid_amount: 0
      };
      await supabase.from('factures').update(updates).eq('id', activeInvoice.id);
      
      // Reset local state
      setInvoiceItems([]);
      setActiveInvoice({ ...activeInvoice, ...updates });
      setPaymentMode('cash');
      setAdvanceAmount(0);
      setIsInstallment(false);
      setSearchTerm('');
    } catch (e) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const total = invoiceItems.reduce((acc, item) => acc + calculateItemTotal(item), 0);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-3">
      {/* 1. TOP BAR: INVOICE # AND CLIENT INFO */}
      <div className="bg-emerald-600 text-white rounded-[2rem] p-3 shadow-lg flex flex-col md:flex-row items-center gap-4 shrink-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b md:border-b-0 md:border-r border-white/20 w-full md:w-auto pb-2 md:pb-0">
          <FileText size={18} />
          <h3 className="font-black text-xs uppercase tracking-widest">{activeInvoice?.number}</h3>
        </div>

        {/* CLIENT SELECTION & QUICK ADD */}
        <div className="flex-1 flex flex-wrap items-center gap-2 w-full">
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-2 py-1 border border-white/10 flex-none w-36">
            <User size={14} className="text-emerald-200" />
            <select 
              className="bg-transparent border-none text-[10px] font-black outline-none w-full cursor-pointer"
              value={activeInvoice?.client_id || ''}
              onChange={(e) => handleClientSelect(e.target.value)}
            >
              <option value="" className="text-gray-900">Anonyme</option>
              {clients.map(c => <option key={c.id} value={c.id} className="text-gray-900">{c.name}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[150px] flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-white shadow-sm">
            <input 
              type="text" placeholder="NOM DU NOUVEAU CLIENT..." 
              className="bg-transparent border-none text-[11px] font-black outline-none placeholder:text-emerald-600/40 w-full text-emerald-900 uppercase" 
              value={activeInvoice?.guest_name === 'Anonyme' ? '' : activeInvoice?.guest_name || ''} 
              onChange={(e) => updateInvoiceGuestInfo('guest_name', e.target.value)} 
            />
          </div>

          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-white shadow-sm">
            <Phone size={12} className="text-emerald-600" />
            <input type="text" placeholder="TÉLÉPHONE" className="bg-transparent border-none text-[11px] font-black outline-none placeholder:text-emerald-600/40 w-28 text-emerald-900" value={activeInvoice?.guest_contact || ''} onChange={(e) => updateInvoiceGuestInfo('guest_contact', e.target.value)} />
          </div>
        </div>

        <div className="flex items-baseline gap-3 px-4 border-t md:border-t-0 md:border-l border-white/20 w-full md:w-auto pt-2 md:pt-0 justify-between md:justify-start">
          <span className="text-[10px] font-black opacity-90 uppercase text-white">Total:</span>
          <span className="text-2xl font-black text-red-500 bg-white px-4 py-1 rounded-2xl shadow-lg border-2 border-red-100 flex items-center gap-1">
            {total.toLocaleString()} <span className="text-xs opacity-60">Ar</span>
          </span>
        </div>
      </div>

      {/* 2. INVOICE ITEMS (TOP TABLE) */}
      <div className="flex-[0.8] bg-white border border-emerald-100 rounded-[2rem] shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-2 sm:p-0">
          {/* Mobile View: Cards for Invoice Items */}
          <div className="grid grid-cols-1 gap-2 sm:hidden">
            {invoiceItems.map(item => (
              <div key={item.item_id} className="bg-emerald-50/30 border border-emerald-50 rounded-2xl p-3 flex flex-col gap-2 relative">
                <button 
                  onClick={() => removeItem(item.item_id, item.id)} 
                  className="absolute top-3 right-3 text-red-300 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
                
                <div className="pr-8">
                  <p className="font-black uppercase text-[11px] text-gray-800 leading-tight">{item.name}</p>
                  <p className="text-[9px] font-bold text-gray-400 italic">
                    {item.quantite_par_unite > 1 ? `${Math.floor(item.quantity / item.quantite_par_unite)} ${item.unite_superieure || 'Ctn'} + ${item.quantity % item.quantite_par_unite} ${item.unite_base || 'Pce'}` : `${item.quantity} ${item.unite_base || 'Pce'}`}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-1 pt-2 border-t border-emerald-100/50">
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-[7px] font-black text-gray-400 uppercase leading-none mb-0.5">Qté</p>
                      <p className="text-[11px] font-black text-emerald-600">{item.quantity}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[7px] font-black text-gray-400 uppercase leading-none mb-0.5">Remise</p>
                      <button onClick={() => setDiscountModal({ itemId: item.item_id, name: item.name, total: item.quantity * item.price_at_sale, value: item.discount?.value || 0, type: item.discount?.type || '%' })} className={`text-[10px] font-black ${item.discount ? 'text-orange-500' : 'text-gray-300'}`}>
                        {item.discount ? `${item.discount.value}${item.discount.type}` : '0%'}
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[7px] font-black text-gray-400 uppercase leading-none mb-0.5">Sous-total</p>
                    <p className="text-[12px] font-black text-gray-800">{calculateItemTotal(item).toLocaleString()} Ar</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View: Table */}
          <table className="w-full text-left min-w-[600px] hidden sm:table">
            <thead className="sticky top-0 bg-gray-50 border-b border-emerald-50 z-10">
              <tr className="text-[9px] font-black text-emerald-700 uppercase">
                <th className="p-3 pl-6">Produit</th>
                <th className="p-3 text-center">Qté</th>
                <th className="p-3 text-center">Détails Unités</th>
                <th className="p-3 text-right">Remise</th>
                <th className="p-3 text-right pr-6">Total</th>
                <th className="p-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50">
              {invoiceItems.map(item => (
                <tr key={item.item_id} className="text-xs hover:bg-emerald-50/10 transition-colors">
                  <td className="p-3 pl-6 font-black uppercase text-gray-800">{item.name}</td>
                  <td className="p-3 text-center font-black text-emerald-600">{item.quantity}</td>
                  <td className="p-3 text-center text-[9px] font-bold text-gray-400 italic">
                    {item.quantite_par_unite > 1 ? `${Math.floor(item.quantity / item.quantite_par_unite)} ${item.unite_superieure || 'Ctn'} + ${item.quantity % item.quantite_par_unite} ${item.unite_base || 'Pce'}` : `${item.quantity} ${item.unite_base || 'Pce'}`}
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => setDiscountModal({ itemId: item.item_id, name: item.name, total: item.quantity * item.price_at_sale, value: item.discount?.value || 0, type: item.discount?.type || '%' })} className={`font-black ${item.discount ? 'text-orange-500' : 'text-gray-300 hover:text-emerald-500'}`}>
                      {item.discount ? `${item.discount.value}${item.discount.type}` : <Tag size={12} className="ml-auto" />}
                    </button>
                  </td>
                  <td className="p-3 text-right font-black pr-6">{calculateItemTotal(item).toLocaleString()} Ar</td>
                  <td className="p-3 text-right"><button onClick={() => removeItem(item.item_id, item.id)} className="text-red-200 hover:text-red-500 mr-4"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. MIDDLE CONTROL BAR (PAYMENT & VALIDATION) */}
      <div className="bg-emerald-950 text-white rounded-[2rem] p-3 flex flex-col gap-3 shadow-xl border border-white/5 shrink-0">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* MODE DE PAIEMENT */}
            <div className="flex bg-emerald-900/50 p-1 rounded-2xl border border-white/10 w-full sm:w-auto">
              <button onClick={() => setPaymentMode('cash')} className={`flex-1 sm:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${paymentMode === 'cash' ? 'bg-emerald-500 text-white' : 'text-emerald-400'}`}>COMPTANT</button>
              <button onClick={() => setPaymentMode('credit')} className={`flex-1 sm:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${paymentMode === 'credit' ? 'bg-orange-500 text-white' : 'text-emerald-400'}`}>CRÉDIT</button>
            </div>

            {/* PARAMÈTRES CRÉDIT (EN LIGNE) */}
            {paymentMode === 'credit' && (
              <div className="flex flex-wrap items-center gap-4 animate-in slide-in-from-left-4 w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                  <Clock size={12} className="text-orange-400" />
                  <input type="date" className="bg-transparent text-[10px] font-black outline-none" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                  <Tag size={12} className="text-emerald-400" />
                  <input type="number" placeholder="Avance" className="bg-transparent text-[10px] font-black outline-none w-20 text-emerald-400" value={advanceAmount || ''} onChange={e => setAdvanceAmount(e.target.value)} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" id="inst" className="w-3.5 h-3.5 accent-emerald-500" checked={isInstallment} onChange={e => setIsInstallment(e.target.checked)} />
                    <label htmlFor="inst" className="text-[9px] font-black uppercase text-emerald-300">Échelonner</label>
                  </div>
                  {isInstallment && (
                    <div className="flex items-center gap-2 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                      <select className="bg-emerald-800 text-[10px] font-black rounded px-1 py-0.5 border border-white/5" value={installmentMonths} onChange={e => setInstallmentMonths(parseInt(e.target.value))}>
                        {[1,2,3,4,5,6,12].map(m => <option key={m} value={m}>{m} mois</option>)}
                      </select>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-emerald-400 leading-none">
                          {Math.floor((total - (parseFloat(advanceAmount) || 0)) / installmentMonths).toLocaleString()} Ar
                        </span>
                        <span className="text-[7px] font-bold text-emerald-500 uppercase opacity-60">/ mois</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button 
              onClick={handleReset}
              disabled={invoiceItems.length === 0 || isProcessing}
              className="flex-1 lg:flex-none px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-emerald-400 hover:text-red-400 hover:bg-white/5 transition-all disabled:opacity-30 border border-emerald-400/20 lg:border-none"
            >
              Réinitialiser
            </button>
            <button 
              onClick={handleFinalize} 
              disabled={!activeInvoice || invoiceItems.length === 0 || isProcessing}
              className={`flex-1 lg:flex-none px-12 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg ${paymentMode === 'cash' ? 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950' : 'bg-orange-500 hover:bg-orange-400 text-white'}`}
            >
              {isProcessing ? <Loader2 className="animate-spin" size={16} /> : (paymentMode === 'cash' ? <CheckCircle size={16} /> : <Send size={16} />)}
              {paymentMode === 'cash' ? "Valider" : "Crédit"}
            </button>
          </div>
        </div>
      </div>

      {/* 4. PRODUCT SEARCH (BOTTOM) */}
      <div className="flex-1 bg-white border border-emerald-100 rounded-[2rem] shadow-sm flex flex-col overflow-hidden min-h-0">
        <div className="p-3 border-b border-emerald-50 bg-emerald-50/20 flex items-center gap-4 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" size={16} />
            <input type="text" placeholder="Ajouter un produit..." className="w-full bg-white border border-emerald-100 rounded-xl py-2 pl-10 pr-4 text-xs font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-2 sm:p-0">
          {/* Mobile View: Cards */}
          <div className="grid grid-cols-1 gap-2 sm:hidden pb-4">
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-gray-50/50 border border-emerald-50 rounded-2xl p-3 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black uppercase text-[11px] text-gray-800 leading-tight">{p.name}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase">{p.categories?.name}</p>
                  </div>
                  <p className="font-black text-emerald-600 text-[11px]">{p.price.toLocaleString()} Ar</p>
                </div>
                
                <div className="flex items-center justify-between gap-2">
                  <div className="bg-emerald-100/50 px-2 py-1 rounded-lg">
                    <p className="text-[8px] font-black text-emerald-700 uppercase leading-none mb-0.5">Stock</p>
                    <p className="text-[10px] font-bold text-emerald-600 truncate">
                      {p.quantite_par_unite > 1 ? `${Math.floor(p.stock_quantity / p.quantite_par_unite)} ${p.unite_superieure || 'Ctn'} + ${p.stock_quantity % p.stock_quantity} ${p.unite_base || 'Pce'}` : `${p.stock_quantity} ${p.unite_base || 'Pce'}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => addToInvoice(p, 'piece')} className="bg-white border border-emerald-100 text-emerald-700 px-3 py-2 rounded-xl text-[9px] font-black uppercase shadow-sm">+{p.unite_base || 'PCE'}</button>
                    {p.quantite_par_unite > 1 && <button onClick={() => addToInvoice(p, 'carton')} className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase shadow-md transition-all">+{p.unite_superieure || 'CTN'}</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View: Table */}
          <table className="w-full text-left min-w-[500px] hidden sm:table">
            <thead className="sticky top-0 bg-gray-50 border-b border-emerald-50 z-10">
              <tr className="text-[9px] font-black text-gray-400 uppercase">
                <th className="p-3 pl-6">Produit</th>
                <th className="p-3">Stock</th>
                <th className="p-3 text-right">Prix</th>
                <th className="p-3 text-right pr-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-emerald-50/20 transition-colors group text-[11px]">
                  <td className="p-3 pl-6 font-black uppercase text-gray-800">{p.name} <span className="text-[8px] text-gray-300 font-bold ml-2">({p.categories?.name})</span></td>
                  <td className="p-3 font-bold text-emerald-600">
                    {p.quantite_par_unite > 1 ? `${Math.floor(p.stock_quantity / p.quantite_par_unite)} ${p.unite_superieure || 'Ctn'} + ${p.stock_quantity % p.quantite_par_unite} ${p.unite_base || 'Pce'}` : `${p.stock_quantity} ${p.unite_base || 'Pce'}`}
                  </td>
                  <td className="p-3 text-right font-black">{p.price.toLocaleString()} Ar</td>
                  <td className="p-3 text-right pr-6">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => addToInvoice(p, 'piece')} className="bg-white border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:border-emerald-500 transition-all shadow-sm">{p.unite_base || 'PCE'}</button>
                      {p.quantite_par_unite > 1 && <button onClick={() => addToInvoice(p, 'carton')} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-700 shadow-md transition-all">{p.unite_superieure || 'CTN'}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Success & Discount Modals remain same but updated Z-Index */}
      {showSuccess && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-500/90 backdrop-blur-md animate-in fade-in duration-300"><div className="text-center text-white scale-in-center"><CheckCircle size={80} className="mx-auto mb-4" /><h2 className="text-4xl font-black uppercase">Vente Terminée !</h2></div></div>}
      {discountModal && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-emerald-950/40 backdrop-blur-sm p-4"><div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-sm"><h3 className="text-lg font-black text-gray-800 mb-2 uppercase">Remise</h3><div className="space-y-4"><div className="flex bg-gray-100 p-1 rounded-xl"><button onClick={() => setDiscountModal({...discountModal, type: '%'})} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${discountModal.type === '%' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>%</button><button onClick={() => setDiscountModal({...discountModal, type: 'Ar'})} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${discountModal.type === 'Ar' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>Ar</button></div><input autoFocus type="number" className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-xl py-4 px-6 text-xl font-black outline-none" value={discountModal.value || ''} onChange={(e) => setDiscountModal({...discountModal, value: e.target.value})} /><div className="grid grid-cols-2 gap-3"><button onClick={() => setDiscountModal(null)} className="py-3 text-xs font-bold text-gray-400 uppercase">Annuler</button><button onClick={() => applyDiscount(discountModal.itemId, discountModal.type, discountModal.value)} className="bg-emerald-600 text-white py-3 rounded-xl text-xs font-black shadow-lg">Appliquer</button></div></div></div></div>}
    </div>
  );
}
