import { useState } from 'react';
import type { SidebarProps as ParentProps } from '../Sidebar';

interface useCalculatorParams {
  spools: ParentProps['spools'];
}

export function useCalculator({ spools }: useCalculatorParams) {
  const [calcSpoolId, setCalcSpoolId] = useState<string>(spools[0]?.id || '');

  const [calcGrams, setCalcGrams] = useState<number>(85);

  const [calcPricePerKg, setCalcPricePerKg] = useState<number>(
    spools[0]?.pricePerKg || 19.99
  );

  const [calcPrintHours, setCalcPrintHours] = useState<number>(3.5);

  const [calcPrinterWatts, setCalcPrinterWatts] = useState<number>(150);

  const [calcKwhPrice] = useState<number>(0.35);

  const [calcWearEuro] = useState<number>(0.30);

  const filamentCost = (calcGrams / 1000) * calcPricePerKg;

  const powerKwh = (calcPrinterWatts * calcPrintHours) / 1000;

  const powerCost = powerKwh * calcKwhPrice;

  const wearCost = calcWearEuro;

  const totalCost = filamentCost + powerCost + wearCost;

  return { setCalcGrams, setCalcPrintHours, setCalcSpoolId, setCalcPricePerKg, calcSpoolId, calcGrams, calcPricePerKg, calcPrintHours, calcPrinterWatts, setCalcPrinterWatts, filamentCost, powerCost, totalCost };
}
