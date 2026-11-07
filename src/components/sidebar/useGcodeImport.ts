import React, { useState } from 'react';
import { GCodeAnalysis } from '../../types/filament';
import { printerApi } from '../../api';
import { addSystemLog } from '../../utils/logService';
import { parseGCodeContent } from '../../utils/gcodeParser';
import type { SidebarProps as ParentProps } from '../Sidebar';

interface useGcodeImportParams {
  setCalcGrams: any;
  setCalcPrintHours: any;
  setHaActionToast: any;
  spools: ParentProps['spools'];
  setCalcSpoolId: any;
  setCalcPricePerKg: any;
  setActiveTab: any;
}

export function useGcodeImport({ setCalcGrams, setCalcPrintHours, setHaActionToast, spools, setCalcSpoolId, setCalcPricePerKg, setActiveTab }: useGcodeImportParams) {
  const [gcodeData, setGcodeData] = useState<GCodeAnalysis | null>(null);

  const [printerFetchLoading, setPrinterFetchLoading] = useState<boolean>(false);

  const handlePullGcodeFromPrinter = async () => {
    setPrinterFetchLoading(true);
    try {
      const res = await printerApi.bambuStatus();
      const data = res.data;
      const fileName = data?.printName || data?.subtask_name || '';
      if (data && data.success && fileName) {
        const weightGrams = Number(data.printGrams) > 0 ? Number(data.printGrams) : 0;
        // totalSeconds ist beim Drucker nur die Restzeit, keine Gesamtzeit
        const timeHours = Number(data.totalSeconds) > 0 ? Number(((data.totalSeconds as number) / 3600).toFixed(1)) : 0;
        setGcodeData({ fileName, weightGrams, timeHours, material: 'PLA' });
        if (weightGrams > 0) setCalcGrams(weightGrams);
        if (timeHours > 0) setCalcPrintHours(timeHours);
        setHaActionToast(
          weightGrams > 0
            ? `G-Code "${fileName}" (${weightGrams}g) vom X2D geladen!`
            : `Name "${fileName}" geholt. Das Gewicht meldet der Drucker nicht: bitte die .gcode-Datei hochladen.`
        );
        addSystemLog('drucker', `Druckdatei "${fileName}" vom X2D übernommen`, weightGrams > 0 ? `${weightGrams} g` : 'ohne Gewicht', 'info');
      } else {
        setHaActionToast('Der Drucker meldet gerade keine Druckdatei.');
      }
    } catch {
      setHaActionToast('Konnte Druckdatei nicht vom X2D abrufen.');
    } finally {
      setPrinterFetchLoading(false);
    }
  };

  const handleGcodeFileChange = (e: React.ChangeEvent<HTMLInputElement>, forCalc = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = (ev.target?.result as string) || '';
      const parsed = parseGCodeContent(text, file.name);
      setGcodeData(parsed);

      setCalcGrams(parsed.weightGrams);
      setCalcPrintHours(parsed.timeHours);

      const matched = spools.find(s => s.material.toUpperCase() === parsed.material.toUpperCase());
      if (matched) {
        setCalcSpoolId(matched.id);
        setCalcPricePerKg(matched.pricePerKg);
      }

      if (!forCalc) {
        setActiveTab('gcode');
      }
    };
    reader.readAsText(file);
  };

  return { handlePullGcodeFromPrinter, printerFetchLoading, handleGcodeFileChange, gcodeData };
}
