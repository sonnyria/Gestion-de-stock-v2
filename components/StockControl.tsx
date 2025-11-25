import React, { useState, useMemo } from 'react';
import { Product } from '../types.ts';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface StockControlProps {
  product: Product;
  onUpdateStock: (barcode: string, delta: number) => void;
  onClose: () => void;
  onDelete: (barcode: string) => void;
}

const StockControl: React.FC<StockControlProps> = ({ product, onUpdateStock, onClose, onDelete }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  
  const handleDeleteClick = () => {
    if (isConfirming) {
      onDelete(product.barcode);
    } else {
      setIsConfirming(true);
      // Reset confirmation state after 3 seconds if user doesn't confirm
      setTimeout(() => setIsConfirming(false), 3000);
    }
  };

  // Filter options
  type RangeKey = '7d' | '1m' | '3m' | '1y' | 'all';
  type AggKey = 'none' | 'daily' | 'monthly' | 'quarterly' | 'yearly';
  type AggMethod = 'avg' | 'median' | 'sum' | 'max';
  const [range, setRange] = useState<RangeKey>('all');
  const [agg, setAgg] = useState<AggKey>('none');
  const [aggMethod, setAggMethod] = useState<AggMethod>('avg');

  const historyData = useMemo(() => {
    const arr = (product.history || []).slice().sort((a,b) => a.timestamp - b.timestamp).map(h => ({ timestamp: h.timestamp, quantity: h.quantity }));
    if (!arr.length) return arr;
    if (range === 'all') return arr;
    const now = Date.now();
    let cutoff = 0;
    switch(range) {
      case '7d':
        cutoff = now - 7 * 24 * 60 * 60 * 1000; break;
      case '1m':
        cutoff = now - 30 * 24 * 60 * 60 * 1000; break;
      case '3m':
        cutoff = now - 90 * 24 * 60 * 60 * 1000; break;
      case '1y':
        cutoff = now - 365 * 24 * 60 * 60 * 1000; break;
      default:
        cutoff = 0; break;
    }
    return arr.filter(point => point.timestamp >= cutoff);
  }, [product.history, range]);

  // Aggregate history by selected aggregation
  const aggregatedData = useMemo(() => {
    if (agg === 'none') return historyData;
    const buckets = new Map<number, { sum: number; count: number; values: number[] }>();
    const getBucketStart = (ts: number) => {
      const d = new Date(ts);
      switch (agg) {
        case 'daily':
          return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        case 'monthly':
          return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        case 'quarterly': {
          const qMonth = Math.floor(d.getMonth() / 3) * 3; // 0,3,6,9
          return new Date(d.getFullYear(), qMonth, 1).getTime();
        }
        case 'yearly':
          return new Date(d.getFullYear(), 0, 1).getTime();
        default:
          return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }
    };

    historyData.forEach(pt => {
      const key = getBucketStart(pt.timestamp);
      const existing = buckets.get(key);
      if (!existing) buckets.set(key, { sum: pt.quantity, count: 1, values: [pt.quantity] });
      else { existing.sum += pt.quantity; existing.count += 1; existing.values.push(pt.quantity); }
    });

    const result = Array.from(buckets.entries()).map(([timestamp, { sum, count, values }]) => {
      let value: number;
      switch (aggMethod) {
        case 'avg':
          value = Math.round(sum / count);
          break;
        case 'median':
          values.sort((a,b) => a - b);
          const mid = Math.floor(values.length / 2);
          value = values.length % 2 === 1 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2);
          break;
        case 'sum':
          value = sum;
          break;
        case 'max':
          value = Math.max(...values);
          break;
        default:
          value = Math.round(sum / count);
      }
      return { timestamp, quantity: value, count };
    }).sort((a,b)=> a.timestamp - b.timestamp);
    return result;
  }, [historyData, agg]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white p-6 animate-fade-in">
      <button onClick={onClose} className="mb-6 text-gray-400 hover:text-white flex items-center gap-2">
        ← Retour
      </button>
      
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold leading-tight">{product.name}</h2>
          </div>
          {/* Category display removed */}
        </div>
        <div className="text-right">
           <p className="text-xs text-gray-500 font-mono">REF</p>
           <p className="text-sm font-mono text-blue-400">{product.barcode}</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 bg-gray-800/50 rounded-2xl p-8 border border-gray-800">
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-4">En Stock</p>
        
        <div className="text-8xl font-bold text-white mb-8 tabular-nums">
          {product.quantity}
        </div>

        <div className="flex items-center gap-6 w-full max-w-xs">
          <button
            onClick={() => onUpdateStock(product.barcode, -1)}
            className="flex-1 h-20 rounded-xl bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-500 text-4xl flex items-center justify-center transition active:scale-95"
          >
            -
          </button>
          <button
            onClick={() => onUpdateStock(product.barcode, 1)}
            className="flex-1 h-20 rounded-xl bg-green-900/20 hover:bg-green-900/40 border border-green-900/50 text-green-500 text-4xl flex items-center justify-center transition active:scale-95"
          >
            +
          </button>
        </div>
      </div>
      {/* History chart */}
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xs text-gray-400 uppercase tracking-wider mr-2">Période :</div>
        <div className="flex gap-2">
          {(['7d','1m','3m','1y','all'] as RangeKey[]).map(k => (
            <button
              key={k}
              onClick={() => setRange(k)}
              className={`text-xs px-3 py-1 rounded-full transition ${range === k ? 'bg-blue-600 text-white' : 'bg-gray-800/40 text-gray-300'}`}
            >
              {k === '7d' ? '7j' : k === '1m' ? '1 m' : k === '3m' ? '3 m' : k === '1y' ? '1 a' : 'Tout' }
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <div className="text-xs text-gray-400 uppercase tracking-wider mr-2">Agrégation :</div>
        <div className="flex gap-2">
          {(['none','daily','monthly','quarterly','yearly'] as AggKey[]).map(k => (
            <button
              key={k}
              onClick={() => setAgg(k)}
              className={`text-xs px-3 py-1 rounded-full transition ${agg === k ? 'bg-blue-600 text-white' : 'bg-gray-800/40 text-gray-300'}`}
            >
              {k === 'none' ? 'Aucun' : k === 'daily' ? 'Journée' : k === 'monthly' ? 'Mois' : k === 'quarterly' ? 'Trimestre' : 'Année' }
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <div className="text-xs text-gray-400 uppercase tracking-wider mr-2">Méthode :</div>
        <div className="flex gap-2">
          {(['avg','median','sum','max'] as AggMethod[]).map(k => (
            <button
              key={k}
              onClick={() => setAggMethod(k)}
              className={`text-xs px-3 py-1 rounded-full transition ${aggMethod === k ? 'bg-blue-600 text-white' : 'bg-gray-800/40 text-gray-300'}`}
            >
              {k === 'avg' ? 'Moyenne' : k === 'median' ? 'Médiane' : k === 'sum' ? 'Somme' : 'Max'}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 w-full">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Historique du produit</p>
        {historyData.length === 0 ? (
          <div className="text-sm text-gray-400">Aucun historique disponible</div>
        ) : (
          <div className="w-full h-40 bg-gray-900/40 rounded-lg p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aggregatedData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => {
                    const d = new Date(ts);
                    switch(agg){
                      case 'daily': return d.toLocaleDateString();
                      case 'monthly': return `${d.toLocaleString(undefined, { month: 'short' })} ${d.getFullYear()}`;
                      case 'quarterly': const quarter = Math.floor(d.getMonth()/3)+1; return `T${quarter} ${d.getFullYear()}`;
                      case 'yearly': return `${d.getFullYear()}`;
                      default: return d.toLocaleDateString();
                    }
                  }}
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  minTickGap={20}
                />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(ts) => new Date(ts).toLocaleString()}
                  formatter={(value: any, name: string, props: any) => {
                    const count = props && props.payload && props.payload.count;
                    const methodLabel = aggMethod === 'avg' ? 'Moyenne' : aggMethod === 'median' ? 'Médiane' : aggMethod === 'sum' ? 'Somme' : 'Max';
                    return [`${value} ${count ? `(n=${count})` : ''}`, methodLabel];
                  }}
                  contentStyle={{ backgroundColor: '#111827', border: 'none', color: '#fff' }}
                />
                <Line type="monotone" dataKey="quantity" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="mt-auto pt-8">
        <button
          onClick={handleDeleteClick}
          className={`w-full py-4 rounded-xl text-base font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
             isConfirming 
             ? 'bg-red-600 text-white shadow-lg hover:bg-red-700 scale-105 ring-2 ring-red-500 ring-offset-2 ring-offset-gray-900' 
             : 'bg-red-900/10 text-red-400 hover:bg-red-900/20 border border-red-900/30'
          }`}
        >
          {isConfirming ? (
              <>
                <span>⚠️ Confirmer la suppression ?</span>
              </>
          ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Supprimer du catalogue
              </>
          )}
        </button>
        {isConfirming && (
            <p className="text-center text-xs text-gray-500 mt-2 animate-pulse">Cliquez à nouveau pour valider</p>
        )}
      </div>
    </div>
  );
};

export default StockControl;