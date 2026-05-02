import { useState } from 'react';

export default function CalculatorKeypad({ activeItem, onResult, onOpenDiscount, onClose }) {
  const [display, setDisplay] = useState('0');

  const handlePress = (value) => {
    setDisplay(prev => (prev === '0' && value !== '.' ? value : prev + value));
  };

  const addQuantityByUnit = (type) => {
    const val = parseFloat(display) > 0 ? parseFloat(display) : 0; 
    const unitQty = type === 'superior' ? (activeItem?.quantite_par_unite || 1) : 1;
    const increment = (val === 0 ? 1 : val) * unitQty;
    
    onResult((activeItem?.quantity || 0) + increment);
    setDisplay('0');
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-2.5 flex flex-col gap-2 shadow-xl">
        <div className="flex items-center justify-between gap-2">
            <h3 className="text-[9px] font-black text-slate-800 uppercase truncate px-1 flex-1">
                {activeItem ? activeItem.name : "Sélectionner un produit"}
            </h3>
            <button onClick={onClose} className="text-red-500 hover:text-red-700 font-black text-sm p-1">X</button>
        </div>
        
        {/* DISPLAY */}
        <div className="bg-slate-900 rounded-lg p-2 text-right text-lg font-black text-emerald-400 h-9 flex items-center justify-end overflow-hidden shadow-inner">
            {display}
        </div>


        {/* NUMERIC PAD */}
        <div className="grid grid-cols-3 gap-1.5">
          {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', 'C'].map((btn) => (
            <button 
              key={btn}
              onClick={() => btn === 'C' ? setDisplay('0') : handlePress(btn)}
              className="bg-slate-100 hover:bg-slate-200 p-2 rounded-lg font-bold text-slate-800 text-xs transition-all"
            >
              {btn}
            </button>
          ))}
        </div>
          
        {/* DYNAMIC ACTIONS */}
        <div className="grid grid-cols-2 gap-1.5 mt-0.5">
            <button 
                onClick={() => activeItem && addQuantityByUnit('base')} 
                disabled={!activeItem}
                className={`${activeItem ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-200'} text-white p-2 rounded-lg font-black text-[9px] uppercase shadow-md transition-all`}
            >
                + {activeItem?.unite_base || 'PCE'}
            </button>
            
            {activeItem && activeItem.quantite_par_unite > 1 && (
                <button 
                    onClick={() => addQuantityByUnit('superior')} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg font-black text-[9px] uppercase shadow-md transition-all"
                >
                    + {activeItem.unite_superieure || 'CTN'}
                </button>
            )}
        </div>

        <button 
            onClick={() => onOpenDiscount({ isGlobal: true })}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white p-2 rounded-lg font-black text-[9px] uppercase shadow-md transition-all"
        >
            REMISE GLOBALE
        </button>
    </div>
  );
}
