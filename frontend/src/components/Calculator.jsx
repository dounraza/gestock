import { useState } from 'react';

export default function CalculatorKeypad({ activeItem, onResult }) {
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
    <div className="bg-white border border-emerald-100 rounded-[2rem] p-4 flex flex-col gap-3 shadow-lg">
        <h3 className="text-xs font-black text-emerald-900 uppercase text-center truncate px-2">
            {activeItem ? activeItem.name : "Sélectionner un produit"}
        </h3>
        
        {/* DISPLAY */}
        <div className="bg-emerald-900 rounded-xl p-3 text-right text-xl font-black text-white h-12 flex items-center justify-end overflow-hidden">
            {display}
        </div>

        {/* NUMERIC PAD */}
        <div className="grid grid-cols-3 gap-1">
          {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', 'C'].map((btn) => (
            <button 
              key={btn}
              onClick={() => btn === 'C' ? setDisplay('0') : handlePress(btn)}
              className="bg-gray-50 hover:bg-emerald-50 p-3 rounded-lg font-bold text-emerald-900 text-sm transition-all"
            >
              {btn}
            </button>
          ))}
        </div>
          
        <button onClick={handleBackspace} className="w-full bg-red-50 hover:bg-red-100 p-2 rounded-lg font-black text-red-600 text-[10px] transition-all">
            EFFACER
        </button>
          
        {/* DYNAMIC ACTIONS - PERMANENTLY DISPLAYED */}
        <div className="grid grid-cols-2 gap-2 mt-1">
            <button 
                onClick={() => addQuantityByUnit('base')} 
                disabled={!activeItem}
                className={`${activeItem ? 'bg-emerald-600' : 'bg-gray-200'} text-white p-4 rounded-xl font-black text-[10px] uppercase shadow-md transition-all`}
            >
                + {activeItem?.unite_base || 'PCE'}
            </button>
            
            {activeItem && activeItem.quantite_par_unite > 1 && (
                <button 
                    onClick={() => addQuantityByUnit('superior')} 
                    className="bg-orange-600 text-white p-4 rounded-xl font-black text-[10px] uppercase shadow-md transition-all"
                >
                    + {activeItem.unite_superieure || 'CTN'}
                </button>
            )}
        </div>
    </div>
  );
}
