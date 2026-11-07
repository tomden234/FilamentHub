import { useState, useEffect } from 'react';
import { MaterialType } from '../../types/filament';
import { MATERIAL_PRESETS, BRAND_DATABASE } from '../../data/defaultSpools';
import type { SidebarProps as ParentProps } from '../Sidebar';

interface usePresetSettingsParams {
  appSettings: ParentProps['appSettings'];
  onUpdateMaterialPreset: ParentProps['onUpdateMaterialPreset'];
  onResetMaterialPreset: ParentProps['onResetMaterialPreset'];
  onUpdateBrandPreset: ParentProps['onUpdateBrandPreset'];
  onResetBrandPreset: ParentProps['onResetBrandPreset'];
  onUpdateEibosBagTara: ParentProps['onUpdateEibosBagTara'];
}

export function usePresetSettings({ appSettings, onUpdateMaterialPreset, onResetMaterialPreset, onUpdateBrandPreset, onResetBrandPreset, onUpdateEibosBagTara }: usePresetSettingsParams) {
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialType>('PLA');

  const [matInterval, setMatInterval] = useState<number>(30);

  const [matTemp, setMatTemp] = useState<number>(50);

  const [matHours, setMatHours] = useState<number>(5);

  const [matSavedSuccess, setMatSavedSuccess] = useState<boolean>(false);

  const [selectedBrand, setSelectedBrand] = useState<string>('Bambu Lab');

  const [brandTara, setBrandTara] = useState<number>(250);

  const [brandDefaultPrice, setBrandDefaultPrice] = useState<number>(19.99);

  const [brandSavedSuccess, setBrandSavedSuccess] = useState<boolean>(false);

  const [eibosTaraInput, setEibosTaraInput] = useState<number>(appSettings.eibosBagTara || 35);

  const [eibosSavedSuccess, setEibosSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    const conf = appSettings.materialPresets[selectedMaterial] || MATERIAL_PRESETS[selectedMaterial] || MATERIAL_PRESETS['PLA'];
    setMatInterval(conf.intervalDays);
    setMatTemp(conf.temp);
    setMatHours(conf.hours);
  }, [selectedMaterial, appSettings.materialPresets]);

  useEffect(() => {
    const conf = appSettings.brandPresets[selectedBrand] || {
      tara: BRAND_DATABASE.find(b => b.name === selectedBrand)?.tara ?? 200,
      defaultPrice: BRAND_DATABASE.find(b => b.name === selectedBrand)?.defaultPrice ?? 19.99
    };
    setBrandTara(conf.tara);
    setBrandDefaultPrice(conf.defaultPrice);
  }, [selectedBrand, appSettings.brandPresets]);

  useEffect(() => {
    setEibosTaraInput(appSettings.eibosBagTara || 35);
  }, [appSettings.eibosBagTara]);

  const handleSaveMaterial = () => {
    onUpdateMaterialPreset(selectedMaterial, {
      intervalDays: Number(matInterval) || 30,
      temp: Number(matTemp) || 50,
      hours: Number(matHours) || 5
    });
    setMatSavedSuccess(true);
    setTimeout(() => setMatSavedSuccess(false), 2000);
  };

  const handleResetMaterial = () => {
    onResetMaterialPreset(selectedMaterial);
    const def = MATERIAL_PRESETS[selectedMaterial];
    if (def) {
      setMatInterval(def.intervalDays);
      setMatTemp(def.temp);
      setMatHours(def.hours);
    }
    setMatSavedSuccess(true);
    setTimeout(() => setMatSavedSuccess(false), 2000);
  };

  const handleSaveBrand = () => {
    onUpdateBrandPreset(selectedBrand, {
      tara: Number(brandTara) || 200,
      defaultPrice: Number(brandDefaultPrice) || 19.99
    });
    setBrandSavedSuccess(true);
    setTimeout(() => setBrandSavedSuccess(false), 2000);
  };

  const handleResetBrand = () => {
    onResetBrandPreset(selectedBrand);
    const def = BRAND_DATABASE.find(b => b.name === selectedBrand);
    if (def) {
      setBrandTara(def.tara);
      setBrandDefaultPrice(def.defaultPrice);
    }
    setBrandSavedSuccess(true);
    setTimeout(() => setBrandSavedSuccess(false), 2000);
  };

  const handleSaveEibosTara = () => {
    onUpdateEibosBagTara(Number(eibosTaraInput) || 35);
    setEibosSavedSuccess(true);
    setTimeout(() => setEibosSavedSuccess(false), 2000);
  };

  return { selectedMaterial, setSelectedMaterial, matInterval, setMatInterval, matTemp, setMatTemp, matHours, setMatHours, handleSaveMaterial, matSavedSuccess, handleResetMaterial, eibosTaraInput, setEibosTaraInput, handleSaveEibosTara, eibosSavedSuccess, selectedBrand, setSelectedBrand, brandTara, setBrandTara, brandDefaultPrice, setBrandDefaultPrice, handleSaveBrand, brandSavedSuccess, handleResetBrand };
}
