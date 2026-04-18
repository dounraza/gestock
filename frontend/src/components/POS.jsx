import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, ShoppingCart, Trash2, Package } from 'lucide-react';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('produits').select('*, categories(name)').gt('stock_quantity', 0).order('name');
    if (data) { setProducts(data); setFilteredProducts(data); }
    setLoading(false);
  };

  useEffect(() => {
    setFilteredProducts(products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())));
  }, [searchTerm, products]);

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock_quantity) setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      else alert("Stock insuffisant !");
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id, newQty) => {
    const product = products.find(p => p.id === id);
    if (newQty > 0 && newQty <= product.stock_quantity) {
      setCart(cart.map(i => i.id === id ? { ...i, quantity: newQty } : i));
    } else if (newQty <= 0) {
      removeFromCart(id);
    }
  };

  const removeFromCart = (id) => setCart(cart.filter(i => i.id !== id));
  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: invoice, error: invError } = await supabase.from('factures').insert([{ 
        number: `CAISSE-${Date.now().toString().slice(-6)}`, total_amount: total, status: 'paid', user_id: user.id 
      }]).select().single();
      if (invError) throw invError;
      
      await supabase.from('facture_items').insert(cart.map(i => ({ facture_id: invoice.id, produit_id: i.id, quantity: i.quantity, price_at_sale: i.price })));
      for (const i of cart) await supabase.from('produits').update({ stock_quantity: i.stock_quantity - i.quantity }).eq('id', i.id);
      
      setShowSuccess(true); setCart([]); fetchProducts();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-screen bg-gray-50 p-4">
      {/* Liste Produits */}
      <div className="flex-[2] flex flex-col gap-4 overflow-hidden">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-emerald-500" size={20} />
          <input type="text" placeholder="Rechercher..." className="w-full bg-white border border-emerald-100 rounded-2xl py-3 pl-10 pr-4 shadow-sm outline-none" onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 auto-rows-min pb-20">
          {filteredProducts.map(p => (
            <button key={p.id} onClick={() => addToCart(p)} className="bg-white border border-emerald-100 rounded-2xl p-3 flex flex-col items-center hover:shadow-md transition-all">
              <Package className="text-emerald-500 mb-1" size={20} />
              <h4 className="text-[10px] font-bold text-gray-700 truncate w-full text-center">{p.name}</h4>
              <p className="text-[9px] font-black text-emerald-600">{Number(p.price).toLocaleString()} Ar</p>
              <p className="text-[8px] text-gray-400 font-bold mt-0.5">
                {p.unite_superieure && p.quantite_par_unite > 1 
                  ? `${Math.floor(p.stock_quantity / p.quantite_par_unite)} ${p.unite_superieure} + ${p.stock_quantity % p.quantite_par_unite} ${p.unite_base}`
                  : `${p.stock_quantity} ${p.unite_base || 'unité'}`}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Panier */}
      <div className="w-full lg:w-96 bg-white rounded-[2rem] shadow-xl flex flex-col overflow-hidden border border-emerald-50">
        <div className="p-4 bg-emerald-600 text-white font-bold flex justify-between items-center text-sm">Panier ({cart.length})</div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-emerald-50 p-2 rounded-xl">
              <div className="flex-1">
                <p className="text-[10px] font-bold">{item.name}</p>
                <p className="text-[9px] text-emerald-600">{Number(item.price).toLocaleString()} Ar</p>
              </div>
              <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border">
                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 font-bold">-</button>
                <input type="number" className="w-8 text-center text-[10px] outline-none bg-transparent" value={item.quantity} onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)} />
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 font-bold">+</button>
              </div>
              <button onClick={() => removeFromCart(item.id)} className="ml-1"><Trash2 size={14} className="text-red-400"/></button>
            </div>
          ))}
        </div>
        <div className="p-4 bg-gray-50 border-t border-emerald-100">
          <div className="flex justify-between text-sm font-black mb-3">Total: <span>{total.toLocaleString()} Ar</span></div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowPreview(true)} className="bg-gray-200 py-2 rounded-xl text-xs font-bold">Aperçu</button>
            <button onClick={handleCheckout} className="bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold">Valider</button>
          </div>
        </div>
      </div>
      
      {showPreview && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 z-50" onClick={() => setShowPreview(false)}>
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-3 text-sm">Aperçu Facture</h3>
            <div className="space-y-1 text-[10px] mb-4">
                {cart.map(i => <div key={i.id} className="flex justify-between"><span>{i.name}</span><span>{i.quantity} x {i.price} Ar</span></div>)}
                <div className="border-t pt-1 font-bold">Total: {total.toLocaleString()} Ar</div>
            </div>
            <button onClick={() => setShowPreview(false)} className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs">Fermer</button>
          </div>
        </div>
      )}
      {showSuccess && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowSuccess(false)}>
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center transform transition-all scale-100">
            <CheckCircle className="mx-auto text-emerald-500 mb-4" size={48} />
            <h2 className="text-xl font-black text-emerald-600">Vente validée !</h2>
            <p className="text-sm text-gray-500 mt-2">Stock mis à jour avec succès.</p>
          </div>
        </div>
      )}
    </div>
  );
}