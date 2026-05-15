import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Search, ShoppingCart, Trash2, Package, CheckCircle, Loader2, Plus, Minus, Tag, Send } from 'lucide-react';
import Calculator from './Calculator';
import confetti from 'canvas-confetti';

export default function POS({ session, selectedDepotId }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [discountModal, setDiscountModal] = useState(null);
  const [activeItemId, setActiveItemId] = useState(null);
  const [paymentMode, setPaymentMode] = useState('cash'); 
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [creditType, setCreditType] = useState('mensuel');
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState({ value: 0, type: '%' });
  const [printInvoice, setPrintInvoice] = useState(true);
  const [isWithdrawal, setIsWithdrawal] = useState(false);
  const [isOther, setIsOther] = useState(false);
  const [calculatorPos, setCalculatorPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [tokens, setTokens] = useState([]); 
  const itemsPerPage = 15;

  // ... (inside the component return, at the end)

      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-black text-gray-800">Prévisualisation de la facture</h3>
              <div className="flex gap-2">
                <button onClick={() => setPreviewInvoice(null)} className="px-4 py-2 text-sm font-bold text-gray-500">Fermer</button>
                <button onClick={() => window.print()} className="px-6 py-2 bg-emerald-600 text-white font-black rounded-xl text-sm">Imprimer</button>
              </div>
            </div>
            <div className="p-10 overflow-y-auto flex-1 print:p-0">
                <div id="printable-invoice" className="text-gray-800">
                    <h1 className="text-3xl font-black text-emerald-800 mb-6">Facture de Vente</h1>
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div>
                            <p className="text-xs uppercase font-bold text-gray-400">Facture #</p>
                            <p className="font-bold">{previewInvoice.id.slice(0,8).toUpperCase()}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase font-bold text-gray-400">Date</p>
                            <p className="font-bold">{new Date(previewInvoice.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="border-t border-b border-gray-200 py-4 mb-4">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-gray-200 text-gray-500 text-[10px] uppercase">
                                    <th className="py-2">Désignation</th>
                                    <th className="py-2 text-center">Qté</th>
                                    <th className="py-2 text-right">P.U</th>
                                    <th className="py-2 text-center">Remise</th>
                                    <th className="py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoiceItems.map(item => (
                                    <tr key={item.item_id} className="border-b border-gray-50">
                                        <td className="py-2 font-bold">{item.name}</td>
                                        <td className="py-2 text-center">{item.quantity}</td>
                                        <td className="py-2 text-right">{item.price_at_sale.toLocaleString()}</td>
                                        <td className="py-2 text-center text-orange-600 font-bold">
                                            {item.discount ? `${item.discount.value}${item.discount.type}` : '-'}
                                        </td>
                                        <td className="py-2 text-right font-bold">{calculateItemTotal(item).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="flex justify-between font-black text-lg pt-4">
                            <span>Total</span>
                            <span>{parseFloat(previewInvoice.total_amount).toLocaleString()} MGA</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - calculatorPos.x, y: e.clientY - calculatorPos.y };
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setCalculatorPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleCalculatorResult = (value) => {
    if (activeItemId) {
        updateItemQuantity(activeItemId, value);
        setIsCalculatorOpen(false);
    }
  };

  const updateItemQuantity = async (itemId, quantity) => {
    if (quantity < 0) quantity = 0;
    setInvoiceItems(prevItems =>
        prevItems.map(item =>
            item.item_id === itemId ? { ...item, quantity: quantity } : item
        )
    );
    await supabase.from('facture_items').update({ quantity: quantity }).eq('id', itemId);
  };

  const handleReset = async () => {
    if (!activeInvoice || invoiceItems.length === 0) return;
    if (!window.confirm("Êtes-vous sûr de vouloir réinitialiser cette commande ?")) return;

    setIsProcessing(true);
    try {
      await supabase.from('facture_items').delete().eq('facture_id', activeInvoice.id);
      const updates = { total_amount: 0, paid_amount: 0, payment_mode: 'cash' };
      await supabase.from('factures').update(updates).eq('id', activeInvoice.id);
      setInvoiceItems([]);
      setActiveInvoice({ ...activeInvoice, ...updates });
      setPaymentMode('cash');
      setAdvanceAmount(0);
      setSearchTerm('');
      setGlobalDiscount({ value: 0, type: '%' });
      setActiveItemId(null);
      setDiscountModal(null);
      setIsCalculatorOpen(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const addToInvoice = async (product) => {
    let currentInvoice = activeInvoice;
    if (!currentInvoice || currentInvoice.number === 'TEMP') {
        const { data, error } = await supabase.from('factures')
            .insert([{ number: `FAC-${Date.now().toString().slice(-6)}`, user_id: session?.user?.id, created_at: new Date().toISOString() }])
            .select()
            .single();
        if (error) return alert("Erreur de création de facture.");
        currentInvoice = data;
        setActiveInvoice(data);
    }

    const existingItem = invoiceItems.find(item => item.id === product.id);
    if (existingItem) {
        setActiveItemId(existingItem.item_id);
        setIsCalculatorOpen(true);
    } else {
        const { data, error } = await supabase.from('facture_items')
            .insert([{ facture_id: currentInvoice.id, produit_id: product.id, quantity: 0, price_at_sale: product.price }])
            .select()
            .single();
        if (data) {
            setInvoiceItems(prev => [...prev, { ...product, item_id: data.id, quantity: 0, price_at_sale: product.price, discount: null }]);
            setActiveItemId(data.id);
            setIsCalculatorOpen(true);
        }
    }
  };

  function calculateItemTotal(item) {
    const baseTotal = item.quantity * item.price_at_sale;
    if (!item.discount) return baseTotal;
    const disc = parseFloat(item.discount.value);
    return item.discount.type === '%' ? baseTotal - (baseTotal * (disc / 100)) : baseTotal - disc;
  }

  const updateInvoiceGuestInfo = (field, value) => setActiveInvoice(prev => ({ ...prev, [field]: value }));
  const removeItem = async (itemId, supabaseItemId) => {
    setInvoiceItems(prev => prev.filter(item => item.item_id !== itemId));
    if (supabaseItemId) await supabase.from('facture_items').delete().eq('id', supabaseItemId);
  };

  const applyDiscount = async (itemId, type, value) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return alert("Valeur invalide.");
    if (itemId === 'global') {
        setGlobalDiscount({ value: numericValue, type: type });
        setDiscountModal(null);
    } else {
        setInvoiceItems(prev => prev.map(item => item.item_id === itemId ? { ...item, discount: { value: numericValue, type: type } } : item));
        await supabase.from('facture_items').update({ discount_value: numericValue, discount_type: type }).eq('id', itemId);
        setDiscountModal(null);
    }
  };

  const handleFinalize = async () => {
    console.log("Finalize started. Active Invoice:", activeInvoice);
    if (!activeInvoice || invoiceItems.length === 0) {
        console.warn("No invoice or items");
        return;
    }
    setIsProcessing(true);
    try {
      console.log("Processing payment...");
      const total = netTotal;
      const advance = paymentMode === 'credit' ? parseFloat(advanceAmount) || 0 : 0;
      
      const { data: updatedInvoice, error: updateError } = await supabase.from('factures').update({
        total_amount: total,
        paid_amount: total - advance,
        type: paymentMode === 'credit' ? 'CREDIT' : 'COMPTANT',
        frequency: paymentMode === 'credit' ? creditType : null,
        due_date: paymentMode === 'credit' ? dueDate : new Date().toISOString().split('T')[0],
        advance_amount: advance,
        status: 'paid',
        depot_id: selectedDepotId // Store which depot the sale was made from
      }).eq('id', activeInvoice.id).select().single();

      if (updateError) {
        console.error("Update invoice error:", updateError);
        throw updateError;
      }
      console.log("Invoice updated.");

      if (paymentMode === 'credit') {
        const { error: echeanceError } = await supabase.from('echeances_details').insert([{ facture_id: activeInvoice.id, date_echeance: dueDate, montant: total - advance, statut: 'non_paye' }]);
        if (echeanceError) {
            console.error("Echeance error:", echeanceError);
            throw echeanceError;
        }
      }
      
      // Mise à jour du stock
      for (const item of invoiceItems) {
        // Update depot-specific stock
        if (selectedDepotId) {
          const { data: depotStock } = await supabase
            .from('stocks')
            .select('id, quantity')
            .eq('product_id', item.id)
            .eq('depot_id', selectedDepotId)
            .maybeSingle();

          if (depotStock) {
            await supabase.from('stocks')
              .update({ quantity: Number(depotStock.quantity) - Number(item.quantity) })
              .eq('id', depotStock.id);
          } else {
            // This case should normally not happen due to POS filtering, 
            // but for safety we could insert if needed.
            await supabase.from('stocks').insert([{
              product_id: item.id,
              depot_id: selectedDepotId,
              quantity: -Number(item.quantity)
            }]);
          }
        }
        
        // Record stock movement
        await supabase.from('stock_movements').insert([{
          product_id: item.id,
          type: 'out',
          quantity: item.quantity,
          price_at_movement: item.price_at_sale,
          reason: `Vente Facture #${updatedInvoice.number}`,
          user_id: session?.user?.id,
          depot_id: selectedDepotId
        }]);
      }
      
      alert('Paiement finalisé !');
      
      if (printInvoice) {
          setPreviewInvoice(updatedInvoice);
      } else {
          window.location.reload();
      }
    } catch (e) {
      console.error("Caught error in handleFinalize:", e);
      alert("Erreur: " + e.message);
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      // Fetch products and join with stocks table for the selected depot
      let query = supabase
        .from('produits')
        .select(`
          *,
          categories:categories(*),
          stocks!inner(*)
        `)
        .eq('stocks.depot_id', selectedDepotId)
        .order('name');

      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching products with stock:", error);
      }

      if (data) {
        // Map stock quantity from the joined stocks table
        const formattedData = data.map(p => ({
          ...p,
          stock_quantity: p.stocks?.[0]?.quantity || 0
        }));
        setProducts(formattedData);
        setFilteredProducts(formattedData);
      }
    };
    if (selectedDepotId) fetchData();
  }, [selectedDepotId]);

  useEffect(() => {
    const term = searchTerm.toLowerCase().trim();
    setFilteredProducts(term ? products.filter(p => p.name.toLowerCase().includes(term)) : products);
  }, [searchTerm, products]);

  const subtotal = useMemo(() => invoiceItems.reduce((acc, item) => acc + (item.quantity * item.price_at_sale), 0), [invoiceItems]);
  const lineDiscountsTotal = useMemo(() => invoiceItems.reduce((acc, item) => item.discount ? acc + (item.discount.type === '%' ? (item.quantity * item.price_at_sale) * (item.discount.value / 100) : item.discount.value) : acc, 0), [invoiceItems]);
  const globalDiscountAmount = useMemo(() => globalDiscount.value > 0 ? (globalDiscount.type === '%' ? (subtotal - lineDiscountsTotal) * (globalDiscount.value / 100) : globalDiscount.value) : 0, [subtotal, lineDiscountsTotal, globalDiscount]);
  const netTotal = useMemo(() => Math.max(0, subtotal - lineDiscountsTotal - globalDiscountAmount), [subtotal, lineDiscountsTotal, globalDiscountAmount]);
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredProducts, currentPage]);

  const openDiscountModalForItem = (item) => {
    if (!item || item.isGlobal) setDiscountModal({ itemId: 'global', name: 'Globale', isGlobal: true, value: globalDiscount.value, type: globalDiscount.type });
    else setDiscountModal({ itemId: item.item_id, name: item.name, isGlobal: false, value: item.discount?.value || 0, type: item.discount?.type || '%' });
  };

  const formatQuantity = (quantity, product) => {
    if (!product || !product.quantite_par_unite) return `${quantity} ${product?.unite_base || 'Pce'}`;
    const qpu = Number(product.quantite_par_unite);
    if (qpu <= 1) return `${quantity} ${product.unite_base || 'Pce'}`;
    
    const superior = Math.floor(quantity / qpu);
    const base = quantity % qpu;
    
    let result = '';
    if (superior > 0) result += `${superior} ${product.unite_superieure || 'Sac'} `;
    if (base > 0) result += `+ ${base} ${product.unite_base || 'Kg'}`;
    
    return result.trim() || `${quantity} ${product.unite_base}`;
  };

  return (
    <div className="flex flex-col gap-2 h-full p-2">
      <div className="bg-white rounded-xl p-2 shadow-sm border border-emerald-100 flex items-center justify-between">
        <div className="text-xs font-black">Facture: {activeInvoice?.number || '...'}</div>
        <div className="text-2xl font-black text-emerald-600">{netTotal.toLocaleString()} Ar</div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 gap-3 h-[45%]">
          {/* CART */}
          <div className="col-span-12 lg:col-span-8 bg-white rounded-xl shadow-sm border border-emerald-100 flex flex-col min-h-0 overflow-hidden">
            <div className="p-2 border-b border-emerald-50 bg-emerald-50/30 flex items-center justify-between">
              <h3 className="font-black text-gray-700 uppercase text-[9px] flex items-center gap-2"><ShoppingCart size={12} className="text-emerald-500" /> Panier</h3>
              <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded-full text-[8px] font-black">{invoiceItems.length}</span>
            </div>
            {/* Cart Header */}
            <div className="grid grid-cols-12 gap-1 px-2 py-1 bg-emerald-50 text-[8px] font-black text-emerald-800 uppercase border-b border-emerald-100">
              <div className="col-span-3">Produit</div>
              <div className="col-span-2 text-center">Qté</div>
              <div className="col-span-2 text-center">Remise</div>
              <div className="col-span-3 text-right">Total</div>
              <div className="col-span-2 text-center">Action</div>
            </div>
            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {invoiceItems.map(item => (
                <div key={item.item_id} onClick={() => { setActiveItemId(item.item_id); setIsCalculatorOpen(true); }} className="grid grid-cols-12 gap-1 items-center px-2 py-2 border-b border-gray-50 hover:bg-emerald-50 cursor-pointer">
                  <div className="col-span-3 font-black text-[9px] uppercase truncate">{item.name}</div>
                  <div className="col-span-2 text-center font-black text-[10px] bg-emerald-100 rounded">
                    {formatQuantity(item.quantity, item)}
                  </div>
                  <div className="col-span-2 text-center">
                    <button onClick={(e) => { e.stopPropagation(); openDiscountModalForItem(item); }} className="text-[9px] font-bold text-orange-600">
                      {item.discount ? `${item.discount.value}${item.discount.type}` : '+'}
                    </button>
                  </div>
                  <div className="col-span-3 text-right font-black text-[9px]">{calculateItemTotal(item).toLocaleString()} Ar</div>
                  <div className="col-span-2 text-center">
                    <button onClick={(e) => { e.stopPropagation(); removeItem(item.item_id, item.item_id); }} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* VALIDATION */}
          <div className="col-span-12 lg:col-span-4 bg-emerald-950 text-white rounded-xl p-3 shadow-xl">
             <div className="flex justify-between items-center mb-2">
                <h3 className="font-black text-[9px] uppercase">Paiement</h3>
                {globalDiscountAmount > 0 && (
                    <span className="text-[9px] font-black text-orange-400">Remise: -{globalDiscountAmount.toLocaleString()} Ar</span>
                )}
             </div>

             <div className="grid grid-cols-2 gap-1.5 p-1 bg-emerald-900/50 rounded-lg border border-white/10 mb-2">
                <button onClick={() => setPaymentMode('cash')} className={`py-1.5 rounded text-[8px] font-black ${paymentMode === 'cash' ? 'bg-emerald-500 text-white' : 'text-emerald-400'}`}>COMPTANT</button>
                <button onClick={() => setPaymentMode('credit')} className={`py-1.5 rounded text-[8px] font-black ${paymentMode === 'credit' ? 'bg-orange-500 text-white' : 'text-emerald-400'}`}>CRÉDIT</button>
             </div>

             <div className="p-2 bg-emerald-900/30 rounded-lg mb-2">
                <label className="flex items-center gap-2 text-[8px] font-bold cursor-pointer hover:text-emerald-400 transition-colors">
                  <input type="checkbox" checked={printInvoice} onChange={() => setPrintInvoice(!printInvoice)} className="accent-emerald-500" /> 
                  IMPRIMER LA FACTURE
                </label>
             </div>

             {paymentMode === 'cash' && (
                <div className="grid grid-cols-1 gap-1 p-2 bg-emerald-900/30 rounded-lg">
                    <label className="flex items-center gap-2 text-[8px] font-bold"><input type="checkbox" checked={isWithdrawal} onChange={() => setIsWithdrawal(!isWithdrawal)} /> Prélèvement</label>
                    <label className="flex items-center gap-2 text-[8px] font-bold"><input type="checkbox" checked={isOther} onChange={() => setIsOther(!isOther)} /> Autre</label>
                </div>
             )}


             {paymentMode === 'credit' && (
                <div className="grid grid-cols-1 gap-2 bg-emerald-900/30 p-2 rounded-lg border border-white/10 mt-2">
                    <div className="flex flex-col gap-1">
                        <span className="text-[7px] font-black text-emerald-400 uppercase">Échéance</span>
                        <input type="date" className="bg-emerald-950 border border-white/10 rounded p-1.5 text-[10px] font-black outline-none w-full text-white" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[7px] font-black text-emerald-400 uppercase">Type d'échéance</span>
                        <select className="bg-emerald-950 border border-white/10 rounded p-1.5 text-[10px] font-black outline-none w-full text-white" value={creditType} onChange={e => setCreditType(e.target.value)}>
                            <option value="mensuel">Mensuel</option>
                            <option value="journalier">Journalier</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[7px] font-black text-emerald-400 uppercase">Avance</span>
                        <input type="number" className="bg-emerald-950 border border-white/10 rounded p-1.5 text-[10px] font-black outline-none w-full text-orange-400" placeholder="0" value={advanceAmount || ''} onChange={e => setAdvanceAmount(e.target.value)} />
                    </div>
                </div>
             )}
             <button onClick={handleFinalize} disabled={isProcessing} className="w-full mt-4 py-1.5 bg-emerald-600 text-white font-black rounded-lg text-[9px] uppercase tracking-wider flex items-center justify-center gap-2">
                {isProcessing ? <Loader2 className="animate-spin" size={14} /> : 'FINALISER'}
             </button>
          </div>
        </div>

        {/* PRODUCTS LIST */}
        <div className="mt-4 bg-white rounded-xl p-2 shadow-sm border border-emerald-100">
           <input type="text" placeholder="Chercher produit..." className="w-full bg-emerald-50 p-2 rounded-lg text-xs font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           <div className="mt-2 h-64 overflow-y-auto">
             <table className="w-full text-left">
                <tbody className="divide-y divide-emerald-50">
                  {paginatedProducts.map(p => (
                    <tr key={p.id} onClick={() => Number(p.stock_quantity) > 0 && addToInvoice(p)} className="border-b border-gray-100 cursor-pointer hover:bg-emerald-50">
                      <td className="p-2">
                        <div className="font-black text-xs uppercase">{p.name}</div>
                        <div className="text-[9px] text-gray-400 font-bold italic">
                            {p.quantite_par_unite > 1 ? `${Math.floor(p.stock_quantity / p.quantite_par_unite)} ${p.unite_superieure || 'Sac'} + ${p.stock_quantity % p.quantite_par_unite} ${p.unite_base || 'Kg'}` : `${p.stock_quantity} ${p.unite_base || 'Pce'}`}
                        </div>
                      </td>
                      <td className="p-2 text-xs font-black text-right">{p.price.toLocaleString()} Ar</td>
                      <td className="p-2 text-right"><Plus size={16} className="inline-block" /></td>
                    </tr>
                  ))}
                </tbody>
                </table>
                </div>
                </div>
                </div>

      {isCalculatorOpen && (
        <div 
          className="fixed z-[300] w-full max-w-xs animate-in fade-in duration-200"
          style={{ top: '10%', left: '10%', transform: `translate(${calculatorPos.x}px, ${calculatorPos.y}px)` }}
        >
          <div className="drag-handle cursor-move bg-slate-800 text-white text-[8px] font-black uppercase text-center py-1 rounded-t-xl opacity-80 hover:opacity-100 transition-opacity" onMouseDown={handleMouseDown}>Déplacer</div>
          <Calculator key={activeItemId} activeItem={invoiceItems.find(i => i.item_id === activeItemId)} onResult={handleCalculatorResult} onOpenDiscount={openDiscountModalForItem} onClose={() => setIsCalculatorOpen(false)} />
        </div>
      )}
      {discountModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-emerald-950/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-sm">
            <h3 className="text-lg font-black text-gray-800 mb-2 uppercase">{discountModal.isGlobal ? 'Remise Globale' : `Remise sur ${discountModal.name}`}</h3>
            <div className="space-y-4">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button onClick={() => setDiscountModal({...discountModal, type: 'Ar'})} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${discountModal.type === 'Ar' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>Ar</button>
                <button onClick={() => setDiscountModal({...discountModal, type: '%'})} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${discountModal.type === '%' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>%</button>
              </div>
              <input autoFocus type="number" className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-xl py-4 px-6 text-xl font-black outline-none" value={discountModal.value || ''} onChange={(e) => setDiscountModal({...discountModal, value: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setDiscountModal(null)} className="py-3 text-xs font-bold text-gray-400 uppercase">Annuler</button>
                <button onClick={() => applyDiscount(discountModal.isGlobal ? 'global' : discountModal.itemId, discountModal.type, discountModal.value)} className="bg-emerald-600 text-white py-3 rounded-xl text-xs font-black shadow-lg">Appliquer</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <style>{`
            @media print {
              @page {
                margin: 0 !important;
                size: auto;
              }
              body, html {
                margin: 0 !important;
                padding: 0 !important;
                visibility: hidden;
              }
              #printable-invoice-container {
                visibility: visible !important;
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                padding: 20px !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
                border-radius: 0 !important;
              }
              #printable-invoice-container * {
                visibility: visible !important;
              }
              .print\\:hidden {
                display: none !important;
              }
            }
          `}</style>
          <div id="printable-invoice-container" className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex flex-wrap justify-between items-center bg-gray-50 print:hidden gap-3">
              <h3 className="font-black text-gray-800 text-sm">Prévisualisation</h3>
              <div className="flex flex-wrap gap-2 items-center">
                <input type="text" placeholder="Nom client" className="px-3 py-1.5 border rounded-lg text-xs w-32" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                <input type="text" placeholder="Tél" className="px-3 py-1.5 border rounded-lg text-xs w-24" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                <button onClick={() => { setPreviewInvoice(null); window.location.reload(); }} className="px-3 py-1.5 text-xs font-bold text-gray-500 bg-gray-100 rounded-lg">Fermer</button>
                <button onClick={() => window.print()} className="px-4 py-1.5 bg-emerald-600 text-white font-black rounded-lg text-xs">Imprimer</button>
              </div>
            </div>
            <div className="p-10 overflow-y-auto flex-1 print:p-0">
                <div id="printable-invoice" className="text-gray-800">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-3xl font-black text-emerald-800">Facture</h1>
                            <div className="text-xs font-bold text-gray-500 mt-2">
                                <p>GESTOCK SARL</p>
                                <p>123 Rue Principale, Antananarivo</p>
                                <p>Tél: +261 34 00 000 00</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold uppercase">Client: {clientName || 'Non spécifié'}</p>
                            <p className="text-sm font-bold">Tél: {clientPhone || '---'}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div>
                            <p className="text-xs uppercase font-bold text-gray-400">Facture #</p>
                            <p className="font-bold">{previewInvoice.number}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase font-bold text-gray-400">Date</p>
                            <p className="font-bold">{new Date(previewInvoice.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="border-t border-b border-gray-200 py-4 mb-4">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-gray-200 text-gray-500 text-[10px] uppercase">
                                    <th className="py-2">Désignation</th>
                                    <th className="py-2 text-center">Qté</th>
                                    <th className="py-2 text-right">P.U</th>
                                    <th className="py-2 text-center">Remise</th>
                                    <th className="py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoiceItems.map(item => (
                                    <tr key={item.item_id} className="border-b border-gray-50">
                                        <td className="py-2 font-bold">{item.name}</td>
                                        <td className="py-2 text-center">{item.quantity}</td>
                                        <td className="py-2 text-right">{item.price_at_sale.toLocaleString()}</td>
                                        <td className="py-2 text-center text-orange-600 font-bold">
                                            {item.discount ? `${item.discount.value}${item.discount.type}` : '-'}
                                        </td>
                                        <td className="py-2 text-right font-bold">{calculateItemTotal(item).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="flex justify-between font-black text-lg pt-4">
                            <span>Total</span>
                            <span>{parseFloat(previewInvoice.total_amount).toLocaleString()} MGA</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
