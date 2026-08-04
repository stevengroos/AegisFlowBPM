import React from 'react';
import { Link2, Trash2, Plus } from 'lucide-react';
import FileUploadField from '../../components/ui/FileUploadField';
import SearchableSelect from '../../components/ui/SearchableSelect';

// 🔥 IMPORTAMOS LAS LIBRERÍAS NUEVAS 🔥
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import CurrencyInput from 'react-currency-input-field';

const SubformTable = ({ field, value, onChange, relationData, isEditing }) => {
  const rows = Array.isArray(value) ? value : [];
  const columns = field.subform_config || [];
  
  if (columns.length === 0) return <div className="p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-center text-sm text-gray-400">Subformulario sin columnas configuradas.</div>;
  if (!isEditing && rows.length === 0) return <div className="text-sm text-gray-400 italic py-2">No hay registros en esta tabla.</div>;

  const handleAddRow = () => {
    const newRow = {};
    columns.forEach(col => newRow[col.label] = '');
    onChange([...rows, newRow]);
  };

  const handleRemoveRow = (index) => {
    const updated = [...rows];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleChangeCell = (index, colLabel, newValue) => {
    const updated = [...rows];
    updated[index][colLabel] = newValue;
    onChange(updated);
  };

  return (
   
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 w-full shadow-sm overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
            <tr>
              {columns.map((col, i) => <th key={i} className="px-4 py-3 font-bold">{col.label}</th>)}
              {isEditing && <th className="px-4 py-3 w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                {columns.map((col, cIdx) => {
                  const cellValue = row[col.label];
                  
                  // ==========================================
                  // MODO LECTURA (VISTA)
                  // ==========================================
                  if (!isEditing) {
                    let displayValue = cellValue;
                    
                    if (col.type === 'relation' && cellValue) {
                       const relOpt = (relationData[col.target_module_id] || []).find(o => o.value == cellValue);
                       displayValue = relOpt ? relOpt.label : `ID: ${cellValue}`;
                    }
                    if (col.type === 'file' || col.type === 'image') {
                        return <td key={cIdx} className="px-4 py-2"><FileUploadField type={col.type} value={cellValue} disabled={true} /></td>;
                    }
                    
                    // 🔥 NUEVO: Formato bonito para Monedas y Teléfonos en modo lectura
                    if (col.type === 'currency' && cellValue !== undefined && cellValue !== "") {
                       // Extraemos la configuración de la moneda
                       let parsedOpts = {};
                       try { parsedOpts = typeof col.options === 'string' ? JSON.parse(col.options) : (col.options || {}); } catch(e) {}
                       
                       const symPos = parsedOpts.symbol_position || 'left';
                       const sym = parsedOpts.symbol || 'Gs';
                       const decPlaces = parsedOpts.decimal_places !== undefined ? parsedOpts.decimal_places : 2;
                       
                       let decSep = parsedOpts.decimal_separator || ',';
                       let grpSep = parsedOpts.thousand_separator || '.';
                       if (decSep === grpSep) { decSep = ','; grpSep = '.'; } // Anti-crash
                       
                       // Formateamos el número
                       const num = Number(String(cellValue).replace(/[^0-9.-]+/g,"")); 
                       let formattedVal = cellValue;
                       
                       if (!isNaN(num)) {
                           let strNum = num.toFixed(decPlaces);
                           let parts = strNum.split('.');
                           parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, grpSep);
                           formattedVal = decPlaces > 0 ? parts.join(decSep) : parts[0];
                       }

                       displayValue = symPos === 'right' ? `${formattedVal} ${sym}` : `${sym} ${formattedVal}`;
                    }
                    if (col.type === 'phone' && cellValue) {
                       displayValue = `+${cellValue}`; // Agregamos el + para denotar código internacional
                    }

                    return (
                      <td key={cIdx} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {col.type === 'relation' && cellValue ? (
                           <a href={`/cases/${cellValue}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"><Link2 size={12}/> {displayValue}</a>
                        ) : (
                           displayValue || '--'
                        )}
                      </td>
                    );
                  }

                  // ==========================================
                  // MODO EDICIÓN
                  // ==========================================
                  const inputClass = "w-full px-3 py-1.5 bg-transparent border-0 border-b border-transparent focus:border-blue-500 hover:border-gray-300 dark:hover:border-gray-600 focus:ring-0 outline-none text-sm text-gray-900 dark:text-white transition-colors";
                  return (
                    <td key={cIdx} className="px-4 py-2 align-top">
                       {col.type === 'select' ? (
                          <select value={cellValue || ''} onChange={e => handleChangeCell(rIdx, col.label, e.target.value)} className={inputClass}>
                             <option value="">...</option>
                             {(col.options ? col.options.split(',') : []).map((o, i) => <option key={i} value={o.trim()}>{o.trim()}</option>)}
                          </select>
                       ) : col.type === 'relation' ? (
                          <div className="min-w-[200px]">
                            <SearchableSelect
                               value={cellValue || ''}
                               onChange={val => handleChangeCell(rIdx, col.label, val)}
                               options={relationData[col.target_module_id] || []}
                               placeholder="Seleccionar..."
                            />
                          </div>
                          
                       
                       ) : col.type === 'phone' ? (
                          <div className="min-w-[200px] react-phone-wrapper" style={{'--phone-border': 'transparent', '--phone-bg': 'transparent'}}>
                            <PhoneInput
                              country={col.options?.default_country?.toLowerCase() || 'py'}
                              disableDropdown={col.options?.restrict_country || false}
                              value={cellValue || ''}
                              onChange={val => handleChangeCell(rIdx, col.label, val)}
                              inputClass={inputClass}
                              buttonClass="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 !rounded-l-xl !border-r-0 !border-y-0"
                              containerClass="w-full relative"
                              inputStyle={{width: '100%', height: '34px', paddingLeft: '48px', backgroundColor: 'transparent', borderColor: 'transparent', color: 'inherit'}}
                            />
                          </div>
                          
                       
                       ) : col.type === 'currency' ? (
                          <div className="min-w-[150px] relative">
                             {col.options?.symbol_position === 'left' && (
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">{col.options?.symbol || '$'}</span>
                             )}
                             <CurrencyInput
                               id={`currency-${rIdx}-${cIdx}`}
                               name={`currency-${rIdx}-${cIdx}`}
                               value={cellValue || ''}
                               decimalsLimit={col.options?.decimal_places ?? 2}
                               decimalSeparator={col.options?.decimal_separator || ','}
                               groupSeparator={col.options?.thousand_separator || '.'}
                               onValueChange={(val) => handleChangeCell(rIdx, col.label, val || '')}
                               className={`${inputClass} ${col.options?.symbol_position === 'left' ? 'pl-6' : ''} ${col.options?.symbol_position === 'right' ? 'pr-6' : ''}`}
                               placeholder="0.00"
                             />
                             {col.options?.symbol_position === 'right' && (
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">{col.options?.symbol || '$'}</span>
                             )}
                          </div>

                       ) : col.type === 'file' || col.type === 'image' ? (
                          <div className="min-w-[150px]"><FileUploadField type={col.type} value={cellValue || ''} onChange={val => handleChangeCell(rIdx, col.label, val)} disabled={false} /></div>
                       ) : (
                          <input type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'} value={cellValue || ''} onChange={e => handleChangeCell(rIdx, col.label, e.target.value)} className={inputClass} placeholder={`Escribir ${col.label.toLowerCase()}`} />
                       )}
                    </td>
                  );
                })}
                {isEditing && (
                  <td className="px-4 py-2 text-right align-top pt-3">
                    <button type="button" onClick={() => handleRemoveRow(rIdx)} className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isEditing && (
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <button type="button" onClick={handleAddRow} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1.5 transition-colors"><Plus size={14}/> Agregar Fila</button>
        </div>
      )}
    </div>
  );
};

export default SubformTable;