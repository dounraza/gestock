import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Package, Tag, Truck, Edit2, Trash2 } from 'lucide-react';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const formatStock = (quantity, p) => {
    const q = Number(quantity) || 0;
    const qpu = Number(p.quantite_par_unite) || 1;
    const uSup = p.unite_superieure || 'Cartons';
    const uBase = p.unite_base || 'unité';

    if (qpu > 1) {
      const superior = Math.floor(q / qpu);
      const base = q % qpu;
      return `${superior} ${uSup} + ${base} ${uBase}`;
    }
    return `${q} ${uBase}`;
  };

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('produits')
      .select('*, categories(name), fournisseurs(name), stocks(quantity, depot_id)')
      .order('name');
      
    if (data) {
      // Calculate total stock from all depots to show in catalogue
      const productsWithTotalStock = data.map(p => ({
        ...p,
        stock_quantity: p.stocks?.reduce((acc, s) => acc + Number(s.quantity), 0) || 0
      }));
      setProducts(productsWithTotalStock);
      setFilteredProducts(productsWithTotalStock);
    }
    setLoading(false);
  };

  useEffect(() => {
    setFilteredProducts(products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    ));
  }, [searchTerm, products]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-50 flex items-center gap-4">
        <Search className="text-gray-400" />
        <input 
          placeholder="Rechercher un produit..." 
          className="flex-1 outline-none font-bold"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl overflow-hidden border border-emerald-50">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-emerald-50/50 text-[10px] font-black text-emerald-800 uppercase tracking-widest">
              <th className="p-4">Produit</th>
              <th className="p-4">Catégorie</th>
              <th className="p-4">Stock</th>
              <th className="p-4">Prix</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {filteredProducts.map(p => (
              <tr key={p.id}>
                <td className="p-4 font-bold">{p.name}</td>
                <td className="p-4 text-sm text-gray-500">{p.categories?.name || '-'}</td>
                <td className="p-4 text-sm font-bold text-emerald-600">{formatStock(p.stock_quantity, p)}</td>
                <td className="p-4 font-bold">{p.price.toLocaleString()} MGA</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
