import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle, 
  Loader2,
  Package,
  X,
  Eye,
  FileText,
  Printer
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    fetchClients();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('produits')
      .select('*, categories(name)')
      .gt('stock_quantity', 0)
      .order('name');
    if (data) {
      setProducts(data);
      setFilteredProducts(data);
    }
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    if (data) setClients(data);
  };

  useEffect(() => {
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock_quantity) {
        setCart(cart.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        ));
      } else {
        alert("Stock insuffisant !");
      }
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, delta) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQty = item.quantity + delta;
        const product = products.find(p => p.id === productId);
        if (newQty > 0 && newQty <= product.stock_quantity) {
          return { ...item, quantity: newQty };
        }
      }
      return item;
    }));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non authentifié");

      // 1. Créer la facture
      const invoiceNumber = `CAISSE-${Date.now().toString().slice(-6)}`;
      const { data: invoice, error: invError } = await supabase
        .from('factures')
        .insert([{
          number: invoiceNumber,
          total_amount: total,
          status: 'paid',
          due_date: new Date().toISOString().split('T')[0],
          user_id: user.id,
          client_id: selectedClientId || null
        }])
        .select()
        .single();

      if (invError) throw invError;

      // 2. Enregistrer les articles
      const itemsToInsert = cart.map(item => ({
        facture_id: invoice.id,
        produit_id: item.id,
        quantity: item.quantity,
        price_at_sale: item.price
      }));
      await supabase.from('facture_items').insert(itemsToInsert);

      // 3. Mettre à jour les stocks pour chaque produit
      for (const item of cart) {
        const { error: stockError } = await supabase
          .from('produits')
          .update({ stock_quantity: item.stock_quantity - item.quantity })
          .eq('id', item.id);
        
        if (stockError) console.error(`Erreur stock pour ${item.name}:`, stockError.message);
      }

      setIsProcessing(false);
      setShowSuccess(true);
      setCart([]);
      fetchProducts();
    } catch (error) {
      console.error('Erreur lors de la validation:', error);
      alert(`Erreur: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const printInvoice = async () => {
    if (!previewRef.current) return;
    
    const canvas = await html2canvas(previewRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`commande-${Date.now()}.pdf`);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full min-h-screen p-2 pb-24">
      {/* Product Selection (Left) */}
      <div className="flex-[2] flex flex-col gap-4 overflow-hidden min-h-[300px]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher un PPN..." 
            className="w-full bg-white border border-emerald-100 rounded-2xl py-3 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 md:grid-cols-3 gap-2 py-2 auto-rows-min">
          {/* ... (votre code produit reste identique) ... */}
          {loading ? (
            <p className="col-span-full text-center py-10 text-gray-400">Chargement...</p>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map(p => (
              <button 
                key={p.id}
                onClick={() => addToCart(p)}
                className="bg-white border border-emerald-100 rounded-2xl p-2 shadow-sm active:scale-[0.98] text-center flex flex-col items-center gap-1 min-h-[100px] w-full"
              >
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                  <Package size={14} />
                </div>
                <div className="flex-1 w-full min-w-0">
                  <h4 className="text-[10px] font-bold text-gray-800 truncate leading-tight">{p.name}</h4>
                  <span className="text-[7px] text-emerald-600 font-bold uppercase bg-emerald-50 px-1 rounded inline-block">
                    {p.categories?.name || 'PPN'}
                  </span>
                </div>
                <div className="w-full">
                  <p className="text-[10px] font-black text-gray-800">{Number(p.price).toLocaleString('fr-MG')}</p>
                  <p className={`text-[7px] font-bold ${p.stock_quantity < 5 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {p.unite_superieure && p.quantite_par_unite > 1 
                      ? `${Math.floor(p.stock_quantity / p.quantite_par_unite)} ${p.unite_superieure} + ${p.stock_quantity % p.quantite_par_unite} ${p.unite_base}`
                      : `${p.stock_quantity} ${p.unite_base}`}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <p className="col-span-full text-center py-10 text-gray-400">Aucun produit.</p>
          )}
          <div className="h-[36%]" aria-hidden="true"></div>
        </div>
      </div>

      {/* Cart / Checkout (Right - Responsive) */}
      <div className="w-full lg:w-96 bg-white rounded-[2rem] border border-emerald-100 shadow-xl flex flex-col max-h-[50vh] lg:max-h-full">
        {/* ... (reste du contenu du panier) ... */}
        <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ShoppingCart size={24} />
            <h3 className="text-lg font-bold">Panier</h3>
          </div>
          <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">{cart.length} articles</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length > 0 ? (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-emerald-50 shadow-sm">
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-gray-800 text-xs truncate">{item.name}</h5>
                  <p className="text-[10px] text-emerald-600 font-bold">{Number(item.price).toLocaleString('fr-MG')} MGA / {item.unit || 'unité'}</p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-1">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-white text-emerald-600 rounded-lg transition-colors"><Minus size={12} /></button>
                  <input 
                    type="number" 
                    className="w-8 text-center text-xs font-bold bg-transparent outline-none"
                    value={item.quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val > 0 && val <= item.stock_quantity) {
                        setCart(cart.map(i => i.id === item.id ? { ...i, quantity: val } : i));
                      }
                    }}
                  />
                  <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-white text-emerald-600 rounded-lg transition-colors"><Plus size={12} /></button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-20">
              <ShoppingCart size={48} className="mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest">Panier vide</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t border-emerald-100 space-y-4">
          <div className="flex justify-between items-center text-gray-800 text-xl font-black">
            <span>TOTAL</span>
            <span className="text-emerald-600">{total.toLocaleString('fr-MG')} MGA</span>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setShowPreview(true)}
              disabled={cart.length === 0}
              className="flex-1 bg-white border border-emerald-200 text-emerald-600 font-bold py-3 rounded-xl hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Eye size={18} /> Aperçu
            </button>
            <button 
              onClick={handleCheckout}
              disabled={cart.length === 0 || isProcessing}
              className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : (
                <><CheckCircle size={18} /> Valider</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-emerald-900/40 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl my-auto animate-in zoom-in duration-200">
            <div className="p-6 border-b border-emerald-50 flex justify-between items-center sticky top-0 bg-white rounded-t-[2rem] z-10">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FileText className="text-emerald-600" /> Aperçu de la Facture
              </h3>
              <div className="flex gap-2">
                <button onClick={printInvoice} className="bg-emerald-50 text-emerald-600 p-2 rounded-xl hover:bg-emerald-100 transition-all">
                  <Printer size={20} />
                </button>
                <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 p-2">&times;</button>
              </div>
            </div>

            <div className="p-8 bg-gray-50 overflow-y-auto max-h-[70vh]">
              {/* Actual Invoice Content */}
              <div ref={previewRef} className="bg-white p-10 shadow-sm mx-auto w-full max-w-[600px] text-gray-800 font-sans">
                <div className="flex justify-between items-start border-b-2 border-emerald-500 pb-6 mb-8">
                  <div>
                    <h1 className="text-2xl font-black text-emerald-600 uppercase tracking-tighter">Gestock PPN</h1>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Gestion de Stock de Première Nécessité</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-bold text-gray-300 uppercase">Facture Proforma</h2>
                    <p className="text-xs font-bold">N° {Date.now().toString().slice(-6)}</p>
                    <p className="text-[10px] text-gray-400">{new Date().toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>

                <div className="mb-8">
                  <p className="text-[10px] font-black text-emerald-700 uppercase mb-3">Articles commandés</p>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] text-gray-400 uppercase">
                        <th className="py-2">Produit</th>
                        <th className="py-2 text-center">Qté</th>
                        <th className="py-2 text-right">Prix Unitaire</th>
                        <th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {cart.map(item => (
                        <tr key={item.id} className="border-b border-gray-50">
                          <td className="py-3 font-bold">{item.name}</td>
                          <td className="py-3 text-center">{item.quantity}</td>
                          <td className="py-3 text-right">{Number(item.price).toLocaleString('fr-MG')}</td>
                          <td className="py-3 text-right font-bold">{(item.price * item.quantity).toLocaleString('fr-MG')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <div className="w-48 bg-emerald-600 text-white p-4 rounded-xl text-right">
                    <p className="text-[10px] uppercase opacity-70 mb-1">Total à payer</p>
                    <p className="text-lg font-black">{total.toLocaleString('fr-MG')} MGA</p>
                  </div>
                </div>

                <div className="mt-12 pt-6 border-t border-gray-100 text-center">
                  <p className="text-[9px] text-gray-400">Merci de votre confiance. Gestock PPN - Madagascar</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-emerald-50 flex justify-end gap-3 bg-white rounded-b-[2rem]">
              <button onClick={() => setShowPreview(false)} className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all">Fermer</button>
              <button onClick={handleCheckout} className="px-8 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all">Valider la Vente</button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal Idem */}
      {showSuccess && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-emerald-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={48} />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Vente validée !</h3>
            <p className="text-gray-500 text-sm mb-8">La transaction a été enregistrée avec succès.</p>
            <button onClick={() => { setShowSuccess(false); setShowPreview(false); }} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">Continuer</button>
          </div>
        </div>
      )}
    </div>
  );
}
