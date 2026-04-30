import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, ShoppingCart, Trash2, Package, CheckCircle, Loader2, FileText, Plus, Minus, Clock, User, Tag, List, Send, Phone } from 'lucide-react';
import Calculator from './Calculator';

export default function POS({ session }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [discountModal, setDiscountModal] = useState(null);
  const [activeItemId, setActiveItemId] = useState(null);

  const handleCalculatorResult = (value) => {
    if (activeItemId) {
        updateItemQuantity(activeItemId, value);
        // Ne pas remettre activeItemId à null ici pour garder le produit sélectionné
    }
  };

  const [paymentMode, setPaymentMode] = useState('cash'); 
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentFrequency, setInstallmentFrequency] = useState('month'); // 'day' or 'month'
  const [installmentMonths, setInstallmentMonths] = useState(1);
  const [printInvoice, setPrintInvoice] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);
  const [globalDiscount, setGlobalDiscount] = useState({ value: 0, type: '%' });

  const [companyInfo, setCompanyInfo] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchClients();
    fetchOrCreateDraftInvoice();
    fetchCompanyInfo();
  }, []);

  const fetchCompanyInfo = async () => {
    if (!session?.user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (data) setCompanyInfo(data);
  };

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
      setInvoiceItems(data.map(item => ({ 
        ...item.produits, 
        unite_base: item.produits?.unite_base,
        unite_superieure: item.produits?.unite_superieure,
        quantite_par_unite: item.produits?.quantite_par_unite,
        quantity: item.quantity, 
        price_at_sale: item.price_at_sale, 
        item_id: item.id, 
        discount: item.discount 
      })));
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

  const addToInvoice = async (product) => {
    if (!activeInvoice) return;
    
    // Check if item already exists to avoid duplicates
    const existingItem = invoiceItems.find(item => item.id === product.id);
    
    if (existingItem) {
        setActiveItemId(existingItem.item_id);
    } else {
        // Add new item with 0 quantity
        const { data, error } = await supabase.from('facture_items')
            .insert([{ facture_id: activeInvoice.id, produit_id: product.id, quantity: 0, price_at_sale: product.price }])
            .select()
            .single();
        
        if (data) {
            const newItem = {
                ...product,
                item_id: data.id,
                quantity: 0,
                price_at_sale: product.price
            };
            setInvoiceItems(prev => [...prev, newItem]);
            setActiveItemId(data.id);
        }
    }
  };

  const removeItem = async (itemId, productId) => {
    await supabase.from('facture_items').delete().eq('id', itemId);
    setInvoiceItems(invoiceItems.filter(i => i.id !== productId));
  };

  const updateItemQuantity = async (itemId, newQuantity) => {
    // Find the item to check its stock
    const item = invoiceItems.find(i => i.item_id === itemId);
    if (!item) return;

    if (newQuantity > item.stock_quantity) {
        alert(`Stock insuffisant ! Disponible : ${item.stock_quantity}`);
        return;
    }
    
    if (isNaN(newQuantity) || newQuantity <= 0) return;
    
    // 1. Mise à jour locale immédiate de l'interface
    setInvoiceItems(prevItems => prevItems.map(item => 
      item.item_id === itemId ? { ...item, quantity: newQuantity } : item
    ));

    // 2. Persistance en base de données
    const { error } = await supabase.from('facture_items').update({ quantity: newQuantity }).eq('id', itemId);
    
    if (error) {
      alert("Erreur: " + error.message);
      // Recharger en cas d'erreur
      fetchInvoiceItems(activeInvoice.id);
    }
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
  const { data: { user } } = await supabase.auth.getUser(); // Fetch user once

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

    // Record stock movement for sale (sortie)
    await supabase.from('stock_movements').insert([
      {
        product_id: item.id, // ID of the product
        type: 'out',
        quantity: item.quantity, // Quantity sold
        reason: `Vente (Facture ${invData.number})`,
        user_id: user.id
      }
    ]);
  }
      if (paymentMode === 'credit') {
        const echeances = [];
        if (isInstallment && installmentMonths > 1) {
          const monthlyAmount = Math.floor(amountToSchedule / installmentMonths);
          for (let i = 0; i < installmentMonths; i++) {
            const date = new Date(dueDate); 
            if (installmentFrequency === 'day') {
              date.setDate(date.getDate() + i);
            } else {
              date.setMonth(date.getMonth() + i);
            }
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
      
      setFlashMessage("Vente Terminée !");
      fetchProducts();
      setInvoiceItems([]);
      setPaymentMode('cash');
      setAdvanceAmount(0);
      setIsInstallment(false);
      if (printInvoice) {
        const subtotalBeforeDiscount = invoiceItems.reduce((acc, item) => acc + calculateItemTotal(item), 0);
        handlePrintInvoice(invData.number, activeInvoice.guest_name, activeInvoice.guest_contact, invoiceItems, subtotalBeforeDiscount, activeInvoice.created_at);
      }
      fetchOrCreateDraftInvoice();
      setTimeout(() => setFlashMessage(null), 2000);
    } catch (e) { alert(e.message); }
    finally { setIsProcessing(false); }
  };

  const calculateItemTotal = (item) => {
    const baseTotal = item.quantity * item.price_at_sale;
    if (!item.discount) return baseTotal;
    return item.discount.type === '%' ? baseTotal - (baseTotal * (parseFloat(item.discount.value) / 100)) : baseTotal - parseFloat(item.discount.value);
  };

  const handlePrintInvoice = (invoiceNumber, clientName, clientContact, invoiceItems, totalAmount, invoiceDate) => {
    const logoBase64 = ''; // PASTE YOUR BASE64 LOGO HERE
    let printContent = `
      <style>
        body { font-family: sans-serif; margin: 20px; color: #333; }
        .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #10b981; padding-bottom: 20px; }
        .company-info { flex: 1; }
        .company-info h1 { margin: 0; color: #059669; font-size: 24px; text-transform: uppercase; }
        .company-info p { margin: 2px 0; font-size: 12px; }
        .invoice-title { text-align: right; flex: 1; }
        .invoice-title h2 { margin: 0; font-size: 28px; color: #e5e7eb; text-transform: uppercase; }
        .invoice-logo { max-width: 120px; height: auto; margin-bottom: 10px; }
        .details-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .details-box { flex: 1; border: 1px solid #eee; padding: 15px; border-radius: 8px; }
        .details-box h3 { margin: 0 0 10px 0; font-size: 10px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .details-box p { margin: 5px 0; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f9fafb; padding: 12px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #9ca3af; border-bottom: 2px solid #f3f4f6; }
        td { padding: 12px 8px; border-bottom: 1px solid #f9fafb; font-size: 13px; }
        .total-row td { border-top: 2px solid #10b981; font-weight: bold; font-size: 16px; background: #f0fdf4; }
        .signature-section { display: flex; justify-content: space-between; margin-top: 50px; padding: 0 20px; }
        .signature-box { text-align: center; width: 200px; }
        .signature-line { margin-top: 60px; border-top: 1px dashed #333; padding-top: 5px; font-size: 12px; font-weight: bold; }
        @media print {
          @page { margin: 0; }
          body { margin: 2cm; }
          .no-print { display: none; }
        }
      </style>
      <div class="invoice-header">
        <div class="company-info">
          ${logoBase64 ? `<img src="${logoBase64}" class="invoice-logo">` : `<h1>${companyInfo?.company_name || 'Gestock PPN'}</h1>`}
          <p><strong>${companyInfo?.company_name || 'TRANSFORMER'}</strong></p>
          <p>NIF: ${companyInfo?.nif || 'En cours'}</p>
          <p>STAT: ${companyInfo?.stat || 'En cours'}</p>
          <p>Adresse: ${companyInfo?.address || 'Antananarivo, Madagascar'}</p>
          <p>Contact: ${companyInfo?.phone || session?.user?.email}</p>
        </div>
        <div class="invoice-title">
          <h2>Facture</h2>
          <p><strong>N°:</strong> ${invoiceNumber}</p>
          <p><strong>Date:</strong> ${new Date(invoiceDate).toLocaleDateString('fr-FR')}</p>
        </div>
      </div>
      
      <div class="details-grid">
        <div class="details-box">
          <h3>Facturé à</h3>
          <p><strong>${clientName || 'Anonyme'}</strong></p>
          ${clientContact ? `<p>Contact: ${clientContact}</p>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Produit</th>
            <th style="text-align: center;">Qté</th>
            <th style="text-align: right;">Prix Unitaire</th>
            <th style="text-align: right;">Remise</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>

    `;

    invoiceItems.forEach(item => {
      const discountDisplay = item.discount ? `${item.discount.value}${item.discount.type}` : '-';
      const itemTotal = calculateItemTotal(item);
      printContent += `
        <tr>
          <td>${item.name}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">${item.price_at_sale.toLocaleString()} Ar</td>
          <td style="text-align: right;">${discountDisplay}</td>
          <td style="text-align: right;">${itemTotal.toLocaleString()} Ar</td>
        </tr>
      `;
    });

    const discountAmount = globalDiscount.value > 0 
      ? (globalDiscount.type === '%' ? (totalAmount * (parseFloat(globalDiscount.value) / 100)) : parseFloat(globalDiscount.value))
      : 0;

    printContent += `
        </tbody>
        <tfoot>
          ${discountAmount > 0 ? `
            <tr style="border-top: 2px solid #f3f4f6;">
              <td colspan="4" style="padding: 10px 0; text-align: right; font-size: 12px; color: #6b7280;">REMISE GLOBALE (${globalDiscount.value}${globalDiscount.type})</td>
              <td style="padding: 10px 0; text-align: right; font-size: 14px; font-weight: 700; color: #ef4444;">-${discountAmount.toLocaleString('fr-MG')} Ar</td>
            </tr>
          ` : ''}
          <tr style="border-top: 2px solid #f3f4f6;">
            <td colspan="4" style="padding: 20px 0; text-align: right; font-size: 14px; font-weight: 900; color: #6b7280; text-transform: uppercase;">TOTAL À PAYER</td>
            <td style="padding: 20px 0; text-align: right; font-size: 16px; font-weight: 900; color: #1f2937;">${(totalAmount - discountAmount).toLocaleString('fr-MG')} Ar</td>
          </tr>
        </tfoot>
      </table>

      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line">Le Vendeur</div>
          <p style="font-size: 10px; margin-top: 5px; font-weight: bold;">${companyInfo?.full_name || ''}</p>
        </div>
        <div class="signature-box">
          <div class="signature-line">Le Client</div>
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  const applyDiscount = (itemId, type, value) => {
    const numericValue = parseFloat(value) || 0;
    if (discountModal.isGlobal) {
        setGlobalDiscount(prev => ({ ...prev, type, value: numericValue }));
    } else {
        setInvoiceItems(invoiceItems.map(item => item.item_id === itemId ? { ...item, discount: { type, value: numericValue } } : item));
    }
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

  const calculateTotal = () => {
    let subtotal = invoiceItems.reduce((acc, item) => acc + calculateItemTotal(item), 0);
    if (globalDiscount.value > 0) {
      if (globalDiscount.type === '%') {
        subtotal -= (subtotal * (parseFloat(globalDiscount.value) / 100));
      } else {
        subtotal -= parseFloat(globalDiscount.value);
      }
    }
    return Math.max(0, subtotal);
  };

  const total = calculateTotal();

  const applyGlobalDiscount = (type, value) => {
    // S'assurer que la valeur est convertie en nombre avant de l'enregistrer
    setGlobalDiscount({ type, value: parseFloat(value) || 0 });
    setDiscountModal(null);
  };

  return (
    <div className="flex flex-col gap-3 h-screen p-3">
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
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black opacity-75 uppercase text-white">Remise</span>
            <span className="text-xs font-black text-orange-200">
              {globalDiscount.value > 0 ? (globalDiscount.type === '%' ? `${globalDiscount.value}%` : `${globalDiscount.value} Ar`) : '0'}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black opacity-90 uppercase text-white">Total:</span>
            <span className="text-2xl font-black text-red-500 bg-white px-4 py-1 rounded-2xl shadow-lg border-2 border-red-100 flex items-center gap-1">
              {total.toLocaleString()} <span className="text-xs opacity-60">Ar</span>
            </span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA: TWO COLUMNS */}
      <div className="grid grid-cols-2 gap-4 flex-1 items-start">
        {/* COLUMN 1: INVOICE & CALCULATOR */}
        <div className="flex flex-col gap-4">
            <div className="bg-white border border-emerald-100 rounded-[2rem] shadow-sm flex flex-col overflow-hidden max-h-[60vh]">
                <div className="p-2 sm:p-0 overflow-y-auto">
                {/* Invoice Table Implementation Here (Same as before) */}
                <table className="w-full text-left min-w-[500px] hidden sm:table">
                    <thead className="sticky top-0 bg-gray-50 border-b border-emerald-50 z-10">
                    <tr className="text-[8px] font-black text-gray-400 uppercase">
                        <th className="p-2 pl-4">Produit</th>
                        <th className="p-2 text-center">Qté</th>
                        <th className="p-2 text-center">Détails Unités</th>
                        <th className="p-2 text-right">Remise</th>
                        <th className="p-2 text-right pr-4">Total</th>
                        <th className="p-2 text-right"></th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                    {invoiceItems.map(item => (
                        <tr key={item.item_id} className="border-b border-emerald-50 text-[10px]">
                        <td className="p-2 pl-4 font-black uppercase text-gray-800">{item.name}</td>
                        <td className="p-2 text-center">
                            <button 
                                onClick={() => setActiveItemId(item.item_id)}
                                className={`w-10 border rounded text-center text-[10px] font-black ${activeItemId === item.item_id ? 'bg-emerald-500 text-white' : ''}`}
                            >
                                {item.quantity}
                            </button>
                        </td>
                        <td className="p-2 text-center text-[8px] font-bold text-gray-400 italic">
                            {item.quantite_par_unite > 1 ? `${Math.floor(item.quantity / item.quantite_par_unite)} ${item.unite_superieure || 'Ctn'} + ${item.quantity % item.quantite_par_unite} ${item.unite_base || 'Pce'}` : `${item.quantity} ${item.unite_base || 'Pce'}`}
                        </td>
                        <td className="p-2 text-right">
                            <button onClick={() => setDiscountModal({ itemId: item.item_id, name: item.name, total: item.quantity * item.price_at_sale, value: item.discount?.value || 0, type: item.discount?.type || '%' })} className={`font-black ${item.discount ? 'text-orange-500' : 'text-gray-300 hover:text-emerald-500'}`}>
                            {item.discount ? `${item.discount.value}${item.discount.type}` : <Tag size={10} className="ml-auto" />}
                            </button>
                        </td>
                        <td className="p-2 text-right font-black pr-4">{calculateItemTotal(item).toLocaleString()} Ar</td>
                        <td className="p-2 text-right"><button onClick={() => removeItem(item.item_id, item.id)} className="text-red-200 hover:text-red-500"><Trash2 size={12} /></button></td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            </div>
            {/* CALCULATOR IN COLUMN 1 */}
            {/* The 'key={activeItemId}' prop forces Calculator to remount and reset its state on every new selection */}
            <Calculator 
                key={activeItemId}
                activeItem={invoiceItems.find(i => i.item_id === activeItemId)} 
                onResult={handleCalculatorResult} 
            />
        </div>

        {/* COLUMN 2: SEARCH & CONTROLS */}
        <div className="flex flex-col gap-4">
            <div className="flex-1 bg-white border border-emerald-100 rounded-[2rem] shadow-sm flex flex-col overflow-hidden min-h-0">
                {/* Search Bar & Products Table (Same as before) */}
                <div className="p-3 border-b border-emerald-50 bg-emerald-50/20 flex items-center gap-4 shrink-0">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" size={16} />
                    <input type="text" placeholder="Ajouter un produit..." className="w-full bg-white border border-emerald-100 rounded-xl py-2 pl-10 pr-4 text-xs font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                </div>
                
                <div className="flex-1 p-3 overflow-y-auto">
                <table className="w-full text-left">
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
                            {console.log("Product:", p.name, "Stock:", p.stock_quantity, "Condition:", Number(p.stock_quantity) <= 0)}
                            <button 
                                onClick={() => {
                                    addToInvoice(p);
                                    setTimeout(() => {
                                        const item = invoiceItems.find(i => i.id === p.id);
                                        if (item) setActiveItemId(item.item_id);
                                    }, 100);
                                }} 
                                disabled={Number(p.stock_quantity) <= 0}
                                className={`${Number(p.stock_quantity) <= 0 ? 'bg-red-500 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-105 shadow-md'} text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all`}
                            >
                                {Number(p.stock_quantity) <= 0 ? 'STOCK INSUFFISANT' : 'SELECTIONNER'}
                            </button>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            </div>

            {/* Payment Controls at the bottom of Column 2 */}
            <div className="bg-emerald-950 text-white rounded-[2rem] p-3 flex flex-col gap-3 shadow-xl border border-white/5 shrink-0">
                <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    {/* MODE DE PAIEMENT */}
                    <div className="flex bg-emerald-900/50 p-1 rounded-2xl border border-white/10 w-full">
                    <button onClick={() => setPaymentMode('cash')} className={`flex-1 sm:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${paymentMode === 'cash' ? 'bg-emerald-500 text-white' : 'text-emerald-400'}`}>COMPTANT</button>
                    <button onClick={() => setPaymentMode('credit')} className={`flex-1 sm:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${paymentMode === 'credit' ? 'bg-orange-500 text-white' : 'text-emerald-400'}`}>CRÉDIT</button>
                    </div>

                    {/* PARAMÈTRES CRÉDIT (EN LIGNE) */}
                    {paymentMode === 'credit' && (
                    <div className="flex flex-wrap items-center gap-4 animate-in slide-in-from-left-4 w-full">
                        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                        <Clock size={12} className="text-orange-400" />
                        <input type="date" className="bg-transparent text-[10px] font-black outline-none" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                        <Tag size={12} className="text-emerald-400" />
                        <input type="number" placeholder="Avance" className="bg-transparent text-[10px] font-black outline-none w-20 text-emerald-400" value={advanceAmount || ''} onChange={e => setAdvanceAmount(e.target.value)} />
                        </div>
                    </div>
                    )}
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 justify-between">
                         <div className="flex items-center gap-1.5">
                            <input
                                type="checkbox"
                                id="printInvoice"
                                checked={printInvoice}
                                onChange={(e) => setPrintInvoice(e.target.checked)}
                                className="accent-emerald-500"
                            />
                            <label htmlFor="printInvoice" className="text-[10px] font-black uppercase text-white">Imprimer</label>
                        </div>
                        <button 
                            onClick={() => setDiscountModal({ type: globalDiscount.type, value: globalDiscount.value, isGlobal: true })}
                            className="px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest text-emerald-300 hover:bg-white/10 border border-emerald-400/20"
                        >
                            REMISE GLOBALE
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleReset} disabled={invoiceItems.length === 0 || isProcessing} className="flex-1 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-emerald-400 hover:text-red-400 transition-all disabled:opacity-30 border border-emerald-400/20">Réinitialiser</button>
                        <button onClick={handleFinalize} disabled={!activeInvoice || invoiceItems.length === 0 || isProcessing} className={`flex-[2] px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg ${paymentMode === 'cash' ? 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950' : 'bg-orange-500 hover:bg-orange-400 text-white'}`}>
                            {isProcessing ? <Loader2 className="animate-spin" size={16} /> : (paymentMode === 'cash' ? "Valider" : "Crédit")}
                        </button>
                    </div>
                </div>
                </div>
            </div>
        </div>
      </div>
      
      {/* Modals */}
      {discountModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-emerald-950/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-sm">
                <h3 className="text-lg font-black text-gray-800 mb-2 uppercase">Remise</h3>
                <p className="text-[10px] text-gray-500 mb-4 font-bold uppercase">Veuillez saisir la valeur de la remise à appliquer sur l'article.</p>
                <div className="space-y-4">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button 
                            onClick={() => setDiscountModal({...discountModal, type: 'Ar'})} 
                            className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${discountModal.type === 'Ar' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}
                        >
                            Ar
                        </button>
                        <button 
                            onClick={() => setDiscountModal({...discountModal, type: '%'})} 
                            className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${discountModal.type === '%' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}
                        >
                            %
                        </button>
                    </div>
                    <input 
                        autoFocus 
                        type="number" 
                        className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-xl py-4 px-6 text-xl font-black outline-none" 
                        value={discountModal.value || ''} 
                        onChange={(e) => setDiscountModal({...discountModal, value: e.target.value})} 
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setDiscountModal(null)} className="py-3 text-xs font-bold text-gray-400 uppercase">Annuler</button>
                        <button onClick={() => applyDiscount(discountModal.itemId, discountModal.type, discountModal.value)} className="bg-emerald-600 text-white py-3 rounded-xl text-xs font-black shadow-lg">Appliquer</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
