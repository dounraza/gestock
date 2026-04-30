import { useState } from 'react';

export default function CalculatorKeypad({ activeItem, onResult, onOpenDiscount }) {
  const [display, setDisplay] = useState('0');

  const handlePress = (value) => {
    setDisplay(prev => (prev === '0' && value !== '.' ? value : prev + value));
  };

  const handleBackspace = () => {
    setDisplay(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  };

  const addQuantityByUnit = (type) => {
    const val = parseFloat(display) > 0 ? parseFloat(display) : 0; 
    const unitQty = type === 'superior' ? (activeItem?.quantite_par_unite || 1) : 1;
    const increment = (val === 0 ? 1 : val) * unitQty;
    
    onResult((activeItem?.quantity || 0) + increment);
    setDisplay('0');
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-4 flex flex-col gap-3 shadow-xl">
        <h3 className="text-xs font-black text-slate-800 uppercase text-center truncate px-2">
            {activeItem ? activeItem.name : "Sélectionner un produit"}
        </h3>
        
        {/* DISPLAY */}
        <div className="bg-slate-900 rounded-xl p-3 text-right text-xl font-black text-emerald-400 h-12 flex items-center justify-end overflow-hidden shadow-inner">
            {display}
        </div>

        {/* NUMERIC PAD */}
        <div className="grid grid-cols-3 gap-2">
          {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', 'C'].map((btn) => (
            <button 
              key={btn}
              onClick={() => btn === 'C' ? setDisplay('0') : handlePress(btn)}
              className="bg-slate-100 hover:bg-slate-200 p-3 rounded-xl font-bold text-slate-800 text-sm transition-all"
            >
              {btn}
            </button>
          ))}
        </div>
          
        <button onClick={handleBackspace} className="w-full bg-red-50 hover:bg-red-100 p-2 rounded-xl font-black text-red-600 text-[10px] transition-all">
            EFFACER
        </button>
          
        {/* DYNAMIC ACTIONS */}
        <div className="grid grid-cols-2 gap-2 mt-1">
            <button 
                onClick={() => activeItem && addQuantityByUnit('base')} 
                disabled={!activeItem}
                className={`${activeItem ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-200'} text-white p-3 rounded-xl font-black text-[10px] uppercase shadow-md transition-all`}
            >
                + {activeItem?.unite_base || 'PCE'}
            </button>
            
            {activeItem && activeItem.quantite_par_unite > 1 && (
                <button 
                    onClick={() => addQuantityByUnit('superior')} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl font-black text-[10px] uppercase shadow-md transition-all"
                >
                    + {activeItem.unite_superieure || 'CTN'}
                </button>
            )}
        </div>

        {/* REMISE */}
        {activeItem && (
            <button 
                onClick={() => onOpenDiscount(activeItem)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-xl font-black text-[10px] uppercase shadow-md transition-all mt-1"
            >
                REMISE ARTICLE
            </button>
        )}
        <button 
            onClick={() => onOpenDiscount({ isGlobal: true })}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white p-3 rounded-xl font-black text-[10px] uppercase shadow-md transition-all mt-1"
        >
            REMISE GLOBALE
        </button>
    </div>
  );
}
